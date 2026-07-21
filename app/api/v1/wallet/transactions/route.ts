import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRequest } from '@/lib/api-logger'
import { checkRateLimit, RATE_LIMIT_CONFIG } from '@/lib/utils/rate-limit'

/**
 * GET /api/v1/wallet/transactions?limit=10&offset=0
 *
 * Returns paginated transaction history for the authenticated user.
 * Requires X-Connect-Key header.
 * Rate limited: 50 requests per minute per API key
 *
 * Query params:
 *  - limit: number of transactions to return (default: 10, max: 100)
 *  - offset: pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)
  console.log(`[Wallet Transactions] → GET | From: ${requestLog.ip}`)

  try {
    // Verify API key
    const auth = await verifyConnectKey(request)
    if (!auth.success) {
      const duration = Date.now() - startTime
      console.log(`[Wallet Transactions] ✗ Auth failed: ${auth.error} | ${duration}ms`)
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
      console.log(`[Wallet Transactions] ✗ Rate limit exceeded | ${duration}ms`)
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded (50 requests per minute)' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    let limit = parseInt(searchParams.get('limit') || '10', 10)
    let offset = parseInt(searchParams.get('offset') || '0', 10)

    // Validate params
    limit = Math.min(Math.max(1, limit), 100)
    offset = Math.max(0, offset)

    const supabase = createAdminClient()

    // Get transactions count
    const { count, error: countError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (countError) {
      console.error(`[Wallet Transactions] Count lookup failed:`, countError)
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve transactions' },
        { status: 500 }
      )
    }

    // Get transactions with pagination
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id, transaction_id, service_type, service_name, amount, status, created_at, phone, plan_details')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (txError) {
      console.error(`[Wallet Transactions] Transactions lookup failed:`, txError)
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve transactions' },
        { status: 500 }
      )
    }

    const duration = Date.now() - startTime
    console.log(`[Wallet Transactions] ✓ Retrieved ${transactions?.length || 0}/${count} transactions for user: ${userId} | ${duration}ms`)

    return NextResponse.json(
      {
        success: true,
        transactions: transactions || [],
        pagination: {
          limit,
          offset,
          total: count || 0,
          has_more: (offset + limit) < (count || 0),
        },
        remaining,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Wallet Transactions] Error: ${error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
