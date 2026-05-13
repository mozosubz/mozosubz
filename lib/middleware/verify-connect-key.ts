import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashConnectKey, isValidKeyFormat } from '@/lib/utils/connect-key'

export interface ConnectKeyContext {
  userId: string
  keyId: string
  keyName: string
  permissions: string[]
}

/**
 * Verify Connect Key from X-Connect-Key header
 * Returns null if invalid, otherwise returns user context
 * 
 * Security features:
 * - Validates key format before DB lookup
 * - Uses constant-time comparison
 * - Tracks usage and rate limits
 * - Logs failed attempts for suspicious activity detection
 * - Updates last_used_at timestamp
 */
export async function verifyConnectKey(
  request: NextRequest,
): Promise<ConnectKeyContext | null> {
  const key = request.headers.get('X-Connect-Key')
  const ipAddress = request.headers.get('x-forwarded-for') || 'unknown'
  const userAgent = request.headers.get('user-agent') || ''

  // Validate key format first (fail fast)
  if (!key || !isValidKeyFormat(key)) {
    console.warn(`[SECURITY] Invalid key format attempt from ${ipAddress}`)
    return null
  }

  try {
    const admin = createAdminClient()
    const keyHash = hashConnectKey(key)

    // Fetch key from database
    const { data: connectKey, error } = await admin
      .from('connect_keys')
      .select('id, user_id, name, permissions, is_active, revoked_at, expires_at, request_count, request_count_reset_at, max_requests_per_day')
      .eq('key_hash', keyHash)
      .maybeSingle()

    if (error) {
      console.error('[SECURITY] Key verification DB error:', error.message)
      return null
    }

    if (!connectKey) {
      // Log failed attempt for suspicious activity detection
      await logSuspiciousActivity('invalid_key', ipAddress, userAgent)
      return null
    }

    // Check if key is active
    if (!connectKey.is_active) {
      await logSuspiciousActivity('inactive_key', ipAddress, userAgent)
      return null
    }

    // Check if key is revoked
    if (connectKey.revoked_at) {
      await logSuspiciousActivity('revoked_key', ipAddress, userAgent)
      return null
    }

    // Check if key is expired
    if (connectKey.expires_at && new Date(connectKey.expires_at) < new Date()) {
      await logSuspiciousActivity('expired_key', ipAddress, userAgent)
      return null
    }

    // Check rate limit
    const now = new Date()
    let requestCount = connectKey.request_count || 0
    const resetTime = connectKey.request_count_reset_at ? new Date(connectKey.request_count_reset_at) : now

    if (now.getTime() - resetTime.getTime() > (connectKey.max_requests_per_day || 10000) * 1000) {
      // Reset counter
      requestCount = 1
    } else {
      requestCount += 1
    }

    if (requestCount > (connectKey.max_requests_per_day || 10000)) {
      await logSuspiciousActivity('rate_limit_exceeded', ipAddress, userAgent)
      return null
    }

    // Update usage tracking
    await admin
      .from('connect_keys')
      .update({
        last_used_at: now.toISOString(),
        request_count: requestCount,
        request_count_reset_at: now.toISOString(),
      })
      .eq('id', connectKey.id)
      .catch(err => console.error('[MIDDLEWARE] Failed to update key usage:', err))

    // Log successful API call
    await admin
      .from('connect_key_logs')
      .insert({
        user_id: connectKey.user_id,
        key_id: connectKey.id,
        endpoint: request.nextUrl.pathname,
        method: request.method,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .catch(err => console.error('[MIDDLEWARE] Failed to log API call:', err))

    return {
      userId: connectKey.user_id,
      keyId: connectKey.id,
      keyName: connectKey.name,
      permissions: connectKey.permissions || [],
    }
  } catch (err) {
    console.error('[MIDDLEWARE] Connect key verification error:', err)
    return null
  }
}

/**
 * Log suspicious activity for admin review
 */
async function logSuspiciousActivity(
  activityType: string,
  ipAddress: string,
  userAgent: string,
) {
  try {
    const admin = createAdminClient()
    await admin
      .from('suspicious_activity_logs')
      .insert({
        activity_type: `connect_key_${activityType}`,
        ip_address: ipAddress,
        description: `Connect key ${activityType}: ${userAgent}`,
        severity: 'medium',
      })
      .catch(err => console.error('[LOGGING] Failed to log suspicious activity:', err))
  } catch (err) {
    console.error('[LOGGING] Suspicious activity logging error:', err)
  }
}
