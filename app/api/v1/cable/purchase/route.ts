import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { buyCableSubscription } from '@/lib/api/gsubz'
import { resolveProviderError } from '@/lib/utils/provider-error'
import { saveTransaction, atomicDeductWallet, atomicRefundWallet } from '@/lib/utils/save-transaction'
import { scheduleVerifyPending } from '@/lib/utils/schedule-verify'
import { logRequest } from '@/lib/api-logger'
import { checkRateLimit, RATE_LIMIT_CONFIG } from '@/lib/utils/rate-limit'
import { normalizeNigerianPhone } from '@/lib/utils/phone'
import { isGsubzSuccess, resolveCableServiceId } from '@/lib/api/gsubz-services'

/**
 * POST /api/v1/cable/purchase
 *
 * Body: { provider: string, package: string, smartcard: string, phone: string }
 * Requires X-Connect-Key header.
 *
 * provider values: dstv | gotv | startimes
 *
 * Deducts cable subscription price from user's wallet and processes via Gsubz.
 * Rate limited: 50 requests per minute per API key
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)

  // Verify API key
  const auth = await verifyConnectKey(request)
  if (!auth.success) {
    const duration = Date.now() - startTime
    return NextResponse.json(
      { success: false, error: auth.error, error_code: 'UNAUTHORIZED' },
      { status: auth.status || 401 }
    )
  }

  const userId = auth.context!.userId
  const permissions = auth.context!.permissions ?? []

  // Check rate limit per API key
  const { allowed, remaining } = await checkRateLimit(userId, RATE_LIMIT_CONFIG.V1_CABLE_PURCHASE)
  if (!allowed) {
    const duration = Date.now() - startTime
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded (50 requests per minute)', error_code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  if (!permissions.includes('cable') && !permissions.includes('all')) {
    const duration = Date.now() - startTime
    return NextResponse.json(
      { success: false, error: 'This key does not have cable subscription permission', error_code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  let body: { provider?: string; package?: string; smartcard?: string; phone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', error_code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  const { provider, package: packageName, smartcard, phone } = body

  if (!provider || !packageName || !smartcard || !phone) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: provider, package, smartcard, phone', error_code: 'MISSING_FIELDS' },
      { status: 400 }
    )
  }

  // Validate phone (bounty Round 11: reject non-mobile prefixes like 00000000000)
  const phoneClean = normalizeNigerianPhone(String(phone))
  if (!phoneClean) {
    return NextResponse.json(
      { success: false, error: 'Invalid Nigerian phone number', error_code: 'INVALID_PHONE' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  try {
  const serviceID = resolveCableServiceId(provider)
  if (!serviceID) {
    return NextResponse.json(
      { success: false, error: 'Unsupported cable provider', error_code: 'INVALID_PROVIDER' },
      { status: 400 }
    )
  }

    // Look up cable package pricing from api_pricing_rules
    const { data: ruleRows } = await admin
      .from('api_pricing_rules')
      .select('plan_name, base_price, markup_type, markup_value')
      .eq('service_id', serviceID)
      .eq('plan_name', packageName)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)

    const rule = ruleRows?.[0] ?? null

    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'Package not available for API users. Contact support.', error_code: 'PACKAGE_NOT_ENABLED' },
        { status: 404 }
      )
    }

    const apiPrice =
      rule.markup_type === 'fixed'
        ? rule.base_price + rule.markup_value
        : rule.base_price * (1 + rule.markup_value / 100)

    // Get user's wallet balance
    const { data: profile } = await admin
      .from('profiles')
      .select('wallet_balance, full_name, email')
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'User account not found', error_code: 'ACCOUNT_NOT_FOUND' },
        { status: 404 }
      )
    }

    const walletBalance = parseFloat(profile.wallet_balance || '0')
    if (walletBalance < apiPrice) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient wallet balance. Required: ₦${apiPrice.toLocaleString()}, Available: ₦${walletBalance.toLocaleString()}`,
          error_code: 'INSUFFICIENT_BALANCE',
          required: apiPrice,
          balance_after: walletBalance,
        },
        { status: 402 }
      )
    }


    // Deduct from wallet atomically
    const deduction = await atomicDeductWallet(userId, apiPrice)
    if (!deduction.success) {
      return NextResponse.json(
        { success: false, error: deduction.error || 'Failed to deduct wallet', error_code: 'INSUFFICIENT_BALANCE' },
        { status: 402 }
      )
    }


    const transactionId = `V1-CABLE-${crypto.randomUUID().replace(/-/g, '').toUpperCase().substring(0, 12)}`
    const balanceAfter = deduction.newBalance ?? walletBalance - apiPrice

    // Subscribe to cable via Gsubz
    let gsubzResult: Awaited<ReturnType<typeof buyCableSubscription>>
    try {
    gsubzResult = await buyCableSubscription({
      serviceID,
      plan: packageName,
      amount: String(rule.base_price),
      phone: phoneClean,
      email: profile.email || 'customer@subsum.com',
      customerID: smartcard,
      requestID: transactionId,
    })
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError'

      if (isTimeout) {
        // Timeout — provider may have processed it, so save as PENDING and verify in background.

        await saveTransaction({
          userId,
          transactionId,
          category: 'CABLE',
          serviceId: serviceID,
          serviceName: `${provider.toUpperCase()} Cable`,
          amount: apiPrice,
          phone: phoneClean,
          status: 'PENDING',
          description: `${packageName} subscription via API (PENDING verification)`,
          balanceBefore: walletBalance,
          balanceAfter: balanceAfter,
          planDetails: packageName,
        })

        scheduleVerifyPending({
          requestID: transactionId,
          userId,
          amount: apiPrice,
          balanceBefore: walletBalance,
          category: 'CABLE',
        })

        return NextResponse.json({
          success: false,
          pending: true,
          error: 'Request timed out. Verifying in the background — wallet will be refunded if unsuccessful.',
          error_code: 'TIMEOUT_PENDING_VERIFICATION',
          transaction_id: transactionId,
          balance_after: balanceAfter,
        })
      }

      // Non-timeout error — refund immediately
      await atomicRefundWallet(userId, apiPrice)
      return NextResponse.json(
        {
          success: false,
          error: 'Cable provider error. Your wallet has been refunded.',
          error_code: 'PROVIDER_UNREACHABLE',
          transaction_id: transactionId,
          refunded: true,
          balance_after: walletBalance,
        },
        { status: 502 }
      )
    }

    // Determine success
    const isSuccess = isGsubzSuccess(gsubzResult)

    if (isSuccess) {
      // Transaction successful — save and return
      const finalTransactionId = String(gsubzResult.transactionID || transactionId)

      await saveTransaction({
        userId,
        transactionId: finalTransactionId,
        category: 'CABLE',
        serviceId: serviceID,
        serviceName: `${provider.toUpperCase()} Cable`,
        amount: apiPrice,
        phone: smartcard,
        status: 'SUCCESS',
        description: `${packageName} subscription via API`,
        balanceBefore: walletBalance,
        balanceAfter: balanceAfter,
        apiResponse: gsubzResult,
        planDetails: packageName,
      })

      const duration = Date.now() - startTime

      return NextResponse.json(
        {
          success: true,
          transaction_id: finalTransactionId,
          amount: apiPrice,
          balance_after: balanceAfter,
          status: 'SUCCESS',
          message: `${packageName} subscription successful`,
        },
        { status: 200 }
      )
    }

    // Transaction failed from provider — refund and save failed transaction
    const resolved = resolveProviderError(gsubzResult)

    await atomicRefundWallet(userId, apiPrice)

    await saveTransaction({
      userId,
      transactionId,
      category: 'CABLE',
      serviceId: serviceID,
      serviceName: `${provider.toUpperCase()} Cable`,
      amount: apiPrice,
      phone: phoneClean,
      status: 'FAILED',
      description: `${packageName} subscription failed · ${resolved.message}`,
      balanceBefore: walletBalance,
      balanceAfter: walletBalance,
      planDetails: packageName,
    })

    return NextResponse.json(
      {
        success: false,
        error: resolved.message || 'Cable subscription failed',
        error_code: resolved.code,
        transaction_id: transactionId,
        refunded: true,
        balance_after: walletBalance,
      },
      { status: 400 }
    )
  } catch (err) {
    console.error(`[Cable Purchase API] ✗ Unexpected error:`, err)
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
