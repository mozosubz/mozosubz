import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProviderBalance } from '@/lib/api/gsubz'

/**
 * GET /api/admin/provider-balance
 * 
 * Fetch current provider wallet balance using existing gsubz.getWalletBalance()
 */
export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.is_admin) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      )
    }

    // Call existing getProviderBalance function
    const balanceData = await getProviderBalance()

    if (!balanceData || !balanceData.balance) {
      return NextResponse.json(
        { success: false, message: 'Failed to fetch balance' },
        { status: 500 }
      )
    }

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
    console.error('[v0] provider balance error:', error)
    return NextResponse.json(
      { success: false, message: String(error) },
      { status: 500 }
    )
  }
}
