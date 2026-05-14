import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { fetchCablePlans } from '@/lib/actions/cable'

/**
 * POST /api/mozosubz/v1/services/cable/plans
 */
export async function POST(request: NextRequest) {
  try {
    const keyVerification = await verifyConnectKey(request)
    if (!keyVerification.success) {
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    const result = await fetchCablePlans()
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('[v0] Mozosubz cable plans error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
