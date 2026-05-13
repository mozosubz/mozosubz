import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/integrations/keys/list
 * 
 * List all Connect Keys for the authenticated user
 * 
 * Response:
 * {
 *   "success": true,
 *   "keys": [
 *     {
 *       "id": "uuid",
 *       "name": "My Integration",
 *       "keyPreview": "connect_a...xyz",
 *       "permissions": ["services", "deposits", "balance"],
 *       "isActive": true,
 *       "lastUsedAt": "2024-01-01T00:00:00Z",
 *       "createdAt": "2024-01-01T00:00:00Z",
 *       "expiresAt": "2025-01-01T00:00:00Z"
 *     }
 *   ]
 * }
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

    const admin = createAdminClient()

    const { data: keys, error } = await admin
      .from('connect_keys')
      .select('id, name, key_preview, permissions, is_active, last_used_at, created_at, expires_at, revoked_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[LIST_KEYS] Error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch keys' },
        { status: 500 },
      )
    }

    const formattedKeys = keys.map(k => ({
      id: k.id,
      name: k.name,
      keyPreview: k.key_preview,
      permissions: k.permissions || [],
      isActive: k.is_active && !k.revoked_at,
      lastUsedAt: k.last_used_at,
      createdAt: k.created_at,
      expiresAt: k.expires_at,
      revokedAt: k.revoked_at,
    }))

    return NextResponse.json(
      {
        success: true,
        keys: formattedKeys,
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[LIST_KEYS] Error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
