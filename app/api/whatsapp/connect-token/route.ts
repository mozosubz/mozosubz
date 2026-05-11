import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateConnectToken, hashConnectToken } from '@/lib/utils/whatsapp-token'
import { checkAuth } from '@/lib/utils/auth-check'

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
      .select('id, verified')
      .eq('user_id', user.id)
      .eq('verified', true)
      .single()

    if (existing) {
      return NextResponse.json(
        {
          error: 'User already has an active WhatsApp connection. Disconnect first to link a different number.',
        },
        { status: 400 }
      )
    }

    // Generate new token
    const rawToken = generateConnectToken()
    const tokenHash = hashConnectToken(rawToken)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Invalidate any previous unused tokens
    await supabase
      .from('whatsapp_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('verified', false)

    // Store token hash
    const { error: insertError } = await supabase
      .from('whatsapp_connections')
      .insert({
        user_id: user.id,
        whatsapp_number: 'pending', // Temporary, will be updated on connect
        connect_token_hash: tokenHash,
        connect_token_expires_at: expiresAt,
      })

    if (insertError) {
      console.error('[v0] WhatsApp token insert error:', insertError)
      return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      token: rawToken, // Only returned once
      expires_in_minutes: 10,
      instructions: 'Send this token to the WhatsApp bot: LINK ' + rawToken,
    })
  } catch (error) {
    console.error('[v0] WhatsApp connect-token error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
