import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkAuth } from '@/lib/utils/auth-check'

// Generate random 6-digit code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await checkAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Check if user already has an active connection
    const { data: existing } = await supabase
      .from('whatsapp_connections')
      .select('id, whatsapp_number, verified')
      .eq('user_id', user.id)
      .eq('verified', true)
      .is('disconnected_at', null)
      .single()

    if (existing) {
      return NextResponse.json(
        {
          error: 'Already connected',
          existingPhone: existing.whatsapp_number,
        },
        { status: 400 }
      )
    }

    // Generate new 6-digit code
    const code = generateCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Store verification code
    const { error: insertError } = await supabase
      .from('whatsapp_connections')
      .insert({
        user_id: user.id,
        whatsapp_number: 'pending',
        verification_code: code,
        verification_code_expires_at: expiresAt,
        verified: false,
      })

    if (insertError) {
      console.error('[v0] WhatsApp generate-code error:', insertError)
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 })
    }

    return NextResponse.json({
      code,
      expiresIn: 600,
      instructions: `Send 'VERIFY ${code}' to the WhatsApp bot to link your account`,
    })
  } catch (error) {
    console.error('[v0] WhatsApp generate-code error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
