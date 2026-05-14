import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-DEPOSIT] POST /deposit/start')
  
  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) return

    console.log(`[MOZOSUBZ-V1-DEPOSIT] User: ${auth.userId}`)

    const body = await request.json()
    const { amount, description } = body

    if (!amount || parseFloat(amount) <= 0) {
      console.warn('[MOZOSUBZ-V1-DEPOSIT] Invalid amount')
      return NextResponse.json(
        { success: false, error: 'Valid amount is required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-DEPOSIT] Calling internal endpoint')
    
    const internalResponse = await fetch(new URL('/api/deposit/start', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': auth.userId,
        'X-Key-ID': auth.keyId,
      },
      body: JSON.stringify({ amount, description }),
    })

    const data = await internalResponse.json()
    console.log('[MOZOSUBZ-V1-DEPOSIT] Success')
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('[MOZOSUBZ-V1-DEPOSIT] Error')
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
