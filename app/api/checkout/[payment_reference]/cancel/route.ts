import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ payment_reference: string }> }
) {
  try {
    const { payment_reference: paymentReference } = await params
    const supabase = await createServerClient()

    // SECURITY: Authenticate caller and ensure they own the transaction
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
      .eq('payment_reference', paymentReference)
      .maybeSingle()

    if (txError || !tx) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })
    }

    if (tx.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Do not cancel transactions that are already successful
    if (tx.status === 'SUCCESS') {
      return NextResponse.json(
        { success: false, error: 'Cannot cancel a completed payment' },
        { status: 400 }
      )
    }

    // Update transaction status to CANCELLED
    const { error } = await supabase
      .from('monnify_transactions')
      .update({
        status: 'CANCELLED',
        updated_at: new Date().toISOString(),
      })
      .eq('payment_reference', paymentReference)
      .eq('user_id', user.id)

    if (error) {
      console.error('[CANCEL] Error cancelling transaction:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CANCEL] Exception:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
