import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'
import { cleanCablePlans } from '@/lib/middleware/v1-response-helpers'
import { fetchCablePlans } from '@/lib/actions/cable'

export async function POST(request: NextRequest) {
  console.log('[V1-CABLE-PLANS] POST')

  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => ({} as any))
    const { serviceID } = body || {}

    if (!serviceID) {
      return NextResponse.json(
        { success: false, error: 'serviceID is required' },
        { status: 400 },
      )
    }

    const result = await fetchCablePlans(String(serviceID))
    if (!result.success || !result.plans) {
      return NextResponse.json(
        { success: false, error: 'No plans available' },
        { status: 502 },
      )
    }

    return NextResponse.json({
      success: true,
      plans: cleanCablePlans(result.plans as any[]),
    })
  } catch (error) {
    console.error('[V1-CABLE-PLANS] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cable plans' },
      { status: 500 },
    )
  }
}
