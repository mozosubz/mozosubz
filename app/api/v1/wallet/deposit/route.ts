import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  initTransaction,
  initializePayment,
  getMonnifyAccessToken,
} from '@/lib/actions/monnify'
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

    // Create transaction directly with admin client (can't use createTransaction function as it requires session)
    console.log('[Wallet Deposit] Creating monnify_transactions row')
    const { data: txData, error: txInsertError } = await supabase
      .from('monnify_transactions')
      .insert({
        user_id: userId,
        payment_reference: paymentReference,
        amount: numAmount,
        status: 'PENDING',
        expires_at: expiresAt,
        processing_fee: processingFee,
        net_amount: netAmount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle()

    if (txInsertError || !txData) {
      console.error('[Wallet Deposit] Failed to create monnify_transactions row:', txInsertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create transaction' },
        { status: 500 }
      )
    }

    // Start Monnify transaction in parallel
    const initTxResult = await initTransaction(
      numAmount,
      description || 'Wallet deposit',
      paymentReference,
      userId,
      profile.email,
      profile.full_name || 'User'
    )

    if (!initTxResult.success) {
      console.error('[Wallet Deposit] Failed to init monnify transaction:', initTxResult.error)
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

    // Update transaction with Monnify data using admin client directly
    console.log('[Wallet Deposit] Updating monnify_transactions with payment details')
    const { data: updated, error: updateError } = await supabase
      .from('monnify_transactions')
      .update({
        transaction_reference: monnifyTransactionRef,
        account_number: initPayResult.accountNumber,
        bank_name: initPayResult.bankName,
        account_name: initPayResult.accountName,
        bank_code: initPayResult.bankCode,
        ussd_code: initPayResult.ussdCode,
        monnify_response: initPayResult,
        updated_at: new Date().toISOString(),
      })
      .eq('payment_reference', paymentReference)
      .select('id, payment_reference')
      .maybeSingle()

    if (updateError || !updated) {
      console.error('[Wallet Deposit] Failed to update monnify_transactions:', updateError)
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
        transaction_id: txData.id,
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
