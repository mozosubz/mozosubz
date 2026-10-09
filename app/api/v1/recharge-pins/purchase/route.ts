import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { checkRateLimit, RATE_LIMIT_CONFIG } from '@/lib/utils/rate-limit'
import { logRequest } from '@/lib/api-logger'
import { generateRechargePins } from '@/lib/actions/recharge-pins'

/**
 * POST /api/v1/recharge-pins/purchase
 *
 * Body: { network: string, value: number, number: number }
 * Requires X-Connect-Key header.
 *
 * network values: mtn | glo | airtel | 9mobile
 * value: pin denomination (100 | 200 | 400 | 500)
 * number: quantity (1–50)
 *
 * Pins are charged at face value plus the markup set on the admin API pricing
 * page, which also controls whether the service is enabled for API users.
 * Rate limited: 50 requests per minute per API key.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)
  console.log(`[Recharge Pins API] → POST /api/v1/recharge-pins/purchase | From: ${requestLog.ip}`)

  const auth = await verifyConnectKey(request)
  if (!auth.success) {
    console.log(`[Recharge Pins API] ✗ Auth failed: ${auth.error} | ${Date.now() - startTime}ms`)
    return NextResponse.json(
      { success: false, error: auth.error, error_code: 'UNAUTHORIZED' },
      { status: auth.status || 401 }
    )
  }

  const userId = auth.context!.userId
  const permissions = auth.context!.permissions ?? []

  const { allowed, remaining } = await checkRateLimit(userId, RATE_LIMIT_CONFIG.V1_RECHARGE_PINS_PURCHASE)
  if (!allowed) {
    console.log(`[Recharge Pins API] ✗ Rate limit exceeded | ${Date.now() - startTime}ms`)
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded (50 requests per minute)', error_code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  if (!permissions.includes('recharge-pins') && !permissions.includes('all')) {
    console.log(`[Recharge Pins API] ✗ Permission denied for user: ${userId} | ${Date.now() - startTime}ms`)
    return NextResponse.json(
      { success: false, error: 'This key does not have recharge pin permission', error_code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  let body: { network?: string; value?: string | number; number?: string | number }
  try {
    body = await request.json()
  } catch {
    console.log(`[Recharge Pins API] ✗ Invalid JSON body`)
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', error_code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  const { network, value, number } = body
  if (!network || value === undefined || value === null || number === undefined || number === null) {
    console.log(`[Recharge Pins API] ✗ Missing fields: network=${!!network}, value=${value}, number=${number}`)
    return NextResponse.json(
      { success: false, error: 'Missing required fields: network, value, number', error_code: 'MISSING_FIELDS' },
      { status: 400 }
    )
  }

  const result = await generateRechargePins(
    { network: String(network), value: String(value), number: String(number) },
    userId,
    undefined,
    true,
  )

  if (result.success) {
    console.log(
      `[Recharge Pins API] ✓ SUCCESS | TX: ${result.transactionId} | User: ${userId} | ${Date.now() - startTime}ms`
    )
    return NextResponse.json({
      success: true,
      transaction_id: result.transactionId,
      network: String(network).toUpperCase(),
      value: Number(value),
      quantity: Number(number),
      pins: result.pins,
      amount: Number(value) * Number(number),
      status: 'SUCCESS',
      message: result.message,
      remaining,
    })
  }

  console.log(`[Recharge Pins API] ✗ FAILED | ${result.error}`)
  const status = result.errorCode === 'SERVICE_DISABLED' ? 503 : 400
  return NextResponse.json(
    { success: false, error: result.error, error_code: result.errorCode || 'PURCHASE_FAILED' },
    { status }
  )
}
