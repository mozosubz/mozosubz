import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-DATA] POST /data/plans')
  
  try {
    const keyVerification = await verifyConnectKey(request)
    
    if (!keyVerification.success) {
      console.warn('[MOZOSUBZ-V1-DATA] Authorization failed')
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    const body = await request.json()
    const { serviceID } = body

    if (!serviceID) {
      console.warn('[MOZOSUBZ-V1-DATA] Missing serviceID')
      return NextResponse.json(
        { success: false, error: 'serviceID is required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-DATA] Forwarding to internal endpoint')
    
    // Call internal gsubz endpoint
    const internalResponse = await fetch(new URL('/api/gsubz/data/plans', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceID }),
    })

    const data = await internalResponse.json()
    console.log('[MOZOSUBZ-V1-DATA] Success')
    
    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1-DATA] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch plans' },
      { status: 500 },
    )
  }
}
