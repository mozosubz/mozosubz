import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sessionToken = searchParams.get('sessionToken')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type')

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Session token required', code: 'invalid_session' },
        { status: 401 }
      )
    }

    const supabase = createAdminClient()

    // Validate session token
    const { data: connection, error: tokenError } = await supabase
      .from('whatsapp_connections')
      .select('user_id, verified, session_token_expires_at')
      .eq('session_token', sessionToken)
      .eq('verified', true)
      .single()

    if (tokenError || !connection) {
      return NextResponse.json(
        { error: 'Invalid or expired session', code: 'invalid_session' },
        { status: 401 }
      )
    }

    // Check session expiry
    if (new Date(connection.session_token_expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Session expired', code: 'session_expired' },
        { status: 401 }
      )
    }

    // Build query
    let query = supabase
      .from('whatsapp_transactions')
      .select('id, created_at, transaction_type, service, plan, amount, status, error_message, whatsapp_phone')
      .eq('user_id', connection.user_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by type if provided
    if (type) {
      query = query.eq('transaction_type', type.toLowerCase())
    }

    const { data: transactions, error: queryError, count } = await query

    if (queryError) {
      console.error('[v0] WhatsApp history error:', queryError)
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
    }

    return NextResponse.json({
      transactions: transactions?.map((t: any) => ({
        id: t.id,
        date: t.created_at,
        type: t.transaction_type,
        service: t.service,
        plan: t.plan,
        amount: t.amount,
        status: t.status,
        error: t.error_message,
        phone: t.whatsapp_phone,
      })) || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[v0] WhatsApp history error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
