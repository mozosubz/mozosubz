import { NextResponse } from 'next/server'
import { BACHS_BASE_URL, BACHS_SECRET_KEY, BACHS_WEBHOOK_SECRET } from '@/lib/api/bachs-config'

/**
 * GET /api/debug/monnify-credentials
 *
 * Presence report for the payment env vars the /debug/monnify page renders.
 * Only booleans — never a key or a prefix — so it is safe to leave public.
 */
export async function GET() {
  return NextResponse.json({
    secretKey: BACHS_SECRET_KEY.trim().length > 0,
    apiKey: BACHS_SECRET_KEY.trim().length > 0,
    contractCode: BACHS_WEBHOOK_SECRET.trim().length > 0,
    baseUrl: BACHS_BASE_URL,
    webhookSecret: BACHS_WEBHOOK_SECRET.trim().length > 0,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
