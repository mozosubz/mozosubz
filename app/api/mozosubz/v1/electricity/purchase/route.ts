import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-ELECTRICITY] POST /electricity/purchase')
  
  try {
    const keyVerification = await verifyConnectKey(request)
    
    if (!keyVerification.success) {
      console.warn('[MOZOSUBZ-V1-ELECTRICITY] Authorization failed')
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    const body = await request.json()
    const { serviceID, phone, customerID, amount, variation_code, requestID } = body

    if (!serviceID || !phone || !customerID || !amount || !variation_code) {
      console.warn('[MOZOSUBZ-V1-ELECTRICITY] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'serviceID, phone, customerID, amount, and variation_code are required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-ELECTRICITY] Forwarding to internal endpoint')
    
    const internalResponse = await fetch(new URL('/api/gsubz/electricity/purchase', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceID, phone, customerID, amount, variation_code, requestID }),
    })

    const data = await internalResponse.json()
    console.log('[MOZOSUBZ-V1-ELECTRICITY] Success')
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('[MOZOSUBZ-V1-ELECTRICITY] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to process purchase' },
      { status: 500 },
    )
  }
}
