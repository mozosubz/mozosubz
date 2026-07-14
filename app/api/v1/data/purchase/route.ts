import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { buyData } from '@/lib/api/gsubz'
import { saveTransaction, atomicDeductWallet, atomicRefundWallet } from '@/lib/utils/save-transaction'
import { v4 as uuidv4 } from 'uuid'

/**
 * POST /api/v1/data/purchase
 *
 * Body: { service: string, plan_id: string, phone: string }
 * Requires X-Connect-Key header.
 *
 * Deducts API price from user's wallet, purchases data via Gsubz, and saves the transaction.
 */
export async function POST(request: NextRequest) {
  // Verify API key
  const auth = await verifyConnectKey(request)
  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status || 401 }
    )
  }

  const userId = auth.context!.userId
  const permissions = auth.context!.permissions ?? []

  if (!permissions.includes('data') && !permissions.includes('all')) {
    return NextResponse.json(
      { success: false, error: 'This key does not have data purchase permission' },
      { status: 403 }
    )
  }

  let body: { service?: string; plan_id?: string; phone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { service, plan_id, phone } = body

  if (!service || !plan_id || !phone) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: service, plan_id, phone' },
      { status: 400 }
    )
  }

  // Validate phone
  const phoneClean = String(phone).replace(/\s+/g, '')
  if (!/^(0|234|\+234)\d{10}$/.test(phoneClean) && !/^\d{11}$/.test(phoneClean)) {
    return NextResponse.json({ success: false, error: 'Invalid Nigerian phone number' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    // Map service to network prefix for pricing lookup
    const networkMap: Record<string, string> = {
      mtn_sme: 'mtn', mtn_gifting: 'mtn', mtn_datashare: 'mtn', mtn_awoof: 'mtn',
      glo_sme: 'glo', glo_data: 'glo',
      airtel_sme: 'airtel', airtel_gifting: 'airtel',
      etisalat_data: 'etisalat',
    }
    const networkPrefix = networkMap[service]
    if (!networkPrefix) {
      return NextResponse.json({ success: false, error: 'Invalid service identifier' }, { status: 400 })
    }

    // Look up the API pricing rule for this plan
    const { data: rule } = await admin
      .from('api_pricing_rules')
      .select('plan_name, base_price, markup_type, markup_value')
      .eq('service_id', networkPrefix)
      .eq('plan_name', plan_id)
      .eq('is_active', true)
      .maybeSingle()

    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'Plan not found or not available for API users' },
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
      return NextResponse.json({ success: false, error: 'User account not found' }, { status: 404 })
    }

    const walletBalance = parseFloat(profile.wallet_balance || '0')
    if (walletBalance < apiPrice) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient wallet balance. Required: ₦${apiPrice.toLocaleString()}, Available: ₦${walletBalance.toLocaleString()}`,
        },
        { status: 402 }
      )
    }

    // Deduct from wallet atomically
    const deduction = await atomicDeductWallet(userId, apiPrice)
    if (!deduction.success) {
      return NextResponse.json({ success: false, error: deduction.error || 'Failed to deduct wallet' }, { status: 402 })
    }

    const transactionId = `V1-DATA-${uuidv4().toUpperCase().substring(0, 12)}`
    const balanceBefore = walletBalance
    const balanceAfter = deduction.newBalance ?? walletBalance - apiPrice

    // Purchase data via Gsubz
    let gsubzResult: { code: number; status: string; description: string; content?: unknown }
    try {
      gsubzResult = await buyData({
        serviceID: service,
        plan: plan_id,
        phone: phoneClean,
        requestID: transactionId,
      })
    } catch {
      // Refund on API failure
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
      await atomicRefundWallet(userId, apiPrice)
    }

    // Save transaction log
    await saveTransaction({
      userId,
      transactionId,
      category: 'DATA',
      serviceId: service,
      serviceName: `${networkPrefix.toUpperCase()} Data`,
      amount: apiPrice,
      phone: phoneClean,
      status: txStatus,
      description: `${rule.plan_name} data purchase via API`,
      balanceBefore,
      balanceAfter: purchased ? balanceAfter : balanceBefore,
      planDetails: rule.plan_name,
      apiResponse: gsubzResult as Record<string, unknown>,
    })

    if (!purchased) {
      return NextResponse.json(
        { success: false, error: gsubzResult.description || 'Purchase failed. Wallet has been refunded.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      plan: rule.plan_name,
      phone: phoneClean,
      amount: apiPrice,
      reference: transactionId,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
    })
  } catch (err) {
    console.error('[v1] /data/purchase error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
