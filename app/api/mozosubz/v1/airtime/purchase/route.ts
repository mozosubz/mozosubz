import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { buyAirtime } from '@/lib/api/gsubz'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1] POST /airtime/purchase')
  
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
    const { serviceID, amount, phone, requestID } = body

    if (!serviceID || !amount || !phone) {
      console.warn('[MOZOSUBZ-V1] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'serviceID, amount, and phone are required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1] Processing airtime purchase')
    const result = await buyAirtime({
      serviceID,
      amount,
      phone,
      requestID,
    })
    
    return NextResponse.json({
      success: result.code === 200,
      data: result,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1] Error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { success: false, error: 'Failed to process purchase' },
      { status: 500 },
    )
  }
}
