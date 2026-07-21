import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRequest } from '@/lib/api-logger'

/**
 * GET /api/v1/bot-auth/connections
 *
 * Lists all connected bot platforms for the authenticated user.
 * Requires X-Connect-Key header.
 *
 * Response: { success, connections: [{platform, identifier, connected_at, last_active_at}] }
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)
  console.log(`[Bot Auth Connections] → GET | From: ${requestLog.ip}`)

  try {
    // Verify API key
    const auth = await verifyConnectKey(request)
    if (!auth.success) {
      const duration = Date.now() - startTime
      console.log(`[Bot Auth Connections] ✗ Auth failed: ${auth.error} | ${duration}ms`)
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status ?? 401 }
      )
    }

    const userId = auth.context!.userId
    const supabase = createAdminClient()

    // Get all bot connections for this user
    const { data: connections, error: connectError } = await supabase
      .from('bot_connections')
      .select('platform, identifier, connected_at, last_active_at')
      .eq('user_id', userId)
      .order('connected_at', { ascending: false })

    if (connectError) {
      console.error(`[Bot Auth Connections] Lookup failed:`, connectError)
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve connections' },
        { status: 500 }
      )
    }

    const duration = Date.now() - startTime
    console.log(`[Bot Auth Connections] ✓ Retrieved ${connections?.length || 0} connections for user: ${userId} | ${duration}ms`)

    return NextResponse.json(
      {
        success: true,
        connections: connections || [],
        total: connections?.length || 0,
      },
      { status: 200 }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Bot Auth Connections] Error: ${error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
