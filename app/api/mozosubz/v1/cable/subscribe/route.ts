import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-CABLE-SUBSCRIBE] POST /cable/subscribe')
  
  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) return

    console.log(`[MOZOSUBZ-V1-CABLE-SUBSCRIBE] User: ${auth.userId}`)

    const body = await request.json()
    const { serviceID, plan, phone, customerID, requestID } = body

    if (!serviceID || !plan || !phone || !customerID) {
      console.warn('[MOZOSUBZ-V1-CABLE-SUBSCRIBE] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'serviceID, plan, phone, and customerID are required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-CABLE-SUBSCRIBE] Calling internal endpoint')
    
    const internalResponse = await fetch(new URL('/api/gsubz/cable/subscribe', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': auth.userId,
        'X-Key-ID': auth.keyId,
      },
      body: JSON.stringify({ serviceID, plan, phone, customerID, requestID }),
    })

    const data = await internalResponse.json()
    console.log('[MOZOSUBZ-V1-CABLE-SUBSCRIBE] Success')
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('[MOZOSUBZ-V1-CABLE-SUBSCRIBE] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to process subscription' },
      { status: 500 },
    )
  }
}
