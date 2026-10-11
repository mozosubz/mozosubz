import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'

/**
 * GET /api/v1/bot/check-deposit-status
 *
 * Simple endpoint for bot to check if a deposit has been received
 * Bot passes the payment reference it showed to user
 *
 * Query params:
 * - payment_reference (required): The payment reference from deposit initiation
 *
 * SECURITY: requires a valid X-Connect-Key, and the transaction must belong to
 * the key's owner. Previously this endpoint was unauthenticated and returned
 * any user's deposit state and wallet balance to anyone holding a reference
 * (bounty finding, fixed 2026-10-11).
 *
 * Response when payment received:
 * {
 *   "success": true,
 *   "status": "SUCCESS",
 *   "deposit_amount": 100,
 *   "receiving_amount": 50,
 *   "wallet_balance": 1050,
 *   "message": "Payment received! You'll receive ₦50 in your wallet."
 * }
 *
 * Response when still pending:
 * {
 *   "success": true,
 *   "status": "PENDING",
 *   "message": "Waiting for payment..."
 * }
 */

export async function GET(request: NextRequest) {
  try {
    // 0. Authenticate the caller (Connect Key) — never trust the reference alone
    const auth = await verifyConnectKey(request)
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status ?? 401 }
      )
    }
    const userId = auth.context!.userId

    // 1. Get payment reference from query params
    const url = new URL(request.url)
    const paymentReference = url.searchParams.get('payment_reference')

    if (!paymentReference) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing payment_reference parameter',
        },
        { status: 400 }
      )
    }


    // 2. Query the transaction — scoped to the authenticated key's owner so a
    //    reference belonging to another user is indistinguishable from a
    //    non-existent one.
    const supabase = createAdminClient()

    const { data: transaction, error: queryError } = await supabase
      .from('monnify_transactions')
      .select('id, amount, net_amount, status, user_id, updated_at')
      .eq('payment_reference', paymentReference)
      .eq('user_id', userId)
      .maybeSingle()

    if (queryError) {
      console.error('[Check Deposit Status] Query error:', queryError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to check status',
        },
        { status: 500 }
      )
    }

    // Transaction not found (or not the caller's)
    if (!transaction) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment reference not found',
        },
        { status: 404 }
      )
    }

    // Payment is still pending
    if (transaction.status !== 'SUCCESS') {
      return NextResponse.json(
        {
          success: true,
          status: transaction.status,
          message: 'Waiting for payment...',
        },
        { status: 200 }
      )
    }

    // 3. Payment received! Get user's wallet balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', transaction.user_id)
      .maybeSingle()

    if (profileError) {
      console.error('[Check Deposit Status] Profile error:', profileError)
      // Still return success but without balance
      return NextResponse.json(
        {
          success: true,
          status: 'SUCCESS',
          deposit_amount: Number(transaction.amount),
          receiving_amount: Number(transaction.net_amount),
          wallet_balance: 0,
          message: 'Payment received! Check your wallet.',
        },
        { status: 200 }
      )
    }


    return NextResponse.json(
      {
        success: true,
        status: 'SUCCESS',
        deposit_amount: Number(transaction.amount),
        receiving_amount: Number(transaction.net_amount),
        wallet_balance: Number(profile?.wallet_balance ?? 0),
        message: `Payment received! You received ₦${Number(transaction.net_amount)} in your wallet.`,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Check Deposit Status] Exception:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
