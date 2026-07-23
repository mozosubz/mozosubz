import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/v1/bot/check-deposit-status
 * 
 * Simple endpoint for bot to check if a deposit has been received
 * Bot passes the payment reference it showed to user
 * 
 * Query params:
 * - payment_reference (required): The payment reference from deposit initiation
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
    // 1. Get payment reference from query params
    const url = new URL(request.url)
    const paymentReference = url.searchParams.get('payment_reference')

    if (!paymentReference) {
      console.log('[Check Deposit Status] Missing payment_reference parameter')
      return NextResponse.json(
        {
          success: false,
          error: 'Missing payment_reference parameter',
        },
        { status: 400 }
      )
    }

    console.log(`[Check Deposit Status] Checking status for: ${paymentReference}`)

    // 2. Query the transaction
    const supabase = createAdminClient()

    const { data: transaction, error: queryError } = await supabase
      .from('monnify_transactions')
      .select('id, amount, net_amount, status, user_id, updated_at')
      .eq('payment_reference', paymentReference)
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

    // Transaction not found
    if (!transaction) {
      console.log(`[Check Deposit Status] Transaction not found: ${paymentReference}`)
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
      console.log(`[Check Deposit Status] Status is ${transaction.status}: ${paymentReference}`)
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

    console.log(
      `[Check Deposit Status] ✓ Payment received: ${paymentReference} | Amount: ₦${transaction.amount}`
    )

    return NextResponse.json(
      {
        success: true,
        status: 'SUCCESS',
        deposit_amount: Number(transaction.amount),
        receiving_amount: Number(transaction.net_amount),
        wallet_balance: profile?.wallet_balance || 0,
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
