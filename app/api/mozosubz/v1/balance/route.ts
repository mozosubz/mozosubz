import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'

export async function GET(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-BALANCE] GET /balance')
  
  try {
    const keyVerification = await verifyConnectKey(request)
    
    if (!keyVerification.success) {
      console.warn('[MOZOSUBZ-V1-BALANCE] Authorization failed')
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    console.log('[MOZOSUBZ-V1-BALANCE] Forwarding to internal endpoint')
    
    const internalResponse = await fetch(new URL('/api/gsubz/balance', request.url), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
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
