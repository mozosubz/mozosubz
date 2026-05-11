import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateSessionToken } from '@/lib/utils/session-token'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionToken, transactionType, service, phone, plan, amount } = body

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
      .select('user_id, whatsapp_phone, verified, session_token_expires_at')
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

    // Validate request parameters
    if (!transactionType || !service) {
      return NextResponse.json(
        { error: 'Transaction type and service required' },
        { status: 400 }
      )
    }

    // Get user profile for wallet balance
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, wallet_balance')
      .eq('id', connection.user_id)
      .single()

    // Check wallet balance
    const requiredAmount = parseInt(amount || '0')
    if (profile && profile.wallet_balance < requiredAmount) {
      return NextResponse.json(
        { error: 'Insufficient balance', code: 'insufficient_balance', balance: profile.wallet_balance },
        { status: 400 }
      )
    }

    // Generate transaction ID
    const transactionId = `whatsapp_txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // TODO: Call actual gsubz service endpoint based on transactionType
    // This is a stub - implement actual transaction logic

    // Log transaction
    const { error: logError } = await supabase
      .from('whatsapp_transactions')
      .insert({
        user_id: connection.user_id,
        whatsapp_phone: connection.whatsapp_phone,
        transaction_type: transactionType,
        service: service.toUpperCase(),
        plan: plan || null,
        amount: requiredAmount,
        status: 'pending',
        api_request: body,
      })

    if (logError) {
      console.error('[v0] WhatsApp transaction log error:', logError)
    }

    // Deduct wallet balance (if successful)
    if (profile) {
      await supabase
        .from('profiles')
        .update({ wallet_balance: profile.wallet_balance - requiredAmount })
        .eq('id', connection.user_id)
    }

    return NextResponse.json({
      success: true,
      transactionId,
      type: transactionType,
      service: service.toUpperCase(),
      amount: requiredAmount,
      plan: plan || null,
      newBalance: (profile?.wallet_balance || 0) - requiredAmount,
      message: `${transactionType} purchased successfully`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[v0] WhatsApp execute-transaction error:', error)
    return NextResponse.json({ error: 'Transaction failed', code: 'service_unavailable' }, { status: 500 })
  }
}
