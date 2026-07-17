import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { buyData } from '@/lib/api/gsubz'
import { saveTransaction, atomicDeductWallet, atomicRefundWallet } from '@/lib/utils/save-transaction'
import { logRequest } from '@/lib/api-logger'

/**
 * POST /api/v1/data/purchase
 *
 * Body: { service: string, plan_id: string, phone: string }
 * Requires X-Connect-Key header.
 *
 * Deducts API price from user's wallet, purchases data via Gsubz, and saves the transaction.
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
      { success: false, error: auth.error },
      { status: auth.status || 401 }
    )
  }

  const userId = auth.context!.userId
  const permissions = auth.context!.permissions ?? []

  if (!permissions.includes('data') && !permissions.includes('all')) {
    const duration = Date.now() - startTime
    console.log(`[Data Purchase API] ✗ Permission denied for user: ${userId} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: 'This key does not have data purchase permission' },
      { status: 403 }
    )
  }

  let body: { service?: string; plan_id?: string; phone?: string }
  try {
    body = await request.json()
  } catch {
    console.log(`[Data Purchase API] ✗ Invalid JSON body`)
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { service, plan_id, phone } = body

  if (!service || !plan_id || !phone) {
    console.log(`[Data Purchase API] ✗ Missing fields: service=${!!service}, plan_id=${!!plan_id}, phone=${!!phone}`)
    return NextResponse.json(
      { success: false, error: 'Missing required fields: service, plan_id, phone' },
      { status: 400 }
    )
  }

  // Validate phone
  const phoneClean = String(phone).replace(/\s+/g, '')
  if (!/^(0|234|\+234)\d{10}$/.test(phoneClean) && !/^\d{11}$/.test(phoneClean)) {
    console.log(`[Data Purchase API] ✗ Invalid phone: ${phone}`)
    return NextResponse.json({ success: false, error: 'Invalid Nigerian phone number' }, { status: 400 })
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
        { success: false, error: 'Invalid plan_id. Use the id from GET /api/v1/data/plans.' },
        { status: 404 }
      )
    }

    // Look up API pricing rule by full service ID (e.g. mtn_sme, not just mtn)
    // and displayName — this is how the admin API pricing page saves rules.
    const { data: rule } = await admin
      .from('api_pricing_rules')
      .select('plan_name, base_price, markup_type, markup_value')
      .eq('service_id', service)            // full service ID e.g. mtn_sme
      .eq('plan_name', matchedPlan.displayName)
      .eq('is_active', true)
      .maybeSingle()

    if (!rule) {
      console.log(`[Data Purchase API] ✗ Plan not available for API users: ${matchedPlan.displayName}`)
      return NextResponse.json(
        { success: false, error: 'Plan not available for API users. Contact support.' },
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
      return NextResponse.json({ success: false, error: 'User account not found' }, { status: 404 })
    }

    const walletBalance = parseFloat(profile.wallet_balance || '0')
    if (walletBalance < apiPrice) {
      console.log(`[Data Purchase API] ✗ Insufficient balance | Required: ₦${apiPrice}, Available: ₦${walletBalance}`)
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient wallet balance. Required: ₦${apiPrice.toLocaleString()}, Available: ₦${walletBalance.toLocaleString()}`,
        },
        { status: 402 }
      )
    }

    console.log(`[Data Purchase API] → Processing: ${service} | ₦${apiPrice} | Phone: ${phoneClean}`)

    // Deduct from wallet atomically
    const deduction = await atomicDeductWallet(userId, apiPrice)
    if (!deduction.success) {
      console.log(`[Data Purchase API] ✗ Wallet deduction failed: ${deduction.error}`)
      return NextResponse.json({ success: false, error: deduction.error || 'Failed to deduct wallet' }, { status: 402 })
    }

    console.log(`[Data Purchase API] → Wallet deducted | New balance: ₦${deduction.newBalance}`)

    const transactionId = `V1-DATA-${crypto.randomUUID().replace(/-/g, '').toUpperCase().substring(0, 12)}`
    const balanceAfter = deduction.newBalance ?? walletBalance - apiPrice

    // Purchase data via Gsubz
    let gsubzResult: { code: number; status: string; description: string; content?: unknown }
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
      // Refund on API failure
      console.log(`[Data Purchase API] ✗ Gsubz API error: ${err}`)
      await atomicRefundWallet(userId, apiPrice)
      return NextResponse.json(
        { success: false, error: 'Data provider error. Your wallet has been refunded.' },
        { status: 502 }
      )
    }

    const purchased = gsubzResult.code === 200
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
      apiResponse: gsubzResult as Record<string, unknown>,
    })

    if (!purchased) {
      console.log(`[Data Purchase API] ✗ Final: Purchase failed, wallet refunded`)
      return NextResponse.json(
        { success: false, error: gsubzResult.description || 'Purchase failed. Wallet has been refunded.' },
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
    })
  } catch (err) {
    const duration = Date.now() - startTime
    console.error(`[Data Purchase API] ✗ ERROR: ${err} | ${duration}ms`)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
