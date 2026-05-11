import crypto from 'crypto'

/**
 * Generate a secure WhatsApp connection token
 * Format: MZ_XXXXXXXX (8 random characters after prefix)
 * Returns raw token to be shown to user once
 */
export function generateConnectToken(): string {
  const randomBytes = crypto.randomBytes(6).toString('hex').toUpperCase()
  return `MZ_${randomBytes}`
}

/**
 * Hash a WhatsApp connection token
 * Stores only hash in database, never the raw token
 */
export function hashConnectToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Verify token hash
 */
export function verifyTokenHash(token: string, hash: string): boolean {
  return hashConnectToken(token) === hash
}

/**
 * Format WhatsApp number to E.164 format
 * Handles various formats like 09056458312, 2349056458312, +2349056458312
 */
export function normalizeWhatsAppNumber(number: string): string {
  // Remove all non-digit characters
  let cleaned = number.replace(/\D/g, '')

  // Handle Nigerian numbers (starts with 9, 8, 7, 0)
  if (cleaned.length === 10 && /^[9870]/.test(cleaned)) {
    cleaned = '234' + cleaned.substring(1)
  }

  // Handle numbers already with country code but no +
  if (cleaned.length === 12 && cleaned.startsWith('234')) {
    // Already good
  } else if (cleaned.length === 13 && cleaned.startsWith('234')) {
    // Duplicate 234, remove one
    cleaned = cleaned.substring(1)
  }

  return '+' + cleaned
}

/**
 * Validate WhatsApp number format
 */
export function isValidWhatsAppNumber(number: string): boolean {
  try {
    const normalized = normalizeWhatsAppNumber(number)
    // Should be +234XXXXXXXXXX (13 chars total)
    return normalized.length === 13 && normalized.startsWith('+234')
  } catch {
    return false
  }
}
