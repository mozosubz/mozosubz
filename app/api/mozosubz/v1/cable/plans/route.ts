import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'
import { cleanCablePlans } from '@/lib/middleware/v1-response-helpers'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-CABLE-PLANS] POST /cable/plans')
  
  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) return

    console.log(`[MOZOSUBZ-V1-CABLE-PLANS] User: ${auth.userId}`)

    const body = await request.json()
    const { serviceID } = body

    if (!serviceID) {
      console.warn('[MOZOSUBZ-V1-CABLE-PLANS] Missing serviceID')
      return NextResponse.json(
        { success: false, error: 'serviceID is required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-CABLE-PLANS] Calling internal endpoint')
    
    const internalResponse = await fetch(new URL('/api/gsubz/cable/plans', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': auth.userId,
        'X-Key-ID': auth.keyId,
      },
      body: JSON.stringify({ serviceID }),
    })

    const data = await internalResponse.json()
    
    if (!data.plans) {
      console.error('[MOZOSUBZ-V1-CABLE-PLANS] No plans in response')
      return NextResponse.json(
        { success: false, error: 'No plans available' },
        { status: 500 },
      )
    }

    console.log('[MOZOSUBZ-V1-CABLE-PLANS] Success')
    
    return NextResponse.json({
      success: true,
      plans: cleanCablePlans(data.plans),
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1-CABLE-PLANS] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cable plans' },
      { status: 500 },
    )
  }
}
