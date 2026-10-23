import { NextResponse } from 'next/server'
import { BACHS_BASE_URL, BACHS_SECRET_KEY, BACHS_WEBHOOK_SECRET } from '@/lib/api/bachs-config'

/**
 * POST /api/debug/test-monnify-auth
 *
 * Round-trips a harmless authenticated read against the Bachs API so the
 * /debug/monnify page can prove the configured key works from this deployment.
 * The response carries only status codes and provider messages, never secrets.
 */
export async function POST() {
  if (!BACHS_SECRET_KEY) {
    return NextResponse.json({ ok: false, error: 'BACHS_SECRET_KEY is missing' }, { status: 500 })
  }
  if (!BACHS_WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, error: 'BACHS_WEBHOOK_SECRET is missing — webhooks will be rejected' },
      { status: 500 }
    )
  }

  const startedAt = Date.now()
  try {
    const response = await fetch(`${BACHS_BASE_URL}/v1/payments?limit=1`, {
      headers: { Authorization: `Bearer ${BACHS_SECRET_KEY}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    const body = (await response.json().catch(() => null)) as
      | { message?: string; error?: { message?: string } }
      | null
    const message = body?.error?.message || body?.message || null

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      message,
      baseUrl: BACHS_BASE_URL,
      latencyMs: Date.now() - startedAt,
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Request failed',
      baseUrl: BACHS_BASE_URL,
      latencyMs: Date.now() - startedAt,
    }, { status: 502 })
  }
}
