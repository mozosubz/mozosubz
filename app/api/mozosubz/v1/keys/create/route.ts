import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { generateConnectKey, hashConnectKey, getKeyPreview } from '@/lib/utils/connect-key'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/utils/rate-limit'

/**
 * POST /api/mozosubz/v1/keys/create
 *
 * Create a new Connect Key for API integration.
 * Requires the user to be authenticated.
 *
 * When a new key is created, all old active keys for this user are automatically
 * revoked.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the request is coming from an authenticated session
    const client = await createServerClient()
    const {
      data: { user },
    } = await client.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please log in' },
        { status: 401 },
      )
    }

    // Rate limiting (do not log the IP)
    const ip = getRateLimitIdentifier(request)
    const { allowed } = await checkRateLimit(ip, {
      interval: 3600000, // 1 hour
      maxRequests: 5,
      keyPrefix: 'rl:api:keys:create',
    })

    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many key creation attempts. Try again later.' },
        { status: 429 },
      )
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Key name is required' },
        { status: 400 },
      )
    }

    if (name.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Key name must be less than 100 characters' },
        { status: 400 },
      )
    }

    // Generate new secure key
    const plainKey = generateConnectKey()
    const hashedKey = hashConnectKey(plainKey)
    const keyPreview = getKeyPreview(plainKey)
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)

    // Revoke all old active keys for this user
    await client
      .from('connect_keys')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_active', true)

    // Insert new key
    const { data: newKey, error: insertError } = await client
      .from('connect_keys')
      .insert({
        user_id: user.id,
        name: name.trim(),
        key_hash: hashedKey,
        key_preview: keyPreview,
        is_active: true,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        last_used_at: null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[KEYS-CREATE] Insert failed')
      return NextResponse.json(
        { success: false, error: 'Failed to create key' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      key: plainKey, // Only shown once!
      keyPreview,
      keyId: newKey.id,
      name: newKey.name,
      createdAt: newKey.created_at,
      expiresAt: newKey.expires_at,
      warning: "IMPORTANT: Save your key now. You won't be able to see it again!",
    })
  } catch {
    console.error('[KEYS-CREATE] Unexpected error')
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
