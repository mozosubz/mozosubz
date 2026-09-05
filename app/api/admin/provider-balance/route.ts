import { NextResponse } from 'next/server'
import { getProviderBalance } from '@/lib/api/gsubz'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/admin/provider-balance
 * Fetch current provider wallet balance from gSubz API
 * Protected: requires an active admin session
 */
export async function GET() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

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
