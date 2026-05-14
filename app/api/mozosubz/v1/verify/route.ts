import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { verifyTransaction } from '@/lib/api/gsubz'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1] POST /verify')
  
  try {
    const keyVerification = await verifyConnectKey(request)
    
    if (!keyVerification.success) {
      console.warn('[MOZOSUBZ-V1] Auth failed')
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    const body = await request.json()
    const { requestID } = body

    if (!requestID) {
      console.warn('[MOZOSUBZ-V1] Missing requestID')
      return NextResponse.json(
        { success: false, error: 'requestID is required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1] Verifying transaction:', requestID)
    const result = await verifyTransaction(requestID)
    
    return NextResponse.json({
      success: result.code === 200,
      data: result,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1] Error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { success: false, error: 'Failed to verify transaction' },
      { status: 500 },
    )
  }
}
