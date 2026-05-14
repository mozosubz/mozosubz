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
  console.log('[MOZOSUBZ-V1-DATA-PLANS] Request started')
  try {
    // Verify Connect Key
    console.log('[MOZOSUBZ-V1-DATA-PLANS] Verifying connect key...')
    const keyVerification = await verifyConnectKey(request)
    console.log('[MOZOSUBZ-V1-DATA-PLANS] Key verification result:', keyVerification.success)
    
    if (!keyVerification.success) {
      console.warn('[MOZOSUBZ-V1-DATA-PLANS] Auth failed:', keyVerification.error)
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    console.log('[MOZOSUBZ-V1-DATA-PLANS] Authorized user:', keyVerification.context?.userId)

    const body = await request.json()
    const { serviceID } = body
    console.log('[MOZOSUBZ-V1-DATA-PLANS] Request params - serviceID:', serviceID)

    if (!serviceID) {
      console.warn('[MOZOSUBZ-V1-DATA-PLANS] Missing serviceID parameter')
      return NextResponse.json(
        { success: false, error: 'serviceID is required' },
        { status: 400 },
      )
    }

    // Call existing service action
    console.log('[MOZOSUBZ-V1-DATA-PLANS] Fetching data plans...')
    const result = await fetchDataPlans(serviceID)
    console.log('[MOZOSUBZ-V1-DATA-PLANS] Result:', result)

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1-DATA-PLANS] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
