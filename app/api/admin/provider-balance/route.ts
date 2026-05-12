import { NextResponse } from 'next/server'
import { getProviderBalance } from '@/lib/api/gsubz'

/**
 * GET /api/admin/provider-balance
 * Fetch current provider wallet balance from gSubz API
 */
export async function GET() {
  try {
    const balanceData = await getProviderBalance()

    const balance = parseFloat(balanceData.balance)
    const formatted = `₦${balance.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

    return NextResponse.json({
      success: true,
      balance,
      formatted,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch balance' },
      { status: 500 }
    )
  }
}
