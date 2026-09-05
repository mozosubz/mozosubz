import { NextRequest, NextResponse } from 'next/server'
import { queryMonnifyTransaction } from '@/lib/actions/transactions'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ payment_reference: string }> }
) {
  try {
    const { payment_reference } = await params

    // SECURITY: Authenticate caller and ensure they own the transaction
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
      .select('user_id')
      .eq('payment_reference', payment_reference)
      .maybeSingle()

    if (txError || !tx) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })
    }

    if (tx.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    console.log('[QUERY] Verifying payment:', payment_reference)

    // Query Monnify directly for faster verification
    const result = await queryMonnifyTransaction(payment_reference)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    // Return the updated transaction status
    return NextResponse.json({
      success: true,
      data: {
        id: payment_reference,
        paymentReference: payment_reference,
        status: result.paymentStatus === 'PAID' ? 'SUCCESS' : 'PENDING',
      },
    })
  } catch (error) {
    console.error('[QUERY] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
