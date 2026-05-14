import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'
import { getUserWalletBalance } from '@/lib/middleware/v1-response-helpers'

export async function GET(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-BALANCE] GET /balance')
  
  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) return

    console.log(`[MOZOSUBZ-V1-BALANCE] User: ${auth.userId}`)
    
    // Get user's internal wallet balance
    const walletResult = await getUserWalletBalance(auth.userId)
    
    if (!walletResult.success) {
      console.error('[MOZOSUBZ-V1-BALANCE] Failed to fetch wallet')
      return NextResponse.json(
        { success: false, error: 'Failed to fetch balance' },
        { status: 500 },
      )
    }

    console.log('[MOZOSUBZ-V1-BALANCE] Success')
    
    return NextResponse.json({
      success: true,
      balance: walletResult.balance,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1-BALANCE] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch balance' },
      { status: 500 },
    )
  }
}
