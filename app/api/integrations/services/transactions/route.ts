import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/integrations/services/transactions
 * 
 * Get recent transactions for the authenticated user
 * 
 * Requires: X-Connect-Key header
 * Permissions: balance (can view own transactions)
 */
export async function GET(request: NextRequest) {
  try {
    const context = await verifyConnectKey(request)
    if (!context) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (!context.permissions.includes('balance')) return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })

    const admin = createAdminClient()
    const { data: transactions, error } = await admin
      .from('transactions')
      .select('*')
      .eq('user_id', context.userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[TRANSACTIONS] Error:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch transactions' }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        transactions: transactions || [],
        count: transactions?.length || 0,
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[TRANSACTIONS] Error:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
