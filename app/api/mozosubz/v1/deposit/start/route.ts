import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-DEPOSIT] POST /deposit/start')
  
  try {
    const keyVerification = await verifyConnectKey(request)
    
    if (!keyVerification.success) {
      console.warn('[MOZOSUBZ-V1-DEPOSIT] Authorization failed')
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    const body = await request.json()
    const { amount, description } = body

    if (!amount || parseFloat(amount) <= 0) {
      console.warn('[MOZOSUBZ-V1-DEPOSIT] Invalid amount')
      return NextResponse.json(
        { success: false, error: 'Valid amount is required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-DEPOSIT] Forwarding to internal endpoint')
    
    const internalResponse = await fetch(new URL('/api/deposit/start', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
