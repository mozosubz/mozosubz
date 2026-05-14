import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { purchaseData } from '@/lib/actions/data'

/**
 * POST /api/mozosubz/v1/services/data/purchase
 */
export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-DATA-PURCHASE] Request started')
  try {
    console.log('[MOZOSUBZ-V1-DATA-PURCHASE] Verifying connect key...')
    const keyVerification = await verifyConnectKey(request)
    console.log('[MOZOSUBZ-V1-DATA-PURCHASE] Auth result:', keyVerification.success)
    
    if (!keyVerification.success) {
      console.warn('[MOZOSUBZ-V1-DATA-PURCHASE] Auth failed:', keyVerification.error)
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    console.log('[MOZOSUBZ-V1-DATA-PURCHASE] Authorized user:', keyVerification.context?.userId)

    const body = await request.json()
    console.log('[MOZOSUBZ-V1-DATA-PURCHASE] Request params:', { phone: body.phone, planID: body.planID, serviceID: body.serviceID })
    
    // Create FormData from JSON body
    const formData = new FormData()
    formData.append('phone', body.phone || '')
    formData.append('planID', body.planID || '')
    formData.append('serviceID', body.serviceID || '')

    console.log('[MOZOSUBZ-V1-DATA-PURCHASE] Executing purchase...')
    const result = await purchaseData(formData)
    console.log('[MOZOSUBZ-V1-DATA-PURCHASE] Result:', result)
    
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error('[MOZOSUBZ-V1-DATA-PURCHASE] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
