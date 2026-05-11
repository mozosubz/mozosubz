import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeWhatsAppNumber, isValidWhatsAppNumber } from '@/lib/utils/whatsapp-token'

export async function POST(request: NextRequest) {
  try {
    const { whatsapp_number } = await request.json()

    if (!whatsapp_number) {
      return NextResponse.json(
        { error: 'WhatsApp number required' },
        { status: 400 }
      )
    }

    // Validate format
    if (!isValidWhatsAppNumber(whatsapp_number)) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          error: 'Invalid WhatsApp number format',
        },
        { status: 400 }
      )
    }

    const normalizedNumber = normalizeWhatsAppNumber(whatsapp_number)
    const supabase = createAdminClient()

    // Find verified connection
    const { data: connection } = await supabase
      .from('whatsapp_connections')
      .select('user_id, verified, disconnected_at')
      .eq('whatsapp_number', normalizedNumber)
      .eq('verified', true)
      .is('disconnected_at', null)
      .single()

    if (!connection) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        message: 'WhatsApp number not connected',
      })
    }

    // Get user profile for additional context
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, wallet_balance')
      .eq('id', connection.user_id)
      .single()

    return NextResponse.json({
      success: true,
      authenticated: true,
      user_id: connection.user_id,
      user_email: profile?.email,
      user_name: profile?.full_name,
      wallet_balance: profile?.wallet_balance,
    })
  } catch (error) {
    console.error('[v0] WhatsApp authenticate error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
