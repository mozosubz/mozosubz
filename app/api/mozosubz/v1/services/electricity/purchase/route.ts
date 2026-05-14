import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { payElectricity } from '@/lib/actions/electricity'

/**
 * POST /api/mozosubz/v1/services/electricity/purchase
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
    formData.append('meterNumber', body.meterNumber || '')
    formData.append('meterType', body.meterType || 'prepaid')
    formData.append('disco', body.disco || '')
    formData.append('amount', body.amount || '')

    const result = await payElectricity(formData)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('[v0] Mozosubz electricity purchase error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
