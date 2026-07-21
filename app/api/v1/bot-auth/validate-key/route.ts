import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRequest } from '@/lib/api-logger'

/**
 * GET /api/v1/bot-auth/validate-key
 *
 * Validates the API key (X-Connect-Key header) and checks if bot auth is active.
 * Requires X-Connect-Key header.
 *
 * Returns user info and connected bot platforms if key is valid.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)
  console.log(`[Bot Auth Validate Key] → GET | From: ${requestLog.ip}`)

  try {
    // Verify API key using existing middleware
    const auth = await verifyConnectKey(request)
    if (!auth.success) {
      const duration = Date.now() - startTime
      console.log(`[Bot Auth Validate Key] ✗ Auth failed: ${auth.error} | ${duration}ms`)
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status ?? 401 }
      )
    }

    const userId = auth.context!.userId
    const supabase = createAdminClient()

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name, phone_number, wallet_balance')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profile) {
      console.error(`[Bot Auth Validate Key] Profile lookup failed:`, profileError)
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve user profile' },
        { status: 500 }
      )
    }

    // Get bot connections for this user
    const { data: connections, error: connectError } = await supabase
      .from('bot_connections')
      .select('platform, identifier, connected_at, last_active_at')
      .eq('user_id', userId)

    if (connectError) {
      console.error(`[Bot Auth Validate Key] Connections lookup failed:`, connectError)
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve connections' },
        { status: 500 }
      )
    }

    const duration = Date.now() - startTime
    console.log(`[Bot Auth Validate Key] ✓ Key validated for user: ${userId} | ${duration}ms`)

    return NextResponse.json(
      {
        success: true,
        valid: true,
        user: {
          id: userId,
          email: profile.email,
          name: profile.full_name || 'User',
          phone: profile.phone_number || null,
          wallet_balance: profile.wallet_balance || 0,
        },
        bot_connections: connections || [],
      },
      { status: 200 }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Bot Auth Validate Key] Error: ${error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
