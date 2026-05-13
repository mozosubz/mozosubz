import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/integrations/services/balance
 * 
 * Get account balance for the authenticated user via Connect Key
 * 
 * Requires: X-Connect-Key header
 * Permissions: balance
 */
export async function GET(request: NextRequest) {
  try {
    const context = await verifyConnectKey(request)
    if (!context) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (!context.permissions.includes('balance')) return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })

    const admin = createAdminClient()
    const { data: profile, error } = await admin
      .from('profiles')
      .select('wallet_balance')
      .eq('id', context.userId)
      .single()

    if (error) {
      console.error('[BALANCE] Error:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch balance' }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        balance: profile?.wallet_balance || 0,
        currency: 'NGN',
        formattedBalance: `₦${(profile?.wallet_balance || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[BALANCE] Error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
