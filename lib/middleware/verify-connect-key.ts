import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashConnectKey, isValidKeyFormat } from '@/lib/utils/connect-key'

// In-memory cache for keys (TTL: 5 minutes)
const keyCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000

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
 * Get cached key or undefined if expired
 */
function getCachedKey(keyHash: string) {
  const cached = keyCache.get(keyHash)
  if (!cached) return undefined
  
  const now = Date.now()
  if (now - cached.timestamp > CACHE_TTL) {
    keyCache.delete(keyHash)
    return undefined
  }
  
  return cached.data
}

/**
 * Cache a key with timestamp
 */
function cacheKey(keyHash: string, data: any) {
  keyCache.set(keyHash, {
    data,
    timestamp: Date.now(),
  })
}

/**
 * Verify Connect Key from X-Connect-Key header
 * Includes caching, rate limiting, and comprehensive validation
 */
export async function verifyConnectKey(
  request: NextRequest,
): Promise<KeyVerificationResult> {
  const key = request.headers.get('X-Connect-Key')
  const endpoint = request.nextUrl.pathname

  console.log(`[MOZOSUBZ-V1-AUTH] Endpoint: ${endpoint}`)

  if (!key || !isValidKeyFormat(key)) {
    console.warn(`[MOZOSUBZ-V1-AUTH] Invalid key format`)
    return {
      success: false,
      error: 'Invalid API key format',
      status: 400,
    }
  }

  try {
    const keyHash = hashConnectKey(key)
    
    // Check cache first
    const cachedKey = getCachedKey(keyHash)
    if (cachedKey) {
      console.log(`[MOZOSUBZ-V1-AUTH] Key verified (cached)`)
      return {
        success: true,
        context: {
          userId: cachedKey.user_id,
          keyId: cachedKey.id,
          keyName: cachedKey.name,
          permissions: cachedKey.permissions || ['all'],
        },
      }
    }

    const admin = createAdminClient()

    console.log(`[MOZOSUBZ-V1-AUTH] Verifying key`)

    const { data: connectKey, error } = await admin
      .from('connect_keys')
      .select('id, user_id, name, permissions, is_active, revoked_at, expires_at, request_count, request_count_reset_at')
      .eq('key_hash', keyHash)
      .maybeSingle()

    if (error) {
      console.error('[MOZOSUBZ-V1-AUTH] Database error during verification')
      return {
        success: false,
        error: 'Authentication service error',
        status: 500,
      }
    }

    if (!connectKey) {
      console.warn(`[MOZOSUBZ-V1-AUTH] Key not found`)
      return {
        success: false,
        error: 'Invalid API key',
        status: 401,
      }
    }

    console.log(`[MOZOSUBZ-V1-AUTH] Key verified`)

    // Validate key status
    if (!connectKey.is_active) {
      console.warn(`[MOZOSUBZ-V1-AUTH] Key inactive`)
      return {
        success: false,
        error: 'API key is inactive',
        status: 401,
      }
    }

    if (connectKey.revoked_at) {
      console.warn(`[MOZOSUBZ-V1-AUTH] Key revoked`)
      return {
        success: false,
        error: 'API key has been revoked',
        status: 401,
      }
    }

    if (connectKey.expires_at && new Date(connectKey.expires_at) < new Date()) {
      console.warn(`[MOZOSUBZ-V1-AUTH] Key expired`)
      return {
        success: false,
        error: 'API key has expired',
        status: 401,
      }
    }

    // Check and update rate limit
    const now = new Date()
    let requestCount = connectKey.request_count || 0
    const resetTime = connectKey.request_count_reset_at 
      ? new Date(connectKey.request_count_reset_at)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000)

    if (now.getTime() - resetTime.getTime() > 24 * 60 * 60 * 1000) {
      // Reset counter
      requestCount = 0
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
        console.warn(`[MOZOSUBZ-V1-AUTH] Rate limit exceeded`)
        return {
          success: false,
          error: 'Rate limit exceeded. Max 10,000 requests per day.',
          status: 429,
        }
      }

      // Increment counter (non-blocking)
      admin
        .from('connect_keys')
        .update({
          request_count: requestCount + 1,
          last_used_at: now.toISOString(),
        })
        .eq('id', connectKey.id)
        .then()
        .catch(err => console.error('[MOZOSUBZ-V1-AUTH] Failed to update count:', err))
    }

    // Cache the key
    cacheKey(keyHash, connectKey)

    console.log(`[MOZOSUBZ-V1-AUTH] Authorization successful`)

    return {
      success: true,
      context: {
        userId: connectKey.user_id,
        keyId: connectKey.id,
        keyName: connectKey.name,
        permissions: connectKey.permissions || ['all'],
      },
    }
  } catch (error) {
    console.error('[MOZOSUBZ-V1-AUTH] Verification error')
    return {
      success: false,
      error: 'Internal server error',
      status: 500,
    }
  }
}

/**
 * Extract user ID from verified Connect Key
 * Returns null if verification fails
 */
export async function getUserIdFromConnectKey(
  request: NextRequest,
): Promise<string | null> {
  const result = await verifyConnectKey(request)
  return result.success ? result.context?.userId || null : null
}
