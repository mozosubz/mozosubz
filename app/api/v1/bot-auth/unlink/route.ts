import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { logRequest } from '@/lib/api-logger'

/**
 * DELETE /api/v1/bot-auth/unlink
 * POST /api/v1/bot-auth/unlink
 *
 * Query params: platform=telegram|whatsapp
 * Body (POST): { platform: 'telegram' | 'whatsapp' }
 *
 * Unlinks/disconnects a bot account for the authenticated user.
 * Requires X-Connect-Key header.
 *
 * Response: { success, message }
 */

async function handleUnlink(request: NextRequest, method: string) {
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

    let platform: string | null = null

    // Get platform from query params or body
    if (method === 'DELETE') {
      const searchParams = new URL(request.url).searchParams
      platform = searchParams.get('platform')
    } else if (method === 'POST') {
      const body = await request.json()
      platform = body.platform
    }

    if (!platform || !['whatsapp', 'telegram'].includes(platform.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: 'Platform must be whatsapp or telegram' },
        { status: 400 }
      )
    }

    const userId = auth.context!.userId
    const supabase = createAdminClient()

    // Delete bot_connections row for this platform
    const { error: deleteError, count } = await supabase
      .from('bot_connections')
      .delete()
      .eq('user_id', userId)
      .eq('platform', platform.toLowerCase())

    if (deleteError) {
      console.error(`[Bot Auth Unlink] Delete failed:`, deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to unlink platform' },
        { status: 500 }
      )
    }

    if (count === 0) {
      const duration = Date.now() - startTime
      return NextResponse.json(
        { success: true, message: `No ${platform} account was connected` },
        { status: 200 }
      )
    }

    const duration = Date.now() - startTime

    return NextResponse.json(
      { success: true, message: `${platform} account unlinked successfully` },
      { status: 200 }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Bot Auth Unlink] Error: ${error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  return handleUnlink(request, 'DELETE')
}

export async function POST(request: NextRequest) {
  return handleUnlink(request, 'POST')
}
