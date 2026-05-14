import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-VERIFY] POST /verify')
  
  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) return

    console.log(`[MOZOSUBZ-V1-VERIFY] User: ${auth.userId}`)

    const body = await request.json()
    const { requestID } = body

    if (!requestID) {
      console.warn('[MOZOSUBZ-V1-VERIFY] Missing requestID')
      return NextResponse.json(
        { success: false, error: 'requestID is required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-VERIFY] Calling internal endpoint')
    
    const internalResponse = await fetch(new URL('/api/gsubz/verify', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': auth.userId,
        'X-Key-ID': auth.keyId,
      },
      body: JSON.stringify({ requestID }),
    })

    const data = await internalResponse.json()
    console.log('[MOZOSUBZ-V1-VERIFY] Success')
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('[MOZOSUBZ-V1-VERIFY] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to verify transaction' },
      { status: 500 },
    )
  }
}
