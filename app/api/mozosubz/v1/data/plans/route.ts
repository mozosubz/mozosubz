import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-DATA-PLANS] POST /data/plans')
  
  try {
    // Verify auth and get user context
    const auth = await v1AuthOrRespond(request)
    if (!auth) {
      console.warn('[MOZOSUBZ-V1-DATA-PLANS] Auth failed')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    console.log(`[MOZOSUBZ-V1-DATA-PLANS] User: ${auth.userId}`)

    const body = await request.json()
    const { serviceID } = body

    if (!serviceID) {
      console.warn('[MOZOSUBZ-V1-DATA-PLANS] Missing serviceID')
      return NextResponse.json(
        { success: false, error: 'serviceID is required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-DATA-PLANS] Calling internal endpoint')
    
    // Call internal gsubz endpoint with user context
    const internalResponse = await fetch(new URL('/api/gsubz/data/plans', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': auth.userId,
        'X-Key-ID': auth.keyId,
      },
      body: JSON.stringify({ serviceID }),
    })

    const data = await internalResponse.json()
    console.log('[MOZOSUBZ-V1-DATA-PLANS] Success')
    
    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1-DATA-PLANS] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch plans' },
      { status: 500 },
    )
  }
}
