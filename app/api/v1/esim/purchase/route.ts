import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { checkRateLimit, RATE_LIMIT_CONFIG } from '@/lib/utils/rate-limit'
import { logRequest } from '@/lib/api-logger'
import { purchaseEsim } from '@/lib/actions/esim'

/**
 * POST /api/v1/esim/purchase
 *
 * Body: { package_code: string, location_code: string }
 * Requires X-Connect-Key header.
 *
 * The price comes from the admin API pricing page (api_pricing_rules), not the
 * dashboard markup. Activation is asynchronous — poll the dashboard for the
 * QR code. Rate limited: 50 requests per minute per API key.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)
  console.log(`[eSIM API] → POST /api/v1/esim/purchase | From: ${requestLog.ip}`)

  const auth = await verifyConnectKey(request)
  if (!auth.success) {
    console.log(`[eSIM API] ✗ Auth failed: ${auth.error} | ${Date.now() - startTime}ms`)
    return NextResponse.json(
      { success: false, error: auth.error, error_code: 'UNAUTHORIZED' },
      { status: auth.status || 401 }
    )
  }

  const userId = auth.context!.userId
  const permissions = auth.context!.permissions ?? []

  const { allowed, remaining } = await checkRateLimit(userId, RATE_LIMIT_CONFIG.V1_ESIM_PURCHASE)
  if (!allowed) {
    console.log(`[eSIM API] ✗ Rate limit exceeded | ${Date.now() - startTime}ms`)
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded (50 requests per minute)', error_code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  if (!permissions.includes('esim') && !permissions.includes('all')) {
    console.log(`[eSIM API] ✗ Permission denied for user: ${userId} | ${Date.now() - startTime}ms`)
    return NextResponse.json(
      { success: false, error: 'This key does not have eSIM purchase permission', error_code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  let body: { package_code?: string; location_code?: string }
  try {
    body = await request.json()
  } catch {
    console.log(`[eSIM API] ✗ Invalid JSON body`)
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', error_code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  const { package_code, location_code } = body
  if (!package_code || !location_code) {
    console.log(`[eSIM API] ✗ Missing fields: package_code=${!!package_code}, location_code=${!!location_code}`)
    return NextResponse.json(
      { success: false, error: 'Missing required fields: package_code, location_code', error_code: 'MISSING_FIELDS' },
      { status: 400 }
    )
  }

  const formData = new FormData()
  formData.set('packageCode', String(package_code))
  formData.set('locationCode', String(location_code))

  const result = await purchaseEsim(formData, userId, true)

  if (result.success) {
    console.log(
      `[eSIM API] ✓ SUCCESS | TX: ${result.transaction?.id} | User: ${userId} | ${Date.now() - startTime}ms`
    )
    return NextResponse.json({
      success: true,
      transaction_id: result.transaction?.id,
      package_code: String(package_code),
      location_code: String(location_code),
      amount: result.transaction?.amount,
      balance_after: result.transaction?.balance,
      status: 'SUCCESS',
      message: result.message,
      remaining,
    })
  }

  if (result.pending) {
    console.log(`[eSIM API] ⏳ PENDING | TX: ${result.transaction?.id}`)
    return NextResponse.json({
      success: false,
      pending: true,
      error: result.message,
      error_code: 'TIMEOUT_PENDING_VERIFICATION',
      transaction_id: result.transaction?.id,
    })
  }

  console.log(`[eSIM API] ✗ FAILED | ${result.message}`)
  const status = result.errorCode === 'PLAN_NOT_ENABLED' ? 404 : 400
  return NextResponse.json(
    {
      success: false,
      error: result.message,
      error_code: result.errorCode || 'PURCHASE_FAILED',
      transaction_id: result.transaction?.id,
      balance_after: result.transaction?.balance,
    },
    { status }
  )
}
