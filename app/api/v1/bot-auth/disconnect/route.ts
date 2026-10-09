import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRequest } from '@/lib/api-logger'

/**
 * POST /api/v1/bot-auth/disconnect
 *
 * Body: { platform: 'whatsapp' | 'telegram' }
 *
 * Disconnects a bot platform for the authenticated user.
 * Requires X-Connect-Key header.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)

  try {
    // Verify API key
    const auth = await verifyConnectKey(request)
    if (!auth.success) {
      const duration = Date.now() - startTime
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status ?? 401 }
      )
    }

    const body = await request.json()
    const { platform } = body

    if (!['whatsapp', 'telegram'].includes(platform)) {
      return NextResponse.json(
        { success: false, error: 'Platform must be whatsapp or telegram' },
        { status: 400 }
      )
    }

    const userId = auth.context!.userId
    const supabase = createAdminClient()

    // Delete bot_connections row for this platform
    const { error: deleteError } = await supabase
      .from('bot_connections')
      .delete()
      .eq('user_id', userId)
      .eq('platform', platform)

    if (deleteError) {
      console.error(`[Bot Auth Disconnect] Delete failed:`, deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to disconnect platform' },
        { status: 500 }
      )
    }

    const duration = Date.now() - startTime

    return NextResponse.json(
      { success: true, message: `${platform} disconnected successfully` },
      { status: 200 }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Bot Auth Disconnect] Error: ${error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/bot-auth/disconnect
 *
 * Query: ?platform=whatsapp | ?platform=telegram
 *
 * Unlinks/disconnects a bot platform for the authenticated user.
 * Requires X-Connect-Key header.
 */
export async function DELETE(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)

  try {
    // Verify API key
    const auth = await verifyConnectKey(request)
    if (!auth.success) {
      const duration = Date.now() - startTime
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status ?? 401 }
      )
    }

    // Get platform from query parameters
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')

    if (!platform || !['whatsapp', 'telegram'].includes(platform)) {
      return NextResponse.json(
        { success: false, error: 'Platform query parameter must be whatsapp or telegram' },
        { status: 400 }
      )
    }

    const userId = auth.context!.userId
    const supabase = createAdminClient()

    // Delete bot_connections row for this platform
    const { error: deleteError } = await supabase
      .from('bot_connections')
      .delete()
      .eq('user_id', userId)
      .eq('platform', platform)

    if (deleteError) {
      console.error(`[Bot Auth Disconnect] Delete failed:`, deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to unlink platform' },
        { status: 500 }
      )
    }

    const duration = Date.now() - startTime

    return NextResponse.json(
      { success: true, message: `${platform} account unlinked successfully` },
      { status: 200 }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Bot Auth Disconnect] Error: ${error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
