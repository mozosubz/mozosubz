import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBachsCheckoutSession } from '@/lib/actions/bachs'
import { isBachsConfigured } from '@/lib/api/bachs-config'
import { attachBachsCheckout } from '@/lib/actions/transactions'
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
 * Initializes a wallet deposit payment using Bachs.
 * Returns a hosted checkout URL that the user opens (and completes payment on).
 * Requires X-Connect-Key header.
 * Rate limited: 50 requests per minute per API key
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)

  try {
    // Verify API key
    const auth = await verifyConnectKey(request)
    if (!auth.success) {
      const duration = Date.now() - startTime
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
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded (50 requests per minute)' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const body = await request.json()
    const { amount } = body

    const numAmount = parseFloat(String(amount))
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid amount is required' },
        { status: 400 }
      )
    }

    // Gate on the provider first: without a Bachs key there is no checkout to create.
    if (!isBachsConfigured()) {
      console.error('[Wallet Deposit] Bachs not configured')
      return NextResponse.json(
        { success: false, error: 'Deposits are temporarily unavailable. Please try again shortly.' },
        { status: 503 }
      )
    }

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

    // Create the Bachs checkout session — the same session shape the main
    // deposit flow uses, so the webhook can correlate it by checkout id.
    const bachsResult = await createBachsCheckoutSession({
      amount: numAmount,
      currency: 'NGN',
      reference: paymentReference,
      email: profile.email,
      name: profile.full_name || 'User',
      userId,
      successUrl: 'https://mozosubz.xyz/dashboard?deposit=success',
      cancelUrl: 'https://mozosubz.xyz/dashboard/deposit?deposit=cancelled',
    })

    if (!bachsResult.success || !bachsResult.session) {
      console.error('[Wallet Deposit] Bachs checkout-session failed:', bachsResult.error)
      return NextResponse.json(
        { success: false, error: bachsResult.error || 'Failed to initialize payment' },
        { status: 400 }
      )
    }

    const session = bachsResult.session

    // Persist the Bachs checkout details — must complete before we respond,
    // the webhook needs these fields to credit the wallet.
    const attachResult = await attachBachsCheckout(paymentReference, {
      checkoutId: session.checkoutId,
      checkoutUrl: session.checkoutUrl,
      providerStatus: session.status,
    })

    if (!attachResult.success) {
      console.error('[Wallet Deposit] Failed to attach Bachs checkout data:', attachResult.error)
      return NextResponse.json(
        { success: false, error: 'Failed to update payment details in database' },
        { status: 500 }
      )
    }

    const duration = Date.now() - startTime

    return NextResponse.json(
      {
        success: true,
        deposit_amount: numAmount,
        receiving_amount: netAmount,
        checkout_url: session.checkoutUrl,
        checkout_id: session.checkoutId,
        payment_reference: paymentReference,
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
