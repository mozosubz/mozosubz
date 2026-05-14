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
  const endpoint = request.nextUrl.pathname

  console.log(`[MOZOSUBZ-V1-API] Endpoint: ${endpoint}`)
  console.log(`[MOZOSUBZ-V1-API] IP: ${ipAddress}`)
  console.log(`[MOZOSUBZ-V1-API] Key status: ${key ? 'provided' : 'missing'}`)

  if (!key || !isValidKeyFormat(key)) {
    console.warn(`[MOZOSUBZ-V1-API] Invalid key format`)
    return {
      success: false,
      error: 'Invalid API key format',
      status: 400,
    }
  }

  try {
    const admin = createAdminClient()
    const keyHash = hashConnectKey(key)

    console.log(`[MOZOSUBZ-V1-API] Verifying key...`)

    const { data: connectKey, error } = await admin
      .from('connect_keys')
      .select('id, user_id, name, permissions, is_active, revoked_at, expires_at, request_count, request_count_reset_at')
      .eq('key_hash', keyHash)
      .maybeSingle()

    if (error) {
      console.error('[MOZOSUBZ-V1-API] Database error')
      return {
        success: false,
        error: 'Authentication service error',
        status: 500,
      }
    }

    if (!connectKey) {
      console.warn(`[MOZOSUBZ-V1-API] Key not found`)
      return {
        success: false,
        error: 'Invalid API key',
        status: 401,
      }
    }

    console.log(`[MOZOSUBZ-V1-API] Key verified: ${connectKey.name}`)

    if (!connectKey.is_active) {
      console.warn(`[MOZOSUBZ-V1-API] Key inactive`)
      return {
        success: false,
        error: 'API key is inactive',
        status: 401,
      }
    }

    if (connectKey.revoked_at) {
      console.warn(`[MOZOSUBZ-V1-API] Key revoked`)
      return {
        success: false,
        error: 'API key has been revoked',
        status: 401,
      }
    }

    if (connectKey.expires_at && new Date(connectKey.expires_at) < new Date()) {
      console.warn(`[MOZOSUBZ-V1-API] Key expired`)
      return {
        success: false,
        error: 'API key has expired',
        status: 401,
      }
    }

    const now = new Date()
    let requestCount = connectKey.request_count || 0
    const resetTime = connectKey.request_count_reset_at 
      ? new Date(connectKey.request_count_reset_at)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000)

    if (now.getTime() - resetTime.getTime() > 24 * 60 * 60 * 1000) {
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
      if (requestCount >= 10000) {
        console.warn(`[MOZOSUBZ-V1-API] Rate limit exceeded`)
        return {
          success: false,
          error: 'Rate limit exceeded. Max 10,000 requests per day.',
          status: 429,
        }
      }

      await admin
        .from('connect_keys')
        .update({
          request_count: requestCount + 1,
          last_used_at: now.toISOString(),
        })
        .eq('id', connectKey.id)
    }

    console.log(`[MOZOSUBZ-V1-API] Authorization successful`)

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
    console.error('[MOZOSUBZ-V1-API] Verification error')
    return {
      success: false,
      error: 'Internal server error',
      status: 500,
    }
  }
}
