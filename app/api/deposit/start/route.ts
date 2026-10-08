import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  initTransaction,
  initializePayment,
  getMonnifyAccessToken,
} from '@/lib/actions/monnify'
import { createTransaction, updateTransactionWithMonnifyData } from '@/lib/actions/transactions'
import { generatePaymentReference } from '@/lib/utils/payment-reference'
import { getDepositRules } from '@/lib/actions/deposit-rules'
import { calculateDepositFee } from '@/lib/utils/deposit-fee'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/utils/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit deposit initiation to prevent transaction spam / resource exhaustion
    const ip = getRateLimitIdentifier(request)
    const { allowed } = await checkRateLimit(ip, {
      interval: 60000,
      maxRequests: 10,
      keyPrefix: 'rl:deposit:start',
    })

    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many deposit requests. Please wait a minute.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    // SECURITY (bounty Round 6): authenticate before validating the payload.
    // Previously the amount was validated first, so an unauthenticated caller
    // could use this endpoint as a validation oracle.
    const supabase = await createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user?.id) {
      console.error('[DEPOSIT_API] User not authenticated')
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { amount, description } = body

    const numAmount = parseFloat(String(amount))
    if (!Number.isFinite(numAmount) || numAmount < 100 || numAmount > 1000000) {
      return NextResponse.json(
        { success: false, error: 'Amount must be between ₦100 and ₦1,000,000' },
        { status: 400 }
      )
    }

    console.log('[DEPOSIT_API] Creating deposit transaction')

    // Pre-warm the Monnify token while we fetch the deposit rules. Auth already
    // happened above, so by the time initTransaction needs the token it's cached.
    void getMonnifyAccessToken()

    const depositRules = await getDepositRules()

    // Profile lookup uses the now-known user id.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      console.error('[DEPOSIT_API] Failed to fetch user profile:', profileError)
      return NextResponse.json(
        { success: false, error: 'Failed to get user information' },
        { status: 400 }
      )
    }

    // Calculate deposit fee.
    let processingFee = 50
    let netAmount = numAmount - processingFee
    if (depositRules) {
      const feeCalc = calculateDepositFee(numAmount, depositRules)
      processingFee = feeCalc.processingFee
      netAmount = feeCalc.netAmount
    }

    const paymentReference = generatePaymentReference(user.id)
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString()

    // Create the local transaction row AND start the Monnify transaction
    // in parallel — they're independent. createTransaction returns
    // { success, error }, so we still get a clean failure signal without
    // the extra "verify row exists" round-trip the old code was doing.
    const [createTxResult, initTxResult] = await Promise.all([
      createTransaction(
        paymentReference,
        numAmount,
        expiresAt,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        processingFee,
        netAmount
      ),
      initTransaction(
        numAmount,
        description || 'Wallet deposit',
        paymentReference,
        user.id,
        profile.email,
        profile.full_name || 'User'
      ),
    ])

    if (!createTxResult.success) {
      console.error('[DEPOSIT_API] Failed to create transaction:', createTxResult.error)
      return NextResponse.json(
        { success: false, error: 'Failed to create transaction' },
        { status: 500 }
      )
    }

    if (!initTxResult.success || !initTxResult.transactionReference) {
      console.error('[DEPOSIT_API] Monnify init-transaction failed:', initTxResult.error)
      return NextResponse.json(
        { success: false, error: initTxResult.error || 'Failed to initialize payment' },
        { status: 400 }
      )
    }

    const monnifyTransactionRef = initTxResult.transactionReference

    // init-payment depends on init-transaction's reference. Token is
    // already cached on the warm path, so no extra auth round-trip.
    const initPayResult = await initializePayment(monnifyTransactionRef)
    if (!initPayResult.success) {
      console.error('[DEPOSIT_API] Monnify init-payment failed:', initPayResult.error)
      return NextResponse.json(
        { success: false, error: initPayResult.error || 'Failed to initialize payment' },
        { status: 400 }
      )
    }

    // Persist the Monnify details — must complete before we respond, the
    // webhook needs these fields to credit the wallet.
    const updateResult = await updateTransactionWithMonnifyData(paymentReference, {
      transactionReference: monnifyTransactionRef,
      accountNumber: initPayResult.accountNumber,
      bankName: initPayResult.bankName,
      accountName: initPayResult.accountName,
      bankCode: initPayResult.bankCode,
      ussdCode: initPayResult.ussdCode,
      monnifyResponse: initPayResult,
    })

    if (!updateResult.success) {
      console.error('[DEPOSIT_API] Failed to update transaction with Monnify data:', updateResult.error)
      return NextResponse.json(
        { success: false, error: 'Failed to update payment details in database' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      paymentReference,
      transactionId: createTxResult.transactionId,
      checkoutUrl: `/checkout/${paymentReference}`,
    })
  } catch (error) {
    console.error('[DEPOSIT_API] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
