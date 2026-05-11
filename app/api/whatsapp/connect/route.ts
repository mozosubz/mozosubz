import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTokenHash, normalizeWhatsAppNumber, isValidWhatsAppNumber } from '@/lib/utils/whatsapp-token'

export async function POST(request: NextRequest) {
  try {
    const { whatsapp_number, token } = await request.json()

    if (!whatsapp_number || !token) {
      return NextResponse.json(
        { error: 'WhatsApp number and token required' },
        { status: 400 }
      )
    }

    // Validate WhatsApp number format
    if (!isValidWhatsAppNumber(whatsapp_number)) {
      return NextResponse.json(
        { error: 'Invalid WhatsApp number format' },
        { status: 400 }
      )
    }

    const normalizedNumber = normalizeWhatsAppNumber(whatsapp_number)
    const supabase = createAdminClient()

    // Check if number already connected to another user
    const { data: existing } = await supabase
      .from('whatsapp_connections')
      .select('user_id')
      .eq('whatsapp_number', normalizedNumber)
      .eq('verified', true)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'This WhatsApp number is already connected to another account' },
        { status: 400 }
      )
    }

    // Find pending connection with token
    const { data: connection } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('verified', false)
      .is('connected_at', null)
      .single()

    if (!connection) {
      return NextResponse.json(
        { error: 'No pending connection found. Generate a new token first.' },
        { status: 400 }
      )
    }

    // Check token expiry
    if (new Date(connection.connect_token_expires_at) < new Date()) {
      await supabase
        .from('whatsapp_connections')
        .delete()
        .eq('id', connection.id)

      return NextResponse.json(
        { error: 'Token expired. Generate a new one.' },
        { status: 400 }
      )
    }

    // Verify token
    if (!verifyTokenHash(token, connection.connect_token_hash)) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 400 }
      )
    }

    // Update connection as verified and connected
    const { error: updateError } = await supabase
      .from('whatsapp_connections')
      .update({
        whatsapp_number: normalizedNumber,
        verified: true,
        connected_at: new Date(),
        connect_token_hash: null, // Clear token hash
        connect_token_expires_at: null,
      })
      .eq('id', connection.id)

    if (updateError) {
      console.error('[v0] WhatsApp connection update error:', updateError)
      return NextResponse.json({ error: 'Failed to connect WhatsApp' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'WhatsApp connected successfully',
      user_id: connection.user_id,
      whatsapp_number: normalizedNumber,
    })
  } catch (error) {
    console.error('[v0] WhatsApp connect error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
