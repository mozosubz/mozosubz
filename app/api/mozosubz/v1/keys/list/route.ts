import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/mozosubz/v1/keys/list
 * 
 * List all Connect Keys for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const client = await createServerClient()
    const {
      data: { user },
    } = await client.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const { data: keys, error } = await client
      .from('connect_keys')
      .select('id, name, key_preview, is_active, created_at, expires_at, last_used_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[v0] List keys error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to list keys' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      keys: keys || [],
      totalKeys: keys?.length || 0,
    })
  } catch (error) {
    console.error('[v0] List keys endpoint error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
