import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateConnectKey, hashConnectKey, getKeyPreview } from '@/lib/utils/connect-key'

/**
 * POST /api/integrations/keys/create
 * 
 * Create a new Connect Key for API integration
 * 
 * When a new key is created, all old keys are automatically revoked
 * This ensures only one active key per user for security
 * 
 * Request body:
 * {
 *   "name": "My Integration",
 *   "permissions": ["services", "deposits", "balance"]
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "key": "connect_abc123...",
 *   "keyPreview": "connect_a...xyz",
 *   "keyId": "uuid",
 *   "name": "My Integration",
 *   "createdAt": "2024-01-01T00:00:00Z",
 *   "expiresAt": "2025-01-01T00:00:00Z"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
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
    const { name } = body
    const permissions = body.permissions || ['services', 'deposits', 'balance']

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Key name is required' },
        { status: 400 },
      )
    }

    if (name.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Key name must be 50 characters or less' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = request.headers.get('user-agent') || ''

    // Generate new key
    const plainKey = generateConnectKey()
    const keyHash = hashConnectKey(plainKey)
    const keyPreview = getKeyPreview(plainKey)
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 1) // 1 year expiry

    // Revoke all old keys for this user (security feature)
    await admin
      .from('connect_keys')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_active', true)
      .catch(err => console.error('[CREATE_KEY] Failed to revoke old keys:', err))

    // Insert new key
    const { data: newKey, error: insertError } = await admin
      .from('connect_keys')
      .insert({
        user_id: user.id,
        name: name.trim(),
        key_hash: keyHash,
        key_preview: keyPreview,
        permissions,
        is_active: true,
        created_ip: ipAddress,
        user_agent: userAgent,
        expires_at: expiresAt.toISOString(),
        max_requests_per_day: 10000,
      })
      .select('id, created_at')
      .single()

    if (insertError || !newKey) {
      console.error('[CREATE_KEY] Insert error:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create key' },
        { status: 500 },
      )
    }

    // Log key creation for audit
    await admin
      .from('connect_key_logs')
      .insert({
        user_id: user.id,
        key_id: newKey.id,
        endpoint: '/integrations/keys/create',
        method: 'POST',
        status_code: 201,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .catch(err => console.error('[CREATE_KEY] Failed to log creation:', err))

    return NextResponse.json(
      {
        success: true,
        key: plainKey,
        keyPreview,
        keyId: newKey.id,
        name: name.trim(),
        createdAt: newKey.created_at,
        expiresAt: expiresAt.toISOString(),
        message: 'API key created successfully. Save it securely - it cannot be retrieved again!',
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[CREATE_KEY] Error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
