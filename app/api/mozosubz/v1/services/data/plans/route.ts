import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createServerClient } from '@/lib/supabase/server'
import { fetchDataPlans } from '@/lib/actions/data'

/**
 * POST /api/mozosubz/v1/services/data/plans
 * 
 * Get available data plans
 * Requires: X-Connect-Key header
 */
export async function POST(request: NextRequest) {
  try {
    // Verify Connect Key
    const keyVerification = await verifyConnectKey(request)
    if (!keyVerification.success) {
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    const body = await request.json()
    const { serviceID } = body

    if (!serviceID) {
      return NextResponse.json(
        { success: false, error: 'serviceID is required' },
        { status: 400 },
      )
    }

    // Call existing service action
    const result = await fetchDataPlans(serviceID)

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    })
  } catch (error) {
    console.error('[v0] Mozosubz data plans error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
