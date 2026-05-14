import crypto from 'crypto'

/**
 * Generate a secure connect key
 * Format: connect_[random]_[timestamp]
 * Length: 48+ characters for strong security
 * Cryptographically random using crypto.randomBytes
 */
export function generateConnectKey(): string {
  const randomBytes = crypto.randomBytes(24).toString('hex')
  const timestamp = Date.now().toString(16)
  return `connect_${randomBytes}_${timestamp}`
}

/**
 * Hash a connect key for storage using SHA-256
 * One-way hash prevents key recovery even if database is compromised
 */
export function hashConnectKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Get preview of key for display (first 8 chars + last 4)
 * Safe to display in UI/logs
 */
export function getKeyPreview(key: string): string {
  const start = key.substring(0, 8)
  const end = key.substring(key.length - 4)
  return `${start}...${end}`
}

/**
 * Validate key format matches expected pattern
 * Prevents invalid keys from being processed
 */
export function isValidKeyFormat(key: string): boolean {
  return /^connect_[a-f0-9]{48}_[0-9a-f]+$/.test(key)
}

/**
 * Constant-time comparison to prevent timing attacks
 */
export function compareKeyWithHash(plainKey: string, hash: string): boolean {
  const keyHash = hashConnectKey(plainKey)
  try {
    return crypto.timingSafeEqual(Buffer.from(keyHash), Buffer.from(hash))
  } catch {
    // Buffers are different lengths, hashes don't match
    return false
  }
}

/**
 * Generate a shortened display name for a key
 * Shows only enough to identify the key safely
 */
export function generateKeyName(baseName: string): string {
  const timestamp = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  })
  return `${baseName} (${timestamp})`
}

/**
 * Validate a connect key is well-formed before processing
 */
export function validateConnectKey(key: unknown): key is string {
  if (typeof key !== 'string') return false
  if (key.length < 56) return false // Minimum length check
  if (key.length > 256) return false // Maximum length check
  return isValidKeyFormat(key)
}
