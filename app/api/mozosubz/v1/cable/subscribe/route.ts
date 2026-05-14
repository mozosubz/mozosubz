import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { buyCableSubscription } from '@/lib/api/gsubz'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1] POST /cable/subscribe')
  
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
    const { serviceID, plan, phone, customerID, requestID } = body

    if (!serviceID || !plan || !phone || !customerID) {
      console.warn('[MOZOSUBZ-V1] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'serviceID, plan, phone, and customerID are required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1] Processing cable subscription')
    const result = await buyCableSubscription({
      serviceID,
      plan,
      phone,
      customerID,
      requestID,
    })
    
    return NextResponse.json({
      success: result.code === 200,
      data: result,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1] Error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { success: false, error: 'Failed to process subscription' },
      { status: 500 },
    )
  }
}
