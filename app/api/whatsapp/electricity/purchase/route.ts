import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { payElectricity } from '@/lib/actions/electricity'

/**
 * POST /api/whatsapp/electricity/purchase
 *
 * Purchase electricity token with WhatsApp authentication.
 * 
 * Body: {
 *   whatsappPhone: "+2349056458312",
 *   disco: "IKEDC",
 *   customerId: "87654321",
 *   amount: "5000"
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { whatsappPhone, disco, customerId, amount } = body

    // Validate inputs
    if (!whatsappPhone || !disco || !customerId || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: whatsappPhone, disco, customerId, amount' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Resolve WhatsApp to user_id
    const { data: session } = await admin
      .from('whatsapp_sessions')
      .select('user_id, is_verified')
      .eq('whatsapp_phone', whatsappPhone)
      .maybeSingle()

    if (!session) {
      return NextResponse.json(
        { 
          success: true, 
          authenticated: false,
          message: 'This WhatsApp number is not connected to an active Mozosubz account. Please connect it on the website first.' 
        },
        { status: 200 }
      )
    }

    if (!session.is_verified) {
      return NextResponse.json(
        { 
          success: true, 
          authenticated: false,
          message: 'This WhatsApp number has been disconnected from your account. Please reconnect it on the website.' 
        },
        { status: 200 }
      )
    }

    // Create FormData for payElectricity function
    const formData = new FormData()
    formData.append('disco', disco)
    formData.append('customerId', customerId)
    formData.append('amount', amount)

    // Call existing purchase logic
    const result = await payElectricity(formData)

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
      disco,
      customerId,
      token: result.token,
      message: 'Electricity token purchased successfully',
    })
  } catch (error) {
    console.error('[v0] whatsapp electricity purchase error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
