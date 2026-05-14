import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { buyData } from '@/lib/api/gsubz'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1] POST /data/purchase')
  
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
    const { serviceID, plan, phone, requestID } = body

    if (!serviceID || !plan || !phone) {
      console.warn('[MOZOSUBZ-V1] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'serviceID, plan, and phone are required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1] Processing data purchase')
    const result = await buyData({
      serviceID,
      plan,
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
