import { NextRequest, NextResponse } from 'next/server'
import { getTransaction, verifyAndCreditPayment, queryMonnifyTransaction } from '@/lib/actions/transactions'
import { initializePayment } from '@/lib/actions/monnify'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ payment_reference: string }> }
) {
  try {
    const { payment_reference } = await params

    console.log('[CHECKOUT API] Fetching transaction:', payment_reference)

    // Get transaction from DB
    const result = await getTransaction(payment_reference)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, status: result.status },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    })
  } catch (error) {
    console.error('[CHECKOUT API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ payment_reference: string }> }
) {
  try {
    const { payment_reference } = await params
    const body = await request.json()
    const { action } = body

    console.log('[CHECKOUT API] Action:', action, 'Payment Reference:', payment_reference)

    if (action === 'verify') {
      // SECURITY: Require user authentication and ownership check
      const supabase = await createServerClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user?.id) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      const { data: tx, error: txError } = await supabase
        .from('monnify_transactions')
        .select('user_id, status')
        .eq('payment_reference', payment_reference)
        .maybeSingle()

      if (txError || !tx) {
        return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })
      }

      if (tx.user_id !== user.id) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }

      // Query Monnify directly to confirm paymentStatus is actually PAID
      const queryResult = await queryMonnifyTransaction(payment_reference)
      if (!queryResult.success || queryResult.paymentStatus !== 'PAID') {
        return NextResponse.json(
          {
            success: false,
            error: `Payment not yet confirmed by Monnify (status: ${queryResult.paymentStatus || 'UNKNOWN'})`,
          },
          { status: 400 }
        )
      }

      // Verify payment with Monnify and credit wallet
      const result = await verifyAndCreditPayment(payment_reference)

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        credited: result.credited,
        alreadyProcessed: result.alreadyProcessed,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[CHECKOUT API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
