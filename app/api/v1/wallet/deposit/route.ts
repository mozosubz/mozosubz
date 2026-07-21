import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  initTransaction,
  initializePayment,
  getMonnifyAccessToken,
} from '@/lib/actions/monnify'
import { createTransaction, updateTransactionWithMonnifyData } from '@/lib/actions/transactions'
import { generatePaymentReference } from '@/lib/utils/payment-reference'
import { getDepositRules } from '@/lib/actions/deposit-rules'
import { calculateDepositFee } from '@/lib/utils/deposit-fee'
import { logRequest } from '@/lib/api-logger'
import { checkRateLimit, RATE_LIMIT_CONFIG } from '@/lib/utils/rate-limit'

/**
 * POST /api/v1/wallet/deposit
 *
 * Body: { amount: number, description?: string }
 *
 * Initializes a wallet deposit payment using Monnify.
 * Returns payment link that user can click to pay from browser.
 * Requires X-Connect-Key header.
 * Rate limited: 50 requests per minute per API key
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)
  console.log(`[Wallet Deposit] → POST | From: ${requestLog.ip}`)

  try {
    // Verify API key
    const auth = await verifyConnectKey(request)
    if (!auth.success) {
      const duration = Date.now() - startTime
      console.log(`[Wallet Deposit] ✗ Auth failed: ${auth.error} | ${duration}ms`)
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status ?? 401 }
      )
    }

    const userId = auth.context!.userId

    // Check rate limit
    const { allowed, remaining } = await checkRateLimit(userId, RATE_LIMIT_CONFIG.V1_DATA_PLANS)
    if (!allowed) {
      const duration = Date.now() - startTime
      console.log(`[Wallet Deposit] ✗ Rate limit exceeded | ${duration}ms`)
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded (50 requests per minute)' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const body = await request.json()
    const { amount, description } = body

    const numAmount = parseFloat(String(amount))
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid amount is required' },
        { status: 400 }
      )
    }

    console.log('[Wallet Deposit] Creating deposit transaction')

    // Pre-warm Monnify token
    void getMonnifyAccessToken()

    const supabase = createAdminClient()

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profile) {
      console.error('[Wallet Deposit] Failed to fetch user profile:', profileError)
      return NextResponse.json(
        { success: false, error: 'Failed to get user information' },
        { status: 400 }
      )
    }

    // Get deposit rules
    const depositRules = await getDepositRules()

    // Calculate deposit fee
    let processingFee = 50
    let netAmount = numAmount - processingFee
    if (depositRules) {
      const feeCalc = calculateDepositFee(numAmount, depositRules)
      processingFee = feeCalc.processingFee
      netAmount = feeCalc.netAmount
    }

    const paymentReference = generatePaymentReference(userId)
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString()

    // Create local transaction and start Monnify transaction in parallel
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
        userId,
        profile.email,
        profile.full_name || 'User'
      ),
    ])

    if (!createTxResult.success) {
      console.error('[Wallet Deposit] Failed to create transaction:', createTxResult.error)
      return NextResponse.json(
        { success: false, error: 'Failed to create transaction' },
        { status: 500 }
      )
    }

    if (!initTxResult.success || !initTxResult.transactionReference) {
      console.error('[Wallet Deposit] Monnify init-transaction failed:', initTxResult.error)
      return NextResponse.json(
        { success: false, error: initTxResult.error || 'Failed to initialize payment' },
        { status: 400 }
      )
    }

    const monnifyTransactionRef = initTxResult.transactionReference

    // Initialize payment
    const initPayResult = await initializePayment(monnifyTransactionRef)
    if (!initPayResult.success) {
      console.error('[Wallet Deposit] Monnify init-payment failed:', initPayResult.error)
      return NextResponse.json(
        { success: false, error: initPayResult.error || 'Failed to initialize payment' },
        { status: 400 }
      )
    }

    // Update transaction with Monnify data
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
      console.error('[Wallet Deposit] Failed to update transaction with Monnify data:', updateResult.error)
      return NextResponse.json(
        { success: false, error: 'Failed to update payment details in database' },
        { status: 500 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mozosubz.com'
    const checkoutUrl = `${appUrl}/checkout/${paymentReference}`

    const duration = Date.now() - startTime
    console.log(`[Wallet Deposit] ✓ Deposit initialized for user: ${userId} | Amount: ₦${numAmount} | ${duration}ms`)

    return NextResponse.json(
      {
        success: true,
        payment_reference: paymentReference,
        transaction_id: createTxResult.transactionId,
        amount: numAmount,
        processing_fee: processingFee,
        net_amount: netAmount,
        authorization_url: initPayResult.authorizationUrl || checkoutUrl,
        checkout_url: checkoutUrl,
        bank_details: {
          account_number: initPayResult.accountNumber,
          account_name: initPayResult.accountName,
          bank_name: initPayResult.bankName,
          bank_code: initPayResult.bankCode,
          ussd_code: initPayResult.ussdCode,
        },
        remaining,
      },
      { status: 200 }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Wallet Deposit] Error: ${error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
