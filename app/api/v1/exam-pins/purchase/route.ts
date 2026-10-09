import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { checkRateLimit, RATE_LIMIT_CONFIG } from '@/lib/utils/rate-limit'
import { logRequest } from '@/lib/api-logger'
import { purchaseExamPin } from '@/lib/actions/exam-pins'

/**
 * POST /api/v1/exam-pins/purchase
 *
 * Body: { board: string, phone: string }
 * Requires X-Connect-Key header.
 *
 * board values: waec | neco | nabteb
 *
 * The price comes from the admin API pricing page (api_pricing_rules), not the
 * dashboard markup. Rate limited: 50 requests per minute per API key.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)
  console.log(`[Exam Pins API] → POST /api/v1/exam-pins/purchase | From: ${requestLog.ip}`)

  const auth = await verifyConnectKey(request)
  if (!auth.success) {
    console.log(`[Exam Pins API] ✗ Auth failed: ${auth.error} | ${Date.now() - startTime}ms`)
    return NextResponse.json(
      { success: false, error: auth.error, error_code: 'UNAUTHORIZED' },
      { status: auth.status || 401 }
    )
  }

  const userId = auth.context!.userId
  const permissions = auth.context!.permissions ?? []

  const { allowed, remaining } = await checkRateLimit(userId, RATE_LIMIT_CONFIG.V1_EXAM_PINS_PURCHASE)
  if (!allowed) {
    console.log(`[Exam Pins API] ✗ Rate limit exceeded | ${Date.now() - startTime}ms`)
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded (50 requests per minute)', error_code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  if (!permissions.includes('exam-pins') && !permissions.includes('all')) {
    console.log(`[Exam Pins API] ✗ Permission denied for user: ${userId} | ${Date.now() - startTime}ms`)
    return NextResponse.json(
      { success: false, error: 'This key does not have exam pin purchase permission', error_code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  let body: { board?: string; phone?: string }
  try {
    body = await request.json()
  } catch {
    console.log(`[Exam Pins API] ✗ Invalid JSON body`)
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', error_code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  const { board, phone } = body
  if (!board || !phone) {
    console.log(`[Exam Pins API] ✗ Missing fields: board=${!!board}, phone=${!!phone}`)
    return NextResponse.json(
      { success: false, error: 'Missing required fields: board, phone', error_code: 'MISSING_FIELDS' },
      { status: 400 }
    )
  }

  const formData = new FormData()
  formData.set('board', String(board))
  formData.set('phone', String(phone))

  const result = await purchaseExamPin(formData, userId, true)

  if (result.success) {
    console.log(
      `[Exam Pins API] ✓ SUCCESS | TX: ${result.transaction?.id} | User: ${userId} | ${Date.now() - startTime}ms`
    )
    return NextResponse.json({
      success: true,
      transaction_id: result.transaction?.id,
      board: String(board).toLowerCase(),
      phone: String(phone),
      amount: result.transaction?.amount,
      pin: result.transaction?.pin ?? null,
      balance_after: result.transaction?.balance,
      status: 'SUCCESS',
      message: result.message,
      remaining,
    })
  }

  if (result.pending) {
    console.log(`[Exam Pins API] ⏳ PENDING | TX: ${result.transaction?.id}`)
    return NextResponse.json({
      success: false,
      pending: true,
      error: result.message,
      error_code: 'TIMEOUT_PENDING_VERIFICATION',
      transaction_id: result.transaction?.id,
    })
  }

  console.log(`[Exam Pins API] ✗ FAILED | ${result.message}`)
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
