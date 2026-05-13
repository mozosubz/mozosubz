import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/integrations/keys/revoke
 * 
 * Revoke a Connect Key (permanent - cannot be undone)
 * 
 * Request body:
 * {
 *   "keyId": "uuid"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Key revoked successfully"
 * }
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

    const body = await request.json()
    const { keyId } = body

    if (!keyId) {
      return NextResponse.json(
        { success: false, error: 'Key ID is required' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = request.headers.get('user-agent') || ''

    // Verify the key belongs to the user
    const { data: key, error: fetchError } = await admin
      .from('connect_keys')
      .select('id, user_id, name')
      .eq('id', keyId)
      .single()

    if (fetchError || !key) {
      return NextResponse.json(
        { success: false, error: 'Key not found' },
        { status: 404 },
      )
    }

    if (key.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 },
      )
    }

    // Revoke the key
    const { error: revokeError } = await admin
      .from('connect_keys')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
      })
      .eq('id', keyId)

    if (revokeError) {
      console.error('[REVOKE_KEY] Error:', revokeError)
      return NextResponse.json(
        { success: false, error: 'Failed to revoke key' },
        { status: 500 },
      )
    }

    // Log revocation for audit
    await admin
      .from('connect_key_logs')
      .insert({
        user_id: user.id,
        key_id: keyId,
        endpoint: '/integrations/keys/revoke',
        method: 'POST',
        status_code: 200,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .catch(err => console.error('[REVOKE_KEY] Failed to log revocation:', err))

    return NextResponse.json(
      {
        success: true,
        message: 'Key revoked successfully. It will no longer work for API calls.',
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[REVOKE_KEY] Error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
