import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { purchaseData } from '@/lib/actions/data'

/**
 * POST /api/whatsapp/data/purchase
 *
 * Purchase data with WhatsApp authentication.
 * 
 * Body: {
 *   whatsappPhone: "+2349056458312",
 *   network: "MTN",
 *   planType: "mtn_sme",
 *   amount: "500"
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { whatsappPhone, network, planType, amount } = body

    // Validate inputs
    if (!whatsappPhone || !network || !planType || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: whatsappPhone, network, planType, amount' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Resolve WhatsApp to user_id
    const { data: session } = await admin
      .from('whatsapp_sessions')
      .select('user_id')
      .eq('whatsapp_phone', whatsappPhone)
      .eq('is_verified', true)
      .maybeSingle()

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp not linked to an account' },
        { status: 401 }
      )
    }

    // Call existing purchase logic
    const result = await purchaseData({
      userId: session.user_id,
      network,
      planType,
      amount: parseInt(amount),
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Purchase failed' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      transactionId: result.transactionId,
      amount,
      network,
      planType,
      message: 'Data purchased successfully',
    })
  } catch (error) {
    console.error('[v0] whatsapp data purchase error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
