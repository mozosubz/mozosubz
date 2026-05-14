import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-VERIFY] POST /verify')
  
  try {
    const keyVerification = await verifyConnectKey(request)
    
    if (!keyVerification.success) {
      console.warn('[MOZOSUBZ-V1-VERIFY] Authorization failed')
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    const body = await request.json()
    const { requestID } = body

    if (!requestID) {
      console.warn('[MOZOSUBZ-V1-VERIFY] Missing requestID')
      return NextResponse.json(
        { success: false, error: 'requestID is required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-VERIFY] Forwarding to internal endpoint')
    
    const internalResponse = await fetch(new URL('/api/gsubz/verify', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
