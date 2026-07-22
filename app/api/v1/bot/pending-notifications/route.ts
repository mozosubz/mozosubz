import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/v1/bot/pending-notifications
 * 
 * Bot polls this endpoint to check for completed deposits and wallet updates
 * Returns all deposits that completed since last check
 * 
 * Query params:
 * - last_check_at (optional): ISO timestamp - only return notifications after this time
 * - limit (optional): max 100, default 20
 * 
 * Response format perfect for bot to display to user:
 * {
 *   "success": true,
 *   "pending_notifications": [
 *     {
 *       "type": "deposit_completed",
 *       "deposit_amount": 500,
 *       "receiving_amount": 450,
 *       "payment_reference": "MOZO_xxx",
 *       "completed_at": "2024-01-15T16:45:00Z",
 *       "new_wallet_balance": 1000
 *     }
 *   ]
 * }
 */

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // 1. Verify API key
    const keyVerification = await verifyConnectKey(request)
    if (!keyVerification.success || !keyVerification.userId) {
      console.log('[Bot Notifications] ❌ Invalid API key')
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      )
    }

    const userId = keyVerification.userId
    console.log(`[Bot Notifications] Checking for user: ${userId}`)

    // 2. Parse query params
    const url = new URL(request.url)
    const lastCheckAt = url.searchParams.get('last_check_at')
    const limitParam = url.searchParams.get('limit')
    const limit = Math.min(parseInt(limitParam || '20'), 100)

    // 3. Build query to get completed deposits
    const supabase = createAdminClient()

    let query = supabase
      .from('monnify_transactions')
      .select(
        'id, amount, net_amount, payment_reference, status, paid_at, updated_at, account_number, account_name, bank_name'
      )
      .eq('user_id', userId)
      .eq('status', 'SUCCESS')
      .order('paid_at', { ascending: false })
      .limit(limit)

    // If last_check_at provided, only return notifications after that time
    if (lastCheckAt) {
      query = query.gt('paid_at', lastCheckAt)
    }

    const { data: completedDeposits, error: queryError } = await query

    if (queryError) {
      console.error('[Bot Notifications] Error fetching deposits:', queryError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch notifications' },
        { status: 500 }
      )
    }

    // 4. Get current wallet balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('[Bot Notifications] Error fetching profile:', profileError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch wallet balance' },
        { status: 500 }
      )
    }

    const walletBalance = profile?.wallet_balance || 0

    // 5. Format notifications for bot display
    const pendingNotifications = (completedDeposits || []).map((deposit) => ({
      type: 'deposit_completed',
      deposit_amount: Number(deposit.amount),
      receiving_amount: Number(deposit.net_amount),
      payment_reference: deposit.payment_reference,
      completed_at: deposit.paid_at,
      bank_details: {
        account_number: deposit.account_number,
        account_name: deposit.account_name,
        bank_name: deposit.bank_name,
      },
      new_wallet_balance: walletBalance,
    }))

    const duration = Date.now() - startTime
    console.log(
      `[Bot Notifications] ✓ Found ${pendingNotifications.length} notifications for user ${userId} | ${duration}ms`
    )

    return NextResponse.json(
      {
        success: true,
        pending_notifications: pendingNotifications,
        wallet_balance: walletBalance,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Bot Notifications] Exception:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
