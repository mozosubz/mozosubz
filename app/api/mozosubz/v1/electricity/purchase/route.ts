import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-ELECTRICITY-PURCHASE] POST /electricity/purchase')
  
  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) return

    console.log(`[MOZOSUBZ-V1-ELECTRICITY-PURCHASE] User: ${auth.userId}`)

    const body = await request.json()
    const { serviceID, phone, customerID, amount, variation_code, requestID } = body

    if (!serviceID || !phone || !customerID || !amount || !variation_code) {
      console.warn('[MOZOSUBZ-V1-ELECTRICITY-PURCHASE] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'serviceID, phone, customerID, amount, and variation_code are required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-ELECTRICITY-PURCHASE] Calling internal endpoint')
    
    const internalResponse = await fetch(new URL('/api/gsubz/electricity/purchase', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': auth.userId,
        'X-Key-ID': auth.keyId,
      },
      body: JSON.stringify({ serviceID, phone, customerID, amount, variation_code, requestID }),
    })

    const data = await internalResponse.json()
    console.log('[MOZOSUBZ-V1-ELECTRICITY-PURCHASE] Success')
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('[MOZOSUBZ-V1-ELECTRICITY-PURCHASE] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to process purchase' },
      { status: 500 },
    )
  }
}
