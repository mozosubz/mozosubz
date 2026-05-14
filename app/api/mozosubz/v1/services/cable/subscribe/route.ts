import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { subscribeCable } from '@/lib/actions/cable'

/**
 * POST /api/mozosubz/v1/services/cable/subscribe
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

    const body = await request.json()
    
    // Create FormData from JSON body
    const formData = new FormData()
    formData.append('provider', body.provider || '')
    formData.append('smartcard', body.smartcard || '')
    formData.append('planID', body.planID || '')

    const result = await subscribeCable(formData)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('[v0] Mozosubz cable subscribe error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
