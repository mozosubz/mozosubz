import crypto from 'crypto'

/**
 * Generate a secure session token for WhatsApp
 * Format: Random 32 character hex string
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Validate a session token (basic check)
 */
export async function validateSessionToken(token: string): Promise<boolean> {
  if (!token) return false
  // Tokens should be 32 character hex strings
  return /^[a-f0-9]{32}$/i.test(token)
}
