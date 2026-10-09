import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { checkRateLimit, RATE_LIMIT_CONFIG } from '@/lib/utils/rate-limit'
import { logRequest } from '@/lib/api-logger'
import { purchaseSocial } from '@/lib/actions/social'

/**
 * POST /api/v1/social/purchase
 *
 * Body: { service: string, link: string, quantity: number }
 * Requires X-Connect-Key header.
 *
 * `service` is the value from the social catalogue. The unit price comes from
 * the admin API pricing page (api_pricing_rules), not the dashboard markup.
 * Rate limited: 50 requests per minute per API key.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)
  console.log(`[Social API] → POST /api/v1/social/purchase | From: ${requestLog.ip}`)

  const auth = await verifyConnectKey(request)
  if (!auth.success) {
    console.log(`[Social API] ✗ Auth failed: ${auth.error} | ${Date.now() - startTime}ms`)
    return NextResponse.json(
      { success: false, error: auth.error, error_code: 'UNAUTHORIZED' },
      { status: auth.status || 401 }
    )
  }

  const userId = auth.context!.userId
  const permissions = auth.context!.permissions ?? []

  const { allowed, remaining } = await checkRateLimit(userId, RATE_LIMIT_CONFIG.V1_SOCIAL_PURCHASE)
  if (!allowed) {
    console.log(`[Social API] ✗ Rate limit exceeded | ${Date.now() - startTime}ms`)
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded (50 requests per minute)', error_code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  if (!permissions.includes('social') && !permissions.includes('all')) {
    console.log(`[Social API] ✗ Permission denied for user: ${userId} | ${Date.now() - startTime}ms`)
    return NextResponse.json(
      { success: false, error: 'This key does not have social media order permission', error_code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  let body: { service?: string; link?: string; quantity?: number }
  try {
    body = await request.json()
  } catch {
    console.log(`[Social API] ✗ Invalid JSON body`)
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', error_code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  const { service, link, quantity } = body
  if (!service || !link || quantity === undefined || quantity === null) {
    console.log(`[Social API] ✗ Missing fields: service=${!!service}, link=${!!link}, quantity=${quantity}`)
    return NextResponse.json(
      { success: false, error: 'Missing required fields: service, link, quantity', error_code: 'MISSING_FIELDS' },
      { status: 400 }
    )
  }

  const formData = new FormData()
  formData.set('service', String(service))
  formData.set('link', String(link))
  formData.set('quantity', String(quantity))

  const result = await purchaseSocial(formData, userId, true)

  if (result.success) {
    console.log(
      `[Social API] ✓ SUCCESS | TX: ${result.transaction?.id} | User: ${userId} | ${Date.now() - startTime}ms`
    )
    return NextResponse.json({
      success: true,
      transaction_id: result.transaction?.id,
      service: String(service),
      link: String(link),
      quantity: Number(quantity),
      amount: result.transaction?.amount,
      balance_after: result.transaction?.balance,
      status: 'SUCCESS',
      message: result.message,
      remaining,
    })
  }

  if (result.pending) {
    console.log(`[Social API] ⏳ PENDING | TX: ${result.transaction?.id}`)
    return NextResponse.json({
      success: false,
      pending: true,
      error: result.message,
      error_code: 'TIMEOUT_PENDING_VERIFICATION',
      transaction_id: result.transaction?.id,
    })
  }

  console.log(`[Social API] ✗ FAILED | ${result.message}`)
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
