import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-AIRTIME] POST /airtime/purchase')
  
  try {
    const keyVerification = await verifyConnectKey(request)
    
    if (!keyVerification.success) {
      console.warn('[MOZOSUBZ-V1-AIRTIME] Authorization failed')
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    const body = await request.json()
    const { serviceID, amount, phone, requestID } = body

    if (!serviceID || !amount || !phone) {
      console.warn('[MOZOSUBZ-V1-AIRTIME] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'serviceID, amount, and phone are required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-AIRTIME] Forwarding to internal endpoint')
    
    const internalResponse = await fetch(new URL('/api/gsubz/airtime/purchase', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceID, amount, phone, requestID }),
    })

    const data = await internalResponse.json()
    console.log('[MOZOSUBZ-V1-AIRTIME] Success')
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('[MOZOSUBZ-V1-AIRTIME] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to process purchase' },
      { status: 500 },
    )
  }
}
