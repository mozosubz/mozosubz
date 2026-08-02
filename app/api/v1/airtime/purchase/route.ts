import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { buyAirtime } from '@/lib/api/gsubz'
import { resolveProviderError } from '@/lib/utils/provider-error'
import { saveTransaction, atomicDeductWallet, atomicRefundWallet } from '@/lib/utils/save-transaction'
import { scheduleVerifyPending } from '@/lib/utils/schedule-verify'
import { logRequestWithBody, logResponse, formatLog } from '@/lib/api-logger'
import { checkRateLimit, RATE_LIMIT_CONFIG } from '@/lib/utils/rate-limit'

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
 * Rate limited: 50 requests per minute per API key
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
      { success: false, error: auth.error, error_code: 'UNAUTHORIZED' },
      { status: auth.status || 401 }
    )
  }

  const userId = auth.context!.userId
  const permissions = auth.context!.permissions ?? []

  // Check rate limit per API key
  const { allowed, remaining } = await checkRateLimit(userId, RATE_LIMIT_CONFIG.V1_AIRTIME_PURCHASE)
  if (!allowed) {
    const duration = Date.now() - startTime
    console.log(`[Airtime API] ✗ Rate limit exceeded | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded (50 requests per minute)', error_code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  if (!permissions.includes('airtime') && !permissions.includes('all')) {
    const duration = Date.now() - startTime
    console.log(`[Airtime API] ✗ Permission denied for user: ${userId} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: 'This key does not have airtime purchase permission', error_code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  let body: { network?: string; amount?: number; phone?: string }
  try {
    body = await request.json()
  } catch {
    console.log(`[Airtime API] ✗ Invalid JSON body`)
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', error_code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  const { network, amount, phone } = body

  if (!network || !amount || !phone) {
    console.log(`[Airtime API] ✗ Missing fields: network=${!!network}, amount=${!!amount}, phone=${!!phone}`)
    return NextResponse.json(
      { success: false, error: 'Missing required fields: network, amount, phone', error_code: 'MISSING_FIELDS' },
      { status: 400 }
    )
  }

  const VALID_NETWORKS = ['mtn', 'glo', 'airtel', 'etisalat']
  const networkLower = String(network).toLowerCase()
  if (!VALID_NETWORKS.includes(networkLower)) {
    console.log(`[Airtime API] ✗ Invalid network: ${network}`)
    return NextResponse.json(
      { success: false, error: `Invalid network. Must be one of: ${VALID_NETWORKS.join(', ')}`, error_code: 'INVALID_NETWORK' },
      { status: 400 }
    )
  }

  const parsedAmount = parseFloat(String(amount))
  if (isNaN(parsedAmount) || parsedAmount < 50) {
    console.log(`[Airtime API] ✗ Invalid amount: ${amount}`)
    return NextResponse.json(
      { success: false, error: 'Amount must be at least ₦50', error_code: 'INVALID_AMOUNT' },
      { status: 400 }
    )
  }

  // Validate phone
  const phoneClean = String(phone).replace(/\s+/g, '')
  if (!/^(0|234|\+234)\d{10}$/.test(phoneClean) && !/^\d{11}$/.test(phoneClean)) {
    console.log(`[Airtime API] ✗ Invalid phone: ${phone}`)
    return NextResponse.json(
      { success: false, error: 'Invalid Nigerian phone number', error_code: 'INVALID_PHONE' },
      { status: 400 }
    )
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
      return NextResponse.json(
        { success: false, error: 'User account not found', error_code: 'ACCOUNT_NOT_FOUND' },
        { status: 404 }
      )
    }

    const walletBalance = parseFloat(profile.wallet_balance || '0')
    if (walletBalance < parsedAmount) {
      console.log(`[Airtime API] ✗ Insufficient balance | Required: ₦${parsedAmount}, Available: ₦${walletBalance}`)
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient wallet balance. Required: ₦${parsedAmount.toLocaleString()}, Available: ₦${walletBalance.toLocaleString()}`,
          error_code: 'INSUFFICIENT_BALANCE',
          required: parsedAmount,
          balance_after: walletBalance,
        },
        { status: 402 }
      )
    }

    console.log(`[Airtime API] → Processing: ${networkLower} | ₦${parsedAmount} | Phone: ${phoneClean}`)

    // Deduct from wallet atomically
    const deduction = await atomicDeductWallet(userId, parsedAmount)
    if (!deduction.success) {
      console.log(`[Airtime API] ✗ Wallet deduction failed: ${deduction.error}`)
      return NextResponse.json(
        { success: false, error: deduction.error || 'Failed to deduct wallet', error_code: 'INSUFFICIENT_BALANCE' },
        { status: 402 }
      )
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
    // Type comes from buyAirtime's return — see lib/api/gsubz.ts for the full shape.
    let gsubzResult: Awaited<ReturnType<typeof buyAirtime>>
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
      const isTimeout = err instanceof Error && err.name === 'AbortError'

      if (isTimeout) {
        // Timeout — provider may have processed it, so save as PENDING and verify in background.
        // The wallet was already deducted; if verification confirms failure, we refund.
        console.log(`[Airtime API] ✗ Timeout | Saving PENDING | TX: ${transactionId}`)

        await saveTransaction({
          userId,
          transactionId,
          category: 'AIRTIME',
          serviceId,
          serviceName: `${networkLower.toUpperCase()} Airtime`,
          amount: parsedAmount,
          phone: phoneClean,
          status: 'PENDING',
          description: `₦${parsedAmount.toLocaleString()} ${networkLower.toUpperCase()} airtime via API (PENDING verification)`,
          balanceBefore: walletBalance,
          balanceAfter: balanceAfter,
        })

        scheduleVerifyPending({
          requestID: transactionId,
          userId,
          amount: parsedAmount,
          balanceBefore: walletBalance,
          category: 'AIRTIME',
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
      console.log(`[Airtime API] ✗ Gsubz API error: ${err}`)
      await atomicRefundWallet(userId, parsedAmount)
      return NextResponse.json(
        {
          success: false,
          error: 'Airtime provider error. Your wallet has been refunded.',
          error_code: 'PROVIDER_UNREACHABLE',
          transaction_id: transactionId,
          refunded: true,
          balance_after: walletBalance,
        },
        { status: 502 }
      )
    }

    // Gsubz can return HTTP 200 with status "failed" — same bug as the data route.
    // Must check both code AND status to determine a real success.
    const purchased =
      gsubzResult.code === 200 &&
      gsubzResult.status?.toLowerCase() !== 'failed' &&
      gsubzResult.status?.toLowerCase() !== 'error'
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
      apiResponse: gsubzResult as unknown as Record<string, unknown>,
    })

    if (!purchased) {
      const resolved = resolveProviderError(gsubzResult, { refunded: true })
      console.log(
        `[Airtime API] ✗ Final: Purchase failed, wallet refunded | ${resolved.code} | Gsubz: ${resolved.providerMessage}`
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
    console.log(`[Airtime API] ✓ SUCCESS | TX: ${transactionId} | User: ${userId} | ₦${parsedAmount} | ${duration}ms`)
    
    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      network: networkLower.toUpperCase(),
      phone: phoneClean,
      amount: parsedAmount,
      balance_after: balanceAfter,
      remaining,
    })
  } catch (err) {
    const duration = Date.now() - startTime
    console.error(`[Airtime API] ✗ ERROR: ${err} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
