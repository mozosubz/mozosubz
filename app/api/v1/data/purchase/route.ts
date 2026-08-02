import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { buyData } from '@/lib/api/gsubz'
import { resolveProviderError } from '@/lib/utils/provider-error'
import { saveTransaction, atomicDeductWallet, atomicRefundWallet } from '@/lib/utils/save-transaction'
import { scheduleVerifyPending } from '@/lib/utils/schedule-verify'
import { logRequest } from '@/lib/api-logger'
import { checkRateLimit, RATE_LIMIT_CONFIG } from '@/lib/utils/rate-limit'

/**
 * POST /api/v1/data/purchase
 *
 * Body: { service: string, plan_id: string, phone: string }
 * Requires X-Connect-Key header.
 *
 * Deducts API price from user's wallet, purchases data via Gsubz, and saves the transaction.
 * Rate limited: 50 requests per minute per API key
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)
  console.log(`[Data Purchase API] → POST | From: ${requestLog.ip}`)

  // Verify API key
  const auth = await verifyConnectKey(request)
  if (!auth.success) {
    const duration = Date.now() - startTime
    console.log(`[Data Purchase API] ✗ Auth failed: ${auth.error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: auth.error, error_code: 'UNAUTHORIZED' },
      { status: auth.status || 401 }
    )
  }

  const userId = auth.context!.userId
  const permissions = auth.context!.permissions ?? []

  // Check rate limit per API key
  const { allowed, remaining } = await checkRateLimit(userId, RATE_LIMIT_CONFIG.V1_DATA_PURCHASE)
  if (!allowed) {
    const duration = Date.now() - startTime
    console.log(`[Data Purchase API] ✗ Rate limit exceeded | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded (50 requests per minute)', error_code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  if (!permissions.includes('data') && !permissions.includes('all')) {
    const duration = Date.now() - startTime
    console.log(`[Data Purchase API] ✗ Permission denied for user: ${userId} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: 'This key does not have data purchase permission', error_code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  let body: { service?: string; plan_id?: string; phone?: string }
  try {
    body = await request.json()
  } catch {
    console.log(`[Data Purchase API] ✗ Invalid JSON body`)
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', error_code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  const { service, plan_id, phone } = body

  if (!service || !plan_id || !phone) {
    console.log(`[Data Purchase API] ✗ Missing fields: service=${!!service}, plan_id=${!!plan_id}, phone=${!!phone}`)
    return NextResponse.json(
      { success: false, error: 'Missing required fields: service, plan_id, phone', error_code: 'MISSING_FIELDS' },
      { status: 400 }
    )
  }

  // Validate phone
  const phoneClean = String(phone).replace(/\s+/g, '')
  if (!/^(0|234|\+234)\d{10}$/.test(phoneClean) && !/^\d{11}$/.test(phoneClean)) {
    console.log(`[Data Purchase API] ✗ Invalid phone: ${phone}`)
    return NextResponse.json(
      { success: false, error: 'Invalid Nigerian phone number', error_code: 'INVALID_PHONE' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  try {
    // Resolve plan.value → plan.displayName by fetching live plans from Gsubz.
    // The admin stores displayName as plan_name in api_pricing_rules, so we must
    // translate the caller-supplied plan_id (which is plan.value) to displayName first.
    const { getDataPlansRealtime } = await import('@/lib/api/gsubz')
    const planResponse = await getDataPlansRealtime(service)
    const matchedPlan = (planResponse.plans ?? []).find(
      (p) => p.value === plan_id
    )

    if (!matchedPlan) {
      console.log(`[Data Purchase API] ✗ Invalid plan_id: ${plan_id}`)
      return NextResponse.json(
        { success: false, error: 'Invalid plan_id. Use the id from GET /api/v1/data/plans.', error_code: 'INVALID_PLAN' },
        { status: 404 }
      )
    }

    // Look up API pricing rule by full service ID (e.g. mtn_sme, not just mtn)
    // and displayName — this is how the admin API pricing page saves rules.
    // The table has no unique constraint on (service_id, plan_name), so the same
    // plan can have several rows. maybeSingle() errors out in that case and made
    // valid plans look unavailable, so take the most recently updated rule instead.
    const { data: ruleRows } = await admin
      .from('api_pricing_rules')
      .select('plan_name, base_price, markup_type, markup_value')
      .eq('service_id', service)            // full service ID e.g. mtn_sme
      .eq('plan_name', matchedPlan.displayName)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)

    const rule = ruleRows?.[0] ?? null

    if (!rule) {
      console.log(`[Data Purchase API] ✗ Plan not available for API users: ${matchedPlan.displayName}`)
      return NextResponse.json(
        { success: false, error: 'Plan not available for API users. Contact support.', error_code: 'PLAN_NOT_ENABLED' },
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
      console.log(`[Data Purchase API] ✗ User account not found: ${userId}`)
      return NextResponse.json(
        { success: false, error: 'User account not found', error_code: 'ACCOUNT_NOT_FOUND' },
        { status: 404 }
      )
    }

    const walletBalance = parseFloat(profile.wallet_balance || '0')
    if (walletBalance < apiPrice) {
      console.log(`[Data Purchase API] ✗ Insufficient balance | Required: ₦${apiPrice}, Available: ₦${walletBalance}`)
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

    console.log(`[Data Purchase API] → Processing: ${service} | ₦${apiPrice} | Phone: ${phoneClean}`)

    // Deduct from wallet atomically
    const deduction = await atomicDeductWallet(userId, apiPrice)
    if (!deduction.success) {
      console.log(`[Data Purchase API] ✗ Wallet deduction failed: ${deduction.error}`)
      return NextResponse.json(
        { success: false, error: deduction.error || 'Failed to deduct wallet', error_code: 'INSUFFICIENT_BALANCE' },
        { status: 402 }
      )
    }

    console.log(`[Data Purchase API] → Wallet deducted | New balance: ₦${deduction.newBalance}`)

    const transactionId = `V1-DATA-${crypto.randomUUID().replace(/-/g, '').toUpperCase().substring(0, 12)}`
    const balanceAfter = deduction.newBalance ?? walletBalance - apiPrice

    // Purchase data via Gsubz
    // Type comes from buyData's return — don't redeclare it here, the provider
    // returns more fields than this route used to describe (see lib/api/gsubz.ts).
    let gsubzResult: Awaited<ReturnType<typeof buyData>>
    try {
      console.log(`[Data Purchase API] → Calling Gsubz | Service: ${service}`)
      gsubzResult = await buyData({
        serviceID: service,
        plan: plan_id,           // plan.value — what Gsubz expects
        phone: phoneClean,
        requestID: transactionId,
      })
      console.log(`[Data Purchase API] → Gsubz response | Code: ${gsubzResult.code} | Status: ${gsubzResult.status}`)
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError'

      if (isTimeout) {
        // Timeout — provider may have processed it, so save as PENDING and verify in background.
        // The wallet was already deducted; if verification confirms failure, we refund.
        console.log(`[Data Purchase API] ✗ Timeout | Saving PENDING | TX: ${transactionId}`)

        await saveTransaction({
          userId,
          transactionId,
          category: 'DATA',
          serviceId: service,
          serviceName: `${service.split('_')[0].toUpperCase()} Data`,
          amount: apiPrice,
          phone: phoneClean,
          status: 'PENDING',
          description: `${rule.plan_name} data purchase via API (PENDING verification)`,
          balanceBefore: walletBalance,
          balanceAfter: balanceAfter,
          planDetails: rule.plan_name,
        })

        scheduleVerifyPending({
          requestID: transactionId,
          userId,
          amount: apiPrice,
          balanceBefore: walletBalance,
          category: 'DATA',
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
      console.log(`[Data Purchase API] ✗ Gsubz API error: ${err}`)
      await atomicRefundWallet(userId, apiPrice)
      return NextResponse.json(
        {
          success: false,
          error: 'Data provider error. Your wallet has been refunded.',
          error_code: 'PROVIDER_UNREACHABLE',
          transaction_id: transactionId,
          refunded: true,
          balance_after: walletBalance,
        },
        { status: 502 }
      )
    }

    // Gsubz can return HTTP 200 with status "failed" in the body (e.g. "not eligible
    // for this offer"). Checking code alone caused successful-looking transactions
    // where the data was never delivered but the wallet was still deducted.
    // A purchase is only successful when code is 200 AND status is not "failed".
    const purchased =
      gsubzResult.code === 200 &&
      gsubzResult.status?.toLowerCase() !== 'failed' &&
      gsubzResult.status?.toLowerCase() !== 'error'
    const txStatus = purchased ? 'SUCCESS' : 'FAILED'

    // If Gsubz failed, refund the user
    if (!purchased) {
      console.log(`[Data Purchase API] ✗ Purchase failed from Gsubz: ${gsubzResult.description}`)
      await atomicRefundWallet(userId, apiPrice)
    }

    // Save transaction log
    await saveTransaction({
      userId,
      transactionId,
      category: 'DATA',
      serviceId: service,
      serviceName: `${service.split('_')[0].toUpperCase()} Data`,
      amount: apiPrice,
      phone: phoneClean,
      status: txStatus,
      description: `${rule.plan_name} data purchase via API`,
      balanceBefore: walletBalance,
      balanceAfter: purchased ? balanceAfter : walletBalance,
      planDetails: rule.plan_name,
      apiResponse: gsubzResult as unknown as Record<string, unknown>,
    })

    if (!purchased) {
      const resolved = resolveProviderError(gsubzResult, { refunded: true })
      console.log(
        `[Data Purchase API] ✗ Final: Purchase failed, wallet refunded | ${resolved.code} | Gsubz: ${resolved.providerMessage}`
      )
      return NextResponse.json(
        {
          success: false,
          error: resolved.message,
          error_code: resolved.code,
          transaction_id: transactionId,
          refunded: true,
          balance_after: walletBalance,
        },
        { status: 400 }
      )
    }

    const duration = Date.now() - startTime
    console.log(`[Data Purchase API] ✓ SUCCESS | TX: ${transactionId} | User: ${userId} | ₦${apiPrice} | ${duration}ms`)

    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      plan: rule.plan_name,
      phone: phoneClean,
      amount: apiPrice,           // this is the final price the user paid — no breakdown
      balance_after: balanceAfter,
      remaining,
    })
  } catch (err) {
    const duration = Date.now() - startTime
    console.error(`[Data Purchase API] ✗ ERROR: ${err} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
