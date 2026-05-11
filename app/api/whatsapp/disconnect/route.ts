import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkAuth } from '@/lib/utils/auth-check'

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await checkAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Find active connection
    const { data: connection } = await supabase
      .from('whatsapp_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('verified', true)
      .is('disconnected_at', null)
      .single()

    if (!connection) {
      return NextResponse.json(
        { error: 'No active WhatsApp connection found' },
        { status: 404 }
      )
    }

    // Mark as disconnected
    const { error: updateError } = await supabase
      .from('whatsapp_connections')
      .update({
        disconnected_at: new Date(),
        verified: false,
      })
      .eq('id', connection.id)

    if (updateError) {
      console.error('[v0] WhatsApp disconnect error:', updateError)
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'WhatsApp disconnected successfully',
    })
  } catch (error) {
    console.error('[v0] WhatsApp disconnect error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
