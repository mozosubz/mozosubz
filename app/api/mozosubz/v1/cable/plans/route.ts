import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { getCablePlans } from '@/lib/api/gsubz'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1] GET /cable/plans')
  
  try {
    const keyVerification = await verifyConnectKey(request)
    
    if (!keyVerification.success) {
      console.warn('[MOZOSUBZ-V1] Auth failed')
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    const body = await request.json()
    const { service } = body

    if (!service) {
      console.warn('[MOZOSUBZ-V1] Missing service')
      return NextResponse.json(
        { success: false, error: 'service is required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1] Fetching cable plans for service:', service)
    const result = await getCablePlans(service)
    
    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1] Error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cable plans' },
      { status: 500 },
    )
  }
}
