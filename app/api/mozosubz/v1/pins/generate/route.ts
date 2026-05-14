import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-PINS] POST /pins/generate')
  
  try {
    const keyVerification = await verifyConnectKey(request)
    
    if (!keyVerification.success) {
      console.warn('[MOZOSUBZ-V1-PINS] Authorization failed')
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    const body = await request.json()
    const { network, value, number } = body

    if (!network || !value || !number) {
      console.warn('[MOZOSUBZ-V1-PINS] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'network, value, and number are required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-PINS] Forwarding to internal endpoint')
    
    const internalResponse = await fetch(new URL('/api/gsubz/recharge-pins/purchase', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ network, value, number }),
    })

    const data = await internalResponse.json()
    console.log('[MOZOSUBZ-V1-PINS] Success')
    
    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1-PINS] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to generate pins' },
      { status: 500 },
    )
  }
}
