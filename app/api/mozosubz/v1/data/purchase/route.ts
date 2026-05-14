import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-DATA-PURCHASE] POST /data/purchase')
  
  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) return

    console.log(`[MOZOSUBZ-V1-DATA-PURCHASE] User: ${auth.userId}`)

    const body = await request.json()
    const { serviceID, plan, phone, requestID } = body

    if (!serviceID || !plan || !phone) {
      console.warn('[MOZOSUBZ-V1-DATA-PURCHASE] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'serviceID, plan, and phone are required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-DATA-PURCHASE] Calling internal endpoint')
    
    const internalResponse = await fetch(new URL('/api/gsubz/data/purchase', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': auth.userId,
        'X-Key-ID': auth.keyId,
      },
      body: JSON.stringify({ serviceID, plan, phone, requestID }),
    })

    const data = await internalResponse.json()
    console.log('[MOZOSUBZ-V1-DATA-PURCHASE] Success')
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('[MOZOSUBZ-V1-DATA-PURCHASE] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to process purchase' },
      { status: 500 },
    )
  }
}
