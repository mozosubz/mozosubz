import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/mozosubz/v1/verify
 * Look up the status of a transaction the caller owns.
 *
 * Body: { reference: string } — accepts either our transaction_id (gsubz / wallet
 * receipt id) or the Monnify payment_reference for a deposit.
 */
export async function POST(request: NextRequest) {
  console.log('[V1-VERIFY] POST')

  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => ({} as any))
    const reference = body?.reference || body?.requestID || body?.transactionId

    if (!reference || typeof reference !== 'string') {
      return NextResponse.json(
        { success: false, error: 'reference is required' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    // 1. Look up service transactions table.
    const { data: txn } = await admin
      .from('transactions')
      .select(
        'transaction_id, category, service_name, amount, status, phone, description, balance_before, balance_after, created_at',
      )
      .eq('user_id', auth.userId)
      .eq('transaction_id', reference)
      .maybeSingle()

    if (txn) {
      return NextResponse.json({
        success: true,
        type: 'service',
        transaction: txn,
      })
    }

    // 2. Look up deposit transactions table.
    const { data: deposit } = await admin
      .from('monnify_transactions')
      .select(
        'payment_reference, transaction_reference, amount, processing_fee, net_amount, status, account_number, bank_name, account_name, created_at, paid_at, expires_at',
      )
      .eq('user_id', auth.userId)
      .eq('payment_reference', reference)
      .maybeSingle()

    if (deposit) {
      return NextResponse.json({
        success: true,
        type: 'deposit',
        transaction: deposit,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Transaction not found' },
      { status: 404 },
    )
  } catch (error) {
    console.error('[V1-VERIFY] Error')
    return NextResponse.json(
      { success: false, error: 'Failed to verify transaction' },
      { status: 500 },
    )
  }
}
