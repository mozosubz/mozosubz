import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRequest } from '@/lib/api-logger'
import { checkRateLimit, RATE_LIMIT_CONFIG } from '@/lib/utils/rate-limit'

/**
 * GET /api/v1/wallet/balance
 *
 * Returns the authenticated user's wallet balance and transaction summary.
 * Requires X-Connect-Key header.
 * Rate limited: 50 requests per minute per API key
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)

  try {
    // Verify API key
    const auth = await verifyConnectKey(request)
    if (!auth.success) {
      const duration = Date.now() - startTime
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status ?? 401 }
      )
    }

    const userId = auth.context!.userId

    // Check rate limit
    const { allowed, remaining } = await checkRateLimit(userId, RATE_LIMIT_CONFIG.V1_DATA_PLANS)
    if (!allowed) {
      const duration = Date.now() - startTime
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded (50 requests per minute)' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const supabase = createAdminClient()

    // Get user profile with balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('wallet_balance, email, full_name')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profile) {
      console.error(`[Wallet Balance] Profile lookup failed:`, profileError)
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve wallet balance' },
        { status: 500 }
      )
    }

    // Get transaction statistics
    const { data: stats, error: statsError } = await supabase
      .rpc('get_transaction_summary', { user_id: userId })
      .single()

    if (statsError) {
      console.warn(`[Wallet Balance] Stats lookup failed (continuing):`, statsError)
      // Continue anyway - stats are secondary
    }

    const duration = Date.now() - startTime

    return NextResponse.json(
      {
        success: true,
        wallet_balance: profile.wallet_balance || 0,
        currency: 'NGN',
        user_email: profile.email,
        user_name: profile.full_name || null,
        stats: stats || { total_spent: 0, transactions_count: 0, last_transaction_at: null },
        remaining,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Wallet Balance] Error: ${error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
