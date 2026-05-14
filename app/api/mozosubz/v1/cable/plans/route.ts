import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-CABLE] POST /cable/plans')
  
  try {
    const keyVerification = await verifyConnectKey(request)
    
    if (!keyVerification.success) {
      console.warn('[MOZOSUBZ-V1-CABLE] Authorization failed')
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    const body = await request.json()
    const { serviceID } = body

    if (!serviceID) {
      console.warn('[MOZOSUBZ-V1-CABLE] Missing serviceID')
      return NextResponse.json(
        { success: false, error: 'serviceID is required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-CABLE] Forwarding to internal endpoint')
    
    const internalResponse = await fetch(new URL('/api/gsubz/cable/plans', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceID }),
    })

    const data = await internalResponse.json()
    console.log('[MOZOSUBZ-V1-CABLE] Success')
    
    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1-CABLE] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cable plans' },
      { status: 500 },
    )
  }
}
