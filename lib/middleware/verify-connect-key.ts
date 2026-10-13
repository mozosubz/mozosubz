import "server-only"
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashConnectKey, isValidKeyFormat } from '@/lib/utils/connect-key'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/utils/rate-limit'
import { isUserBanned } from '@/lib/utils/bans'

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
// Short TTL on purpose: the cached context skips the connect_keys DB read,
// and this bounds how stale key metadata (name/permissions) can get. Bans are
// NOT subject to this TTL — the verifier re-checks the profile on every
// request, cache hit or miss.
const CACHE_TTL = 60 * 1000 // 1 minute

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

/**
 * Drop every cached context belonging to a user. Called when an account is
 * banned or unbanned from /admin/users so this instance stops honouring (or
 * immediately starts honouring) their keys; other instances pick the change
 * up on their next cache miss (<= 5 minutes).
 */
export function clearConnectKeyCacheForUser(userId: string) {
  if (!userId) return
  for (const [keyHash, entry] of keyCache) {
    if (entry.context.userId === userId) {
      keyCache.delete(keyHash)
    }
  }
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

// ─── Failed-attempt throttle ───────────────────────────────────────────────────
// Bounty remediation #6: key guessing had no throttle (2,000 attempts → 0×429).
// Only *failed* attempts are counted, so a legitimate caller presenting a valid
// key is never affected.
async function fail(
  request: NextRequest,
  error: string,
  status: number,
): Promise<KeyVerificationResult> {
  const ip = getRateLimitIdentifier(request)
  const { allowed } = await checkRateLimit(ip, {
    interval: 60000,
    maxRequests: 20,
    keyPrefix: 'rl:connect:keyfail',
  })
  if (!allowed) {
    return {
      success: false,
      error: 'Too many failed authentication attempts. Try again later.',
      status: 429,
    }
  }
  return { success: false, error, status }
}

// ─── Main verifier ─────────────────────────────────────────────────────────────
export async function verifyConnectKey(
  request: NextRequest,
): Promise<KeyVerificationResult> {
  const key = request.headers.get('X-Connect-Key')

  if (!key || !isValidKeyFormat(key)) {
    return fail(request, 'Invalid or missing API key', 401)
  }

  const keyHash = hashConnectKey(key)

  // Serve from cache when available (avoids the connect_keys DB round-trip).
  // The ban check below still runs on every request — cached or not — so an
  // admin ban takes effect on the very next API call, on every instance.
  const cached = getCachedContext(keyHash)
  if (cached) {
    // Re-check expiry even on cache hit
    if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
      keyCache.delete(keyHash)
      return fail(request, 'API key has expired', 401)
    }
    if (await isUserBanned(cached.userId)) {
      keyCache.delete(keyHash)
      return { success: false, error: 'This account has been suspended', status: 403 }
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
      return fail(request, 'Invalid API key', 401)
    }

    // ── Validate key state ──────────────────────────────────────────────────
    if (!connectKey.is_active || connectKey.revoked_at) {
      return fail(request, 'API key is inactive or has been revoked', 401)
    }

    if (connectKey.expires_at && new Date(connectKey.expires_at) < new Date()) {
      return fail(request, 'API key has expired', 401)
    }

    // ── Account ban check ───────────────────────────────────────────────────
    // Runs on every request (cache hit or miss): a banned account's keys stop
    // working on the very next call, everywhere. One indexed PK read.
    if (await isUserBanned(connectKey.user_id)) {
      keyCache.delete(keyHash)
      return { success: false, error: 'This account has been suspended', status: 403 }
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
        .then(undefined, () => {})
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
        .then(undefined, () => {})
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
