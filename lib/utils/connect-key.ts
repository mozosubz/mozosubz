import crypto from 'crypto'

/**
 * Generate a secure connect key
 * Format: connect_[random]_[timestamp]
 * Length: 48 characters for strong security
 */
export function generateConnectKey(): string {
  const randomBytes = crypto.randomBytes(24).toString('hex')
  const timestamp = Date.now().toString(16)
  return `connect_${randomBytes}_${timestamp}`
}

/**
 * Hash a connect key for storage
 * Uses SHA-256 for secure hashing
 */
export function hashConnectKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Get preview of key for display (first 8 chars + last 4)
 * Safe to display in UI
 */
export function getKeyPreview(key: string): string {
  const start = key.substring(0, 8)
  const end = key.substring(key.length - 4)
  return `${start}...${end}`
}

/**
 * Validate key format
 */
export function isValidKeyFormat(key: string): boolean {
  return /^connect_[a-f0-9]{48}_[0-9a-f]+$/.test(key)
}

/**
 * Compare plain key with hash
 */
export function compareKeyWithHash(plainKey: string, hash: string): boolean {
  const keyHash = hashConnectKey(plainKey)
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(keyHash), Buffer.from(hash))
}
