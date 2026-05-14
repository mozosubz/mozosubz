import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * POST /api/mozosubz/v1/keys/revoke
 * 
 * Revoke a Connect Key
 */
export async function POST(request: NextRequest) {
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

    const { keyId } = await request.json()

    if (!keyId) {
      return NextResponse.json(
        { success: false, error: 'Key ID is required' },
        { status: 400 },
      )
    }

    // Verify key belongs to user
    const { data: key, error: fetchError } = await client
      .from('connect_keys')
      .select('id, user_id')
      .eq('id', keyId)
      .single()

    if (fetchError || !key || key.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Key not found' },
        { status: 404 },
      )
    }

    // Revoke the key
    const { error: updateError } = await client
      .from('connect_keys')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
      })
      .eq('id', keyId)

    if (updateError) {
      console.error('[v0] Revoke key error:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to revoke key' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Key revoked successfully',
    })
  } catch (error) {
    console.error('[v0] Revoke key endpoint error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
