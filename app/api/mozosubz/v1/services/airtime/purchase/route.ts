import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { purchaseAirtime } from '@/lib/actions/airtime'

/**
 * POST /api/mozosubz/v1/services/airtime/purchase
 */
export async function POST(request: NextRequest) {
  try {
    const keyVerification = await verifyConnectKey(request)
    if (!keyVerification.success) {
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    const body = await request.json()
    
    // Create FormData from JSON body
    const formData = new FormData()
    formData.append('phone', body.phone || '')
    formData.append('amount', body.amount || '')
    formData.append('serviceID', body.serviceID || '')

    const result = await purchaseAirtime(formData)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('[v0] Mozosubz airtime purchase error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
