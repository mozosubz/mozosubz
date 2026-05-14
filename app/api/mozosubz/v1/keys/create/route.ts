import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { generateConnectKey, hashConnectKey, getKeyPreview } from '@/lib/utils/connect-key'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/utils/rate-limit'

/**
 * POST /api/mozosubz/v1/keys/create
 * 
 * Create a new Connect Key for API integration
 * Requires user to be authenticated
 * 
 * When a new key is created, all old keys are automatically revoked
 */
export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-KEYS-CREATE] Request started')
  try {
    // Verify user is authenticated
    console.log('[MOZOSUBZ-V1-KEYS-CREATE] Creating server client...')
    const client = await createServerClient()
    const {
      data: { user },
    } = await client.auth.getUser()

    console.log('[MOZOSUBZ-V1-KEYS-CREATE] User ID:', user?.id)

    if (!user) {
      console.warn('[MOZOSUBZ-V1-KEYS-CREATE] User not authenticated')
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please log in' },
        { status: 401 },
      )
    }

    // Rate limiting
    const ip = getRateLimitIdentifier(request)
    console.log('[MOZOSUBZ-V1-KEYS-CREATE] Checking rate limit for IP:', ip)
    const { allowed } = await checkRateLimit(ip, {
      interval: 3600000, // 1 hour
      maxRequests: 5, // Max 5 keys per hour
      keyPrefix: 'rl:api:keys:create'
    })

    if (!allowed) {
      console.warn('[MOZOSUBZ-V1-KEYS-CREATE] Rate limit exceeded for IP:', ip)
      return NextResponse.json(
        { success: false, error: 'Too many key creation attempts. Try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { name } = body
    console.log('[MOZOSUBZ-V1-KEYS-CREATE] Requested key name:', name)

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      console.warn('[MOZOSUBZ-V1-KEYS-CREATE] Invalid key name')
      return NextResponse.json(
        { success: false, error: 'Key name is required' },
        { status: 400 },
      )
    }

    if (name.length > 100) {
      console.warn('[MOZOSUBZ-V1-KEYS-CREATE] Key name too long')
      return NextResponse.json(
        { success: false, error: 'Key name must be less than 100 characters' },
        { status: 400 },
      )
    }

    // Generate new secure key
    console.log('[MOZOSUBZ-V1-KEYS-CREATE] Generating new key...')
    const plainKey = generateConnectKey()
    const hashedKey = hashConnectKey(plainKey)
    const keyPreview = getKeyPreview(plainKey)
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)

    // Revoke all old keys for this user
    console.log('[MOZOSUBZ-V1-KEYS-CREATE] Revoking old keys for user:', user.id)
    await client
      .from('connect_keys')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_active', true)

    // Insert new key
    console.log('[MOZOSUBZ-V1-KEYS-CREATE] Inserting new key...')
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
      console.error('[MOZOSUBZ-V1-KEYS-CREATE] Insert error:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create key' },
        { status: 500 },
      )
    }

    console.log('[MOZOSUBZ-V1-KEYS-CREATE] Key created successfully:', newKey.id)

    return NextResponse.json({
      success: true,
      key: plainKey, // Only shown once!
      keyPreview,
      keyId: newKey.id,
      name: newKey.name,
      createdAt: newKey.created_at,
      expiresAt: newKey.expires_at,
      warning: 'IMPORTANT: Save your key now. You won\'t be able to see it again!',
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1-KEYS-CREATE] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
