import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * GET /api/mozosubz/v1/transactions
 *
 * List the authenticated key holder's transactions, newest first.
 *
 * Auth: Connect Key (X-Connect-Key header).
 *
 * Query params:
 *   limit    (optional, default 20, max 100)
 *   offset   (optional, default 0)
 *   category (optional) AIRTIME | DATA | CABLE | ELECTRICITY | RECHARGE_PIN
 *   status   (optional) SUCCESS | FAILED | PENDING
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const url = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 100)
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0)
    const category = url.searchParams.get('category')
    const status = url.searchParams.get('status')

    const admin = createAdminClient()
    let query = admin
      .from('transactions')
      .select(
        'transaction_id, category, service_id, service_name, amount, phone, status, description, balance_before, balance_after, created_at',
        { count: 'exact' },
      )
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) query = query.eq('category', category)
    if (status) query = query.eq('status', status)

    const { data, count, error } = await query

    if (error) {
      console.error('[V1-TRANSACTIONS] Query failed')
      return NextResponse.json(
        { success: false, error: 'Failed to fetch transactions' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      transactions: data ?? [],
      pagination: {
        limit,
        offset,
        total: count ?? 0,
        hasMore: (count ?? 0) > offset + limit,
      },
    })
  } catch {
    console.error('[V1-TRANSACTIONS] Unexpected error')
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
