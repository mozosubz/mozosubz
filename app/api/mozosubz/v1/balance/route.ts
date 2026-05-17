import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'
import { getUserWalletBalance } from '@/lib/middleware/v1-response-helpers'

export async function GET(request: NextRequest) {
  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    // Get user's internal wallet balance
    const walletResult = await getUserWalletBalance(auth.userId)

    if (!walletResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch balance' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      balance: walletResult.balance,
    })
  } catch {
    console.error('[V1-BALANCE] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch balance' },
      { status: 500 },
    )
  }
}
