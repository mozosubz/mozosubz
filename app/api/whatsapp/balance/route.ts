import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/whatsapp/balance
 *
 * Get user's wallet balance
 *
 * Body: { "whatsappPhone": "+2349056458312" }
 *
 * Response:
 * {
 *   "success": true,
 *   "authenticated": true,
 *   "balance": 15000,
 *   "currency": "NGN",
 *   "formatted": "₦15,000.00"
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { whatsappPhone } = body

    if (!whatsappPhone) {
      return NextResponse.json(
        {
          success: true,
          authenticated: false,
          message: 'Missing whatsappPhone',
        },
        { status: 200 }
      )
    }

    const admin = createAdminClient()

    // Resolve WhatsApp to user
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
          message: 'This WhatsApp number is not connected to an active Mozosubz account. Please connect it on the website first.',
        },
        { status: 200 }
      )
    }

    if (!session.is_verified) {
      return NextResponse.json(
        {
          success: true,
          authenticated: false,
          message: 'This WhatsApp number has been disconnected from your account. Please reconnect it on the website.',
        },
        { status: 200 }
      )
    }

    // Get user profile with balance
    const { data: profile } = await admin
      .from('profiles')
      .select('wallet_balance, full_name')
      .eq('id', session.user_id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          message: 'User profile not found',
        },
        { status: 200 }
      )
    }

    const balance = profile.wallet_balance || 0
    const formatted = `₦${balance.toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

    // Log balance check
    void admin.from('whatsapp_audit_logs').insert({
      user_id: session.user_id,
      whatsapp_phone: whatsappPhone,
      event_type: 'balance_check',
    })

    return NextResponse.json({
      success: true,
      authenticated: true,
      balance,
      currency: 'NGN',
      formatted,
      message: `Your wallet balance is ${formatted}`,
    })
  } catch (error) {
    console.error('[v0] whatsapp balance error:', error)
    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        message: 'Internal server error',
      },
      { status: 200 }
    )
  }
}
