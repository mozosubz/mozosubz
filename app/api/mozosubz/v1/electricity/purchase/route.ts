import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { buyElectricityToken } from '@/lib/api/gsubz'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1] POST /electricity/purchase')
  
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
    const { serviceID, phone, customerID, amount, variation_code, requestID } = body

    if (!serviceID || !phone || !customerID || !amount || !variation_code) {
      console.warn('[MOZOSUBZ-V1] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'serviceID, phone, customerID, amount, and variation_code are required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1] Processing electricity purchase')
    const result = await buyElectricityToken({
      serviceID,
      phone,
      customerID,
      amount,
      variation_code,
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
