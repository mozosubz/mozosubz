import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'

export async function GET(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-BALANCE] GET /balance')
  
  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) return

    console.log(`[MOZOSUBZ-V1-BALANCE] User: ${auth.userId}`)
    
    const internalResponse = await fetch(new URL('/api/gsubz/balance', request.url), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': auth.userId,
        'X-Key-ID': auth.keyId,
      },
    })

    const data = await internalResponse.json()
    console.log('[MOZOSUBZ-V1-BALANCE] Success')
    
    return NextResponse.json({
      success: true,
      balance: data.balance,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1-BALANCE] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch balance' },
      { status: 500 },
    )
  }
}
