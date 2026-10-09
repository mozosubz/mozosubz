import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { checkRateLimit, RATE_LIMIT_CONFIG } from '@/lib/utils/rate-limit'
import { logRequest } from '@/lib/api-logger'
import { sendBulkSms } from '@/lib/actions/bulk-sms'

/**
 * POST /api/v1/bulk-sms/purchase
 *
 * Body: { from: string, to: string | string[], msg: string }
 * Requires X-Connect-Key header.
 *
 * `from` is the 3–11 letter sender ID, `to` is one or more recipient numbers
 * (array or comma/space separated string). The price is the per-page rate plus
 * the bulk-sms markup set on the admin API pricing page, which also controls
 * whether the service is enabled for API users.
 * Rate limited: 50 requests per minute per API key.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)

  const auth = await verifyConnectKey(request)
  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: auth.error, error_code: 'UNAUTHORIZED' },
      { status: auth.status || 401 }
    )
  }

  const userId = auth.context!.userId
  const permissions = auth.context!.permissions ?? []

  const { allowed, remaining } = await checkRateLimit(userId, RATE_LIMIT_CONFIG.V1_BULK_SMS_PURCHASE)
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded (50 requests per minute)', error_code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  if (!permissions.includes('bulk-sms') && !permissions.includes('all')) {
    return NextResponse.json(
      { success: false, error: 'This key does not have bulk SMS permission', error_code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  let body: { from?: string; to?: string | string[]; msg?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', error_code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  const { from, to, msg } = body
  if (!from || !to || !msg) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: from, to, msg', error_code: 'MISSING_FIELDS' },
      { status: 400 }
    )
  }

  const toValue = Array.isArray(to) ? to.join(',') : String(to)
  const recipientCount = Array.isArray(to)
    ? to.length
    : String(to).split(/[\s,;]+/).filter(Boolean).length

  const formData = new FormData()
  formData.set('from', String(from))
  formData.set('to', toValue)
  formData.set('msg', String(msg))

  const result = await sendBulkSms(formData, userId, true)

  if (result.success) {
    return NextResponse.json({
      success: true,
      transaction_id: result.transaction?.id,
      sender: String(from),
      recipients: recipientCount,
      amount: result.transaction?.amount,
      balance_after: result.transaction?.balance,
      status: 'SUCCESS',
      message: result.message,
      remaining,
    })
  }

  if (result.pending) {
    return NextResponse.json({
      success: false,
      pending: true,
      error: result.message,
      error_code: 'TIMEOUT_PENDING_VERIFICATION',
      transaction_id: result.transaction?.id,
    })
  }

  const status = result.errorCode === 'SERVICE_DISABLED' ? 503 : 400
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
