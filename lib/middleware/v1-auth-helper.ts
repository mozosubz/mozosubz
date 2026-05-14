import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey, KeyVerificationResult } from './verify-connect-key'

/**
 * Helper for V1 API endpoints
 * Handles Connect Key verification and returns user context
 * 
 * Usage:
 * ```
 * const auth = await v1Auth(request)
 * if (!auth.success) return auth.response
 * 
 * const userId = auth.userId
 * ```
 */
export async function v1Auth(request: NextRequest) {
  const verification = await verifyConnectKey(request)

  if (!verification.success) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: verification.error },
        { status: verification.status || 401 },
      ),
    }
  }

  return {
    success: true,
    userId: verification.context!.userId,
    keyId: verification.context!.keyId,
    keyName: verification.context!.keyName,
    permissions: verification.context!.permissions,
  }
}

/**
 * Enhanced v1Auth with automatic error response
 * Returns null if auth fails (response already sent)
 */
export async function v1AuthOrRespond(
  request: NextRequest,
): Promise<{ userId: string; keyId: string; keyName: string; permissions: string[] } | null> {
  const auth = await v1Auth(request)
  if (!auth.success) {
    return null
  }
  return {
    userId: auth.userId,
    keyId: auth.keyId,
    keyName: auth.keyName,
    permissions: auth.permissions,
  }
}

/**
 * Validate user has required permission
 */
export function hasPermission(permissions: string[], required: string): boolean {
  return permissions.includes('all') || permissions.includes(required)
}
