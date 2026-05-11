import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { subscribeCable } from '@/lib/actions/cable'

/**
 * POST /api/whatsapp/cable/purchase
 *
 * Subscribe to cable TV with WhatsApp authentication.
 * 
 * Body: {
 *   whatsappPhone: "+2349056458312",
 *   provider: "DSTV",
 *   plan: "dstv_starter",
 *   customerId: "12345678",
 *   amount: "2500"
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { whatsappPhone, provider, plan, customerId, amount } = body

    // Validate inputs
    if (!whatsappPhone || !provider || !plan || !customerId || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: whatsappPhone, provider, plan, customerId, amount' },
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

    // Create FormData for subscribeCable function
    const formData = new FormData()
    formData.append('provider', provider)
    formData.append('plan', plan)
    formData.append('customerId', customerId)
    formData.append('amount', amount)

    // Call existing subscription logic
    const result = await subscribeCable(formData)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Subscription failed' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      transactionId: result.transactionId,
      amount,
      provider,
      plan,
      customerId,
      message: 'Cable subscription successful',
    })
  } catch (error) {
    console.error('[v0] whatsapp cable purchase error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
