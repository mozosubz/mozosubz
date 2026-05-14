import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { generateRechargePins } from '@/lib/api/gsubz'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1] POST /pins/generate')
  
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
    const { network, value, number } = body

    if (!network || !value || !number) {
      console.warn('[MOZOSUBZ-V1] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'network, value, and number are required' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1] Generating recharge pins')
    const result = await generateRechargePins({
      network,
      value,
      number,
    })
    
    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1] Error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { success: false, error: 'Failed to generate pins' },
      { status: 500 },
    )
  }
}
