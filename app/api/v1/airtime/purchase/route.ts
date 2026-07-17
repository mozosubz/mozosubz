import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { buyAirtime } from '@/lib/api/gsubz'
import { saveTransaction, atomicDeductWallet, atomicRefundWallet } from '@/lib/utils/save-transaction'
import { logRequestWithBody, logResponse, formatLog } from '@/lib/api-logger'

/**
 * POST /api/v1/airtime/purchase
 *
 * Body: { network: string, amount: number, phone: string }
 * Requires X-Connect-Key header.
 *
 * network values: mtn | glo | airtel | etisalat
 * amount: minimum ₦50
 *
 * Airtime has no markup — the user is charged exactly the amount they specify.
 * The wallet is deducted and airtime is purchased via Gsubz.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = await logRequestWithBody(request)
  console.log(`[Airtime API] → POST /api/v1/airtime/purchase | From: ${requestLog.ip}`)

  // Verify API key
  const auth = await verifyConnectKey(request)
  if (!auth.success) {
    const duration = Date.now() - startTime
    console.log(`[Airtime API] ✗ Auth failed: ${auth.error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status || 401 }
    )
  }

  const userId = auth.context!.userId
  const permissions = auth.context!.permissions ?? []

  if (!permissions.includes('airtime') && !permissions.includes('all')) {
    const duration = Date.now() - startTime
    console.log(`[Airtime API] ✗ Permission denied for user: ${userId} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: 'This key does not have airtime purchase permission' },
      { status: 403 }
    )
  }

  let body: { network?: string; amount?: number; phone?: string }
  try {
    body = await request.json()
  } catch {
    console.log(`[Airtime API] ✗ Invalid JSON body`)
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { network, amount, phone } = body

  if (!network || !amount || !phone) {
    console.log(`[Airtime API] ✗ Missing fields: network=${!!network}, amount=${!!amount}, phone=${!!phone}`)
    return NextResponse.json(
      { success: false, error: 'Missing required fields: network, amount, phone' },
      { status: 400 }
    )
  }

  const VALID_NETWORKS = ['mtn', 'glo', 'airtel', 'etisalat']
  const networkLower = String(network).toLowerCase()
  if (!VALID_NETWORKS.includes(networkLower)) {
    console.log(`[Airtime API] ✗ Invalid network: ${network}`)
    return NextResponse.json(
      { success: false, error: `Invalid network. Must be one of: ${VALID_NETWORKS.join(', ')}` },
      { status: 400 }
    )
  }

  const parsedAmount = parseFloat(String(amount))
  if (isNaN(parsedAmount) || parsedAmount < 50) {
    console.log(`[Airtime API] ✗ Invalid amount: ${amount}`)
    return NextResponse.json(
      { success: false, error: 'Amount must be at least ₦50' },
      { status: 400 }
    )
  }

  // Validate phone
  const phoneClean = String(phone).replace(/\s+/g, '')
  if (!/^(0|234|\+234)\d{10}$/.test(phoneClean) && !/^\d{11}$/.test(phoneClean)) {
    console.log(`[Airtime API] ✗ Invalid phone: ${phone}`)
    return NextResponse.json({ success: false, error: 'Invalid Nigerian phone number' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    // Get user's wallet balance
    const { data: profile } = await admin
      .from('profiles')
      .select('wallet_balance, full_name')
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json({ success: false, error: 'User account not found' }, { status: 404 })
    }

    const walletBalance = parseFloat(profile.wallet_balance || '0')
    if (walletBalance < parsedAmount) {
      console.log(`[Airtime API] ✗ Insufficient balance | Required: ₦${parsedAmount}, Available: ₦${walletBalance}`)
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient wallet balance. Required: ₦${parsedAmount.toLocaleString()}, Available: ₦${walletBalance.toLocaleString()}`,
        },
        { status: 402 }
      )
    }

    console.log(`[Airtime API] → Processing: ${networkLower} | ₦${parsedAmount} | Phone: ${phoneClean}`)

    // Deduct from wallet atomically
    const deduction = await atomicDeductWallet(userId, parsedAmount)
    if (!deduction.success) {
      console.log(`[Airtime API] ✗ Wallet deduction failed: ${deduction.error}`)
      return NextResponse.json({ success: false, error: deduction.error || 'Failed to deduct wallet' }, { status: 402 })
    }

    console.log(`[Airtime API] → Wallet deducted | New balance: ₦${deduction.newBalance}`)

    const transactionId = `V1-AIR-${crypto.randomUUID().replace(/-/g, '').toUpperCase().substring(0, 12)}`
    const balanceAfter = deduction.newBalance ?? walletBalance - parsedAmount

    // Map network to Gsubz service ID (must match lib/actions/airtime.ts exactly)
    const serviceIdMap: Record<string, string> = {
      mtn: 'mtn',
      airtel: 'airtel',
      glo: 'glo',
      etisalat: 'etisalat',
    }
    const serviceId = serviceIdMap[networkLower]

    // Purchase airtime via Gsubz
    let gsubzResult: { code: number; status: string; description: string; content?: unknown }
    try {
      console.log(`[Airtime API] → Calling Gsubz | Service: ${serviceId}`)
      gsubzResult = await buyAirtime({
        serviceID: serviceId,
        amount: String(parsedAmount),
        phone: phoneClean,
        requestID: transactionId,
      })
      console.log(`[Airtime API] → Gsubz response | Code: ${gsubzResult.code} | Status: ${gsubzResult.status}`)
    } catch (err) {
      // Refund on API failure
      console.log(`[Airtime API] ✗ Gsubz API error: ${err}`)
      await atomicRefundWallet(userId, parsedAmount)
      return NextResponse.json(
        { success: false, error: 'Airtime provider error. Your wallet has been refunded.' },
        { status: 502 }
      )
    }

    const purchased = gsubzResult.code === 200
    const txStatus = purchased ? 'SUCCESS' : 'FAILED'

    // Refund if Gsubz failed
    if (!purchased) {
      console.log(`[Airtime API] ✗ Purchase failed from Gsubz: ${gsubzResult.description}`)
      await atomicRefundWallet(userId, parsedAmount)
    }

    // Save transaction log
    await saveTransaction({
      userId,
      transactionId,
      category: 'AIRTIME',
      serviceId,
      serviceName: `${networkLower.toUpperCase()} Airtime`,
      amount: parsedAmount,
      phone: phoneClean,
      status: txStatus,
      description: `₦${parsedAmount.toLocaleString()} ${networkLower.toUpperCase()} airtime via API`,
      balanceBefore: walletBalance,
      balanceAfter: purchased ? balanceAfter : walletBalance,
      apiResponse: gsubzResult as Record<string, unknown>,
    })

    if (!purchased) {
      console.log(`[Airtime API] ✗ Final: Purchase failed, wallet refunded`)
      return NextResponse.json(
        { success: false, error: gsubzResult.description || 'Purchase failed. Wallet has been refunded.' },
        { status: 400 }
      )
    }

    const duration = Date.now() - startTime
    console.log(`[Airtime API] ✓ SUCCESS | TX: ${transactionId} | User: ${userId} | ₦${parsedAmount} | ${duration}ms`)
    
    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      network: networkLower.toUpperCase(),
      phone: phoneClean,
      amount: parsedAmount,
      balance_after: balanceAfter,
    })
  } catch (err) {
    const duration = Date.now() - startTime
    console.error(`[Airtime API] ✗ ERROR: ${err} | ${duration}ms`)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
