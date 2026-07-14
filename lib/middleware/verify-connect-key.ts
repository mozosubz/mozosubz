import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashConnectKey, isValidKeyFormat } from '@/lib/utils/connect-key'

// ─── In-memory key cache ───────────────────────────────────────────────────────
// Stores only the minimal context needed — never the raw key or full DB row.
interface CachedContext {
  userId: string
  keyId: string
  keyName: string
  permissions: string[]
  expiresAt: string | null
}

interface CacheEntry {
  context: CachedContext
  timestamp: number
}

const keyCache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCachedContext(keyHash: string): CachedContext | undefined {
  const entry = keyCache.get(keyHash)
  if (!entry) return undefined
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    keyCache.delete(keyHash)
    return undefined
  }
  return entry.context
}

function setCachedContext(keyHash: string, context: CachedContext) {
  keyCache.set(keyHash, { context, timestamp: Date.now() })
}

// ─── Types ─────────────────────────────────────────────────────────────────────
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

// ─── Main verifier ─────────────────────────────────────────────────────────────
export async function verifyConnectKey(
  request: NextRequest,
): Promise<KeyVerificationResult> {
  const key = request.headers.get('X-Connect-Key')

  if (!key || !isValidKeyFormat(key)) {
    return { success: false, error: 'Invalid or missing API key', status: 401 }
  }

  const keyHash = hashConnectKey(key)

  // Serve from cache when available (avoids a DB round-trip per request)
  const cached = getCachedContext(keyHash)
  if (cached) {
    // Re-check expiry even on cache hit
    if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
      keyCache.delete(keyHash)
      return { success: false, error: 'API key has expired', status: 401 }
    }
    return { success: true, context: cached }
  }

  try {
    const admin = createAdminClient()

    const { data: connectKey, error } = await admin
      .from('connect_keys')
      .select(
        'id, user_id, name, permissions, is_active, revoked_at, expires_at, request_count, request_count_reset_at',
      )
      .eq('key_hash', keyHash)
      .maybeSingle()

    if (error) {
      return { success: false, error: 'Authentication service error', status: 500 }
    }

    if (!connectKey) {
      return { success: false, error: 'Invalid API key', status: 401 }
    }

    // ── Validate key state ──────────────────────────────────────────────────
    if (!connectKey.is_active || connectKey.revoked_at) {
      return { success: false, error: 'API key is inactive or has been revoked', status: 401 }
    }

    if (connectKey.expires_at && new Date(connectKey.expires_at) < new Date()) {
      return { success: false, error: 'API key has expired', status: 401 }
    }

    // ── Rate limit (10,000 requests / day) ─────────────────────────────────
    const now = new Date()
    const requestCount = connectKey.request_count ?? 0
    const resetAt = connectKey.request_count_reset_at
      ? new Date(connectKey.request_count_reset_at)
      : new Date(now.getTime() - 25 * 60 * 60 * 1000) // older than 24 h → force reset

    const windowExpired = now.getTime() - resetAt.getTime() > 24 * 60 * 60 * 1000

    if (windowExpired) {
      // Non-blocking reset
      admin
        .from('connect_keys')
        .update({
          request_count: 1,
          request_count_reset_at: now.toISOString(),
          last_used_at: now.toISOString(),
        })
        .eq('id', connectKey.id)
        .then()
        .catch(() => {})
    } else {
      if (requestCount >= 10_000) {
        return {
          success: false,
          error: 'Daily rate limit exceeded (10,000 requests/day)',
          status: 429,
        }
      }

      // Non-blocking increment
      admin
        .from('connect_keys')
        .update({
          request_count: requestCount + 1,
          last_used_at: now.toISOString(),
        })
        .eq('id', connectKey.id)
        .then()
        .catch(() => {})
    }

    const context: CachedContext = {
      userId: connectKey.user_id,
      keyId: connectKey.id,
      keyName: connectKey.name,
      permissions: connectKey.permissions ?? ['data', 'airtime'],
      expiresAt: connectKey.expires_at ?? null,
    }

    setCachedContext(keyHash, context)

    return { success: true, context }
  } catch {
    return { success: false, error: 'Internal server error', status: 500 }
  }
}

/**
 * Convenience helper — returns the userId or null if verification fails.
 */
export async function getUserIdFromConnectKey(
  request: NextRequest,
): Promise<string | null> {
  const result = await verifyConnectKey(request)
  return result.success ? (result.context?.userId ?? null) : null
}
