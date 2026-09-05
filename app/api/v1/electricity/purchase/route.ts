import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { buyElectricityToken } from '@/lib/api/gsubz'
import { resolveProviderError } from '@/lib/utils/provider-error'
import { saveTransaction, atomicDeductWallet, atomicRefundWallet } from '@/lib/utils/save-transaction'
import { scheduleVerifyPending } from '@/lib/utils/schedule-verify'
import { logRequest } from '@/lib/api-logger'
import { checkRateLimit, RATE_LIMIT_CONFIG } from '@/lib/utils/rate-limit'
import { isGsubzSuccess, resolveElectricityServiceId } from '@/lib/api/gsubz-services'

/**
 * POST /api/v1/electricity/purchase
 *
 * Body: { disco: string, meter_type: string, meter_number: string, amount: number, phone: string }
 * Requires X-Connect-Key header.
 *
 * disco values: ikeja-electric, eko-electric, kano-electric, phed, jos-electric,
 *               ibadan-electric, kaduna-electric, abuja-electric, enugu-electric, benin-electric
 * meter_type values: PREPAID | POSTPAID
 * amount: minimum ₦1,100
 *
 * Deducts electricity payment from user's wallet and processes via Gsubz.
 * Rate limited: 50 requests per minute per API key
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)
  console.log(`[Electricity Purchase API] → POST | From: ${requestLog.ip}`)

  // Verify API key
  const auth = await verifyConnectKey(request)
  if (!auth.success) {
    const duration = Date.now() - startTime
    console.log(`[Electricity Purchase API] ✗ Auth failed: ${auth.error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: auth.error, error_code: 'UNAUTHORIZED' },
      { status: auth.status || 401 }
    )
  }

  const userId = auth.context!.userId
  const permissions = auth.context!.permissions ?? []

  // Electricity has no API markup. Access is controlled independently by admin.
  const admin = createAdminClient()
  const { data: electricityAccess, error: electricityAccessError } = await admin
    .from('api_service_settings')
    .select('enabled')
    .eq('service_id', 'api_electricity_enabled')
    .maybeSingle()

  if (electricityAccessError || !electricityAccess?.enabled) {
    return NextResponse.json(
      { success: false, error: 'Electricity API access is currently disabled', error_code: 'SERVICE_DISABLED' },
      { status: 503 }
    )
  }

  // Check rate limit per API key
  const { allowed, remaining } = await checkRateLimit(userId, RATE_LIMIT_CONFIG.V1_ELECTRICITY_PURCHASE)
  if (!allowed) {
    const duration = Date.now() - startTime
    console.log(`[Electricity Purchase API] ✗ Rate limit exceeded | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded (50 requests per minute)', error_code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  if (!permissions.includes('electricity') && !permissions.includes('all')) {
    const duration = Date.now() - startTime
    console.log(`[Electricity Purchase API] ✗ Permission denied for user: ${userId} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: 'This key does not have electricity payment permission', error_code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  let body: {
    disco?: string
    meter_type?: string
    meter_number?: string
    amount?: number
    phone?: string
  }
  try {
    body = await request.json()
  } catch {
    console.log(`[Electricity Purchase API] ✗ Invalid JSON body`)
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', error_code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  const { disco, meter_type, meter_number, amount, phone } = body

  if (!disco || !meter_type || !meter_number || !amount || !phone) {
    console.log(
      `[Electricity Purchase API] ✗ Missing fields: disco=${!!disco}, meter_type=${!!meter_type}, meter_number=${!!meter_number}, amount=${!!amount}, phone=${!!phone}`
    )
    return NextResponse.json(
      {
        success: false,
        error: 'Missing required fields: disco, meter_type, meter_number, amount, phone',
        error_code: 'MISSING_FIELDS',
      },
      { status: 400 }
    )
  }

  // Validate phone
  const phoneClean = String(phone).replace(/\s+/g, '')
  if (!/^(0|234|\+234)\d{10}$/.test(phoneClean) && !/^\d{11}$/.test(phoneClean)) {
    console.log(`[Electricity Purchase API] ✗ Invalid phone: ${phone}`)
    return NextResponse.json(
      { success: false, error: 'Invalid Nigerian phone number', error_code: 'INVALID_PHONE' },
      { status: 400 }
    )
  }

  // Validate amount
  const parsedAmount = Number(amount)
  if (isNaN(parsedAmount) || parsedAmount < 1100 || parsedAmount > 500000) {
    console.log(`[Electricity Purchase API] ✗ Invalid amount: ${amount}`)
    return NextResponse.json(
      { success: false, error: 'Amount must be between ₦1,100 and ₦500,000', error_code: 'INVALID_AMOUNT' },
      { status: 400 }
    )
  }

  // Validate meter type
  if (!['PREPAID', 'POSTPAID'].includes(meter_type.toUpperCase())) {
    console.log(`[Electricity Purchase API] ✗ Invalid meter_type: ${meter_type}`)
    return NextResponse.json(
      { success: false, error: 'meter_type must be PREPAID or POSTPAID', error_code: 'INVALID_METER_TYPE' },
      { status: 400 }
    )
  }

  try {
    const serviceID = resolveElectricityServiceId(disco)
    if (!serviceID) {
      return NextResponse.json(
        { success: false, error: 'Unsupported electricity provider', error_code: 'INVALID_PROVIDER' },
        { status: 400 }
      )
    }

    // Get user's wallet balance — electricity has no markup (charged at provider's rate)
    const { data: profile } = await admin
      .from('profiles')
      .select('wallet_balance, full_name, email')
      .eq('id', userId)
      .single()

    if (!profile) {
      console.log(`[Electricity Purchase API] ✗ User account not found: ${userId}`)
      return NextResponse.json(
        { success: false, error: 'User account not found', error_code: 'ACCOUNT_NOT_FOUND' },
        { status: 404 }
      )
    }

    const walletBalance = parseFloat(profile.wallet_balance || '0')
    if (walletBalance < parsedAmount) {
      console.log(`[Electricity Purchase API] ✗ Insufficient balance | Required: ₦${parsedAmount}, Available: ₦${walletBalance}`)
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

    console.log(`[Electricity Purchase API] → Processing: ${disco} | ₦${parsedAmount} | Meter: ${meter_number}`)

    // Deduct from wallet atomically
    const deduction = await atomicDeductWallet(userId, parsedAmount)
    if (!deduction.success) {
      console.log(`[Electricity Purchase API] ✗ Wallet deduction failed: ${deduction.error}`)
      return NextResponse.json(
        { success: false, error: deduction.error || 'Failed to deduct wallet', error_code: 'INSUFFICIENT_BALANCE' },
        { status: 402 }
      )
    }

    console.log(`[Electricity Purchase API] → Wallet deducted | New balance: ₦${deduction.newBalance}`)

    const transactionId = `V1-ELEC-${crypto.randomUUID().replace(/-/g, '').toUpperCase().substring(0, 12)}`
    const balanceAfter = deduction.newBalance ?? walletBalance - parsedAmount

    // Purchase electricity token via Gsubz
    let gsubzResult: Awaited<ReturnType<typeof buyElectricityToken>>
    try {
      console.log(`[Electricity Purchase API] → Calling Gsubz | Service: ${serviceID} | Amount: ₦${parsedAmount}`)
    gsubzResult = await buyElectricityToken({
      serviceID,
      phone: phoneClean,
      customerID: meter_number,
      amount: String(parsedAmount),
      variationCode: meter_type.toLowerCase() as 'prepaid' | 'postpaid',
    })
      console.log(`[Electricity Purchase API] → Gsubz response | Code: ${gsubzResult.code} | Status: ${gsubzResult.status}`)
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError'

      if (isTimeout) {
        // Timeout — provider may have processed it, so save as PENDING and verify in background.
        console.log(`[Electricity Purchase API] ✗ Timeout | Saving PENDING | TX: ${transactionId}`)

        await saveTransaction({
          userId,
          transactionId,
          category: 'ELECTRICITY',
          serviceId: serviceID,
          serviceName: 'Electricity',
          amount: parsedAmount,
          phone: phoneClean,
          status: 'PENDING',
          description: `${disco} electricity payment via API (PENDING verification)`,
          balanceBefore: walletBalance,
          balanceAfter: balanceAfter,
        })

        scheduleVerifyPending({
          requestID: transactionId,
          userId,
          amount: parsedAmount,
          balanceBefore: walletBalance,
          category: 'ELECTRICITY',
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
      console.log(`[Electricity Purchase API] ✗ Gsubz API error: ${err}`)
      await atomicRefundWallet(userId, parsedAmount)
      return NextResponse.json(
        {
          success: false,
          error: 'Electricity provider error. Your wallet has been refunded.',
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
        category: 'ELECTRICITY',
        serviceId: serviceID,
        serviceName: 'Electricity',
        amount: parsedAmount,
        phone: meter_number,
        status: 'SUCCESS',
        description: `${disco} electricity payment via API`,
        balanceBefore: walletBalance,
        balanceAfter: balanceAfter,
        apiResponse: gsubzResult,
      })

      const duration = Date.now() - startTime
      console.log(
        `[Electricity Purchase API] ✓ SUCCESS | TX: ${finalTransactionId} | Amount: ₦${parsedAmount} | Duration: ${duration}ms`
      )

      return NextResponse.json(
        {
          success: true,
          transaction_id: finalTransactionId,
          amount: parsedAmount,
          token: gsubzResult.token ?? null,
          balance_after: balanceAfter,
          status: 'SUCCESS',
          message: 'Electricity payment successful',
        },
        { status: 200 }
      )
    }

    // Transaction failed from provider — refund and save failed transaction
    const resolved = resolveProviderError(gsubzResult)
    console.log(`[Electricity Purchase API] ✗ FAILED | Provider response: ${gsubzResult.status} | Code: ${resolved.code}`)

    await atomicRefundWallet(userId, parsedAmount)

    await saveTransaction({
      userId,
      transactionId,
      category: 'ELECTRICITY',
      serviceId: serviceID,
      serviceName: 'Electricity',
      amount: parsedAmount,
      phone: phoneClean,
      status: 'FAILED',
      description: `${disco} electricity payment failed · ${resolved.message}`,
      balanceBefore: walletBalance,
      balanceAfter: walletBalance,
    })

    return NextResponse.json(
      {
        success: false,
        error: resolved.message || 'Electricity payment failed',
        error_code: resolved.code,
        transaction_id: transactionId,
        refunded: true,
        balance_after: walletBalance,
      },
      { status: 400 }
    )
  } catch (err) {
    console.error(`[Electricity Purchase API] ✗ Unexpected error:`, err)
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
