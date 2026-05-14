import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { getWalletBalance } from '@/lib/api/gsubz'

export async function GET(request: NextRequest) {
  console.log('[MOZOSUBZ-V1] GET /balance')
  
  try {
    const keyVerification = await verifyConnectKey(request)
    
    if (!keyVerification.success) {
      console.warn('[MOZOSUBZ-V1] Auth failed')
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    console.log('[MOZOSUBZ-V1] Fetching wallet balance')
    const result = await getWalletBalance()
    
    return NextResponse.json({
      success: true,
      balance: result.balance,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1] Error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch balance' },
      { status: 500 },
    )
  }
}
