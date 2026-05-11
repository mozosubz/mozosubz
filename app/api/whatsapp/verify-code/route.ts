import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeWhatsAppNumber, isValidWhatsAppNumber } from '@/lib/utils/whatsapp-token'
import { generateSecureToken } from '@/lib/utils/session-token'

export async function POST(request: NextRequest) {
  try {
    const { code, whatsappPhone } = await request.json()

    if (!code || !whatsappPhone) {
      return NextResponse.json(
        { error: 'Code and WhatsApp phone required' },
        { status: 400 }
      )
    }

    // Validate WhatsApp number format
    if (!isValidWhatsAppNumber(whatsappPhone)) {
      return NextResponse.json(
        { error: 'Invalid WhatsApp number format', type: 'invalid_phone' },
        { status: 400 }
      )
    }

    const normalizedNumber = normalizeWhatsAppNumber(whatsappPhone)
    const supabase = createAdminClient()

    // Check if number already connected to another user
    const { data: existing } = await supabase
      .from('whatsapp_connections')
      .select('user_id, id')
      .eq('whatsapp_number', normalizedNumber)
      .eq('verified', true)
      .is('disconnected_at', null)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'This WhatsApp number is already connected', type: 'already_connected' },
        { status: 400 }
      )
    }

    // Find pending connection with matching code
    const { data: connection, error: selectError } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('verification_code', code)
      .eq('verified', false)
      .single()

    if (selectError || !connection) {
      return NextResponse.json(
        { error: 'Invalid code', type: 'invalid_code' },
        { status: 400 }
      )
    }

    // Check code expiry
    if (new Date(connection.verification_code_expires_at) < new Date()) {
      await supabase
        .from('whatsapp_connections')
        .delete()
        .eq('id', connection.id)

      return NextResponse.json(
        { error: 'Code expired', type: 'expired_code' },
        { status: 400 }
      )
    }

    // Generate session token (valid for 30 days)
    const sessionToken = generateSecureToken()
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    // Update connection as verified
    const { error: updateError } = await supabase
      .from('whatsapp_connections')
      .update({
        whatsapp_number: normalizedNumber,
        verified: true,
        verified_at: new Date(),
        session_token: sessionToken,
        session_token_expires_at: sessionExpiresAt,
        verification_code: null,
        verification_code_expires_at: null,
      })
      .eq('id', connection.id)

    if (updateError) {
      console.error('[v0] WhatsApp verify-code update error:', updateError)
      return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      sessionToken,
      userId: connection.user_id,
      phone: normalizedNumber,
    })
  } catch (error) {
    console.error('[v0] WhatsApp verify-code error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
