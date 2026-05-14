import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashConnectKey, isValidKeyFormat } from '@/lib/utils/connect-key'

export interface ConnectKeyContext {
  userId: string
  keyId: string
  keyName: string
  permissions: string[]
}

export interface KeyVerificationResult {
  success: boolean
  error?: string
  status?: number
  context?: ConnectKeyContext
}

/**
 * Verify Connect Key from X-Connect-Key header
 */
export async function verifyConnectKey(
  request: NextRequest,
): Promise<KeyVerificationResult> {
  const key = request.headers.get('X-Connect-Key')
  const ipAddress = request.headers.get('x-forwarded-for') || 'unknown'
  const userAgent = request.headers.get('user-agent') || ''
  const endpoint = request.nextUrl.pathname

  console.log(`[MOZOSUBZ-API] Request to ${endpoint}`)
  console.log(`[MOZOSUBZ-API] Connect Key received: ${key ? key.substring(0, 20) + '...' : 'NONE'}`)
  console.log(`[MOZOSUBZ-API] IP Address: ${ipAddress}`)

  // Validate key format first
  if (!key || !isValidKeyFormat(key)) {
    console.warn(`[MOZOSUBZ-API] Invalid key format attempt from ${ipAddress}`)
    return {
      success: false,
      error: 'Invalid API key format',
      status: 400,
    }
  }

  try {
    const admin = createAdminClient()
    const keyHash = hashConnectKey(key)

    console.log(`[MOZOSUBZ-API] Verifying key hash: ${keyHash.substring(0, 20)}...`)

    // Fetch key from database
    const { data: connectKey, error } = await admin
      .from('connect_keys')
      .select('id, user_id, name, permissions, is_active, revoked_at, expires_at, request_count, request_count_reset_at')
      .eq('key_hash', keyHash)
      .maybeSingle()

    if (error) {
      console.error('[MOZOSUBZ-API] Key verification DB error:', error.message, error.code, error.status)
      console.error('[MOZOSUBZ-API] Full error:', JSON.stringify(error, null, 2))
      return {
        success: false,
        error: 'Authentication service error',
        status: 500,
      }
    }

    if (!connectKey) {
      console.warn(`[MOZOSUBZ-API] Key not found in database`)
      return {
        success: false,
        error: 'Invalid API key',
        status: 401,
      }
    }

    console.log(`[MOZOSUBZ-API] Key found: ${connectKey.name} (User: ${connectKey.user_id})`)

    // Check if key is active
    if (!connectKey.is_active) {
      console.warn(`[MOZOSUBZ-API] Key is inactive`)
      return {
        success: false,
        error: 'API key is inactive',
        status: 401,
      }
    }

    // Check if key is revoked
    if (connectKey.revoked_at) {
      console.warn(`[MOZOSUBZ-API] Key is revoked`)
      return {
        success: false,
        error: 'API key has been revoked',
        status: 401,
      }
    }

    // Check if key is expired
    if (connectKey.expires_at && new Date(connectKey.expires_at) < new Date()) {
      console.warn(`[MOZOSUBZ-API] Key has expired`)
      return {
        success: false,
        error: 'API key has expired',
        status: 401,
      }
    }

    // Check rate limit (10,000 requests per day)
    const now = new Date()
    let requestCount = connectKey.request_count || 0
    const resetTime = connectKey.request_count_reset_at 
      ? new Date(connectKey.request_count_reset_at)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000)

    console.log(`[MOZOSUBZ-API] Current request count: ${requestCount}/10000`)

    // Reset counter if more than 24 hours have passed
    if (now.getTime() - resetTime.getTime() > 24 * 60 * 60 * 1000) {
      requestCount = 0
      console.log(`[MOZOSUBZ-API] Rate limit counter reset`)
      await admin
        .from('connect_keys')
        .update({
          request_count: 1,
          request_count_reset_at: now.toISOString(),
          last_used_at: now.toISOString(),
        })
        .eq('id', connectKey.id)
    } else {
      // Check if limit exceeded
      if (requestCount >= 10000) {
        console.warn(`[MOZOSUBZ-API] Rate limit exceeded`)
        return {
          success: false,
          error: 'Rate limit exceeded. Max 10,000 requests per day.',
          status: 429,
        }
      }

      // Increment counter
      await admin
        .from('connect_keys')
        .update({
          request_count: requestCount + 1,
          last_used_at: now.toISOString(),
        })
        .eq('id', connectKey.id)
    }

    console.log(`[MOZOSUBZ-API] Authorization successful for endpoint: ${endpoint}`)

    return {
      success: true,
      context: {
        userId: connectKey.user_id,
        keyId: connectKey.id,
        keyName: connectKey.name,
        permissions: connectKey.permissions || [],
      },
    }
  } catch (error) {
    console.error('[MOZOSUBZ-API] Connect key verification error:', error)
    return {
      success: false,
      error: 'Internal server error',
      status: 500,
    }
  }
}
