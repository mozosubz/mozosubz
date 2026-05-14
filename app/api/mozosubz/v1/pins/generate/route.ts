import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-PINS-GENERATE] POST /pins/generate')
  
  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) return

    console.log(`[MOZOSUBZ-V1-PINS-GENERATE] User: ${auth.userId}`)

    const body = await request.json()
    const { network, value, number } = body

    if (!network || !value || !number) {
      console.warn('[MOZOSUBZ-V1-PINS-GENERATE] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'network, value, and number are required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-PINS-GENERATE] Calling internal endpoint')
    
    const internalResponse = await fetch(new URL('/api/gsubz/recharge-pins/purchase', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': auth.userId,
        'X-Key-ID': auth.keyId,
      },
      body: JSON.stringify({ network, value, number }),
    })

    const data = await internalResponse.json()
    console.log('[MOZOSUBZ-V1-PINS-GENERATE] Success')
    
    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1-PINS-GENERATE] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to generate pins' },
      { status: 500 },
    )
  }
}
