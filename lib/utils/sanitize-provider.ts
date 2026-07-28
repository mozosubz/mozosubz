/**
 * Masks the provider brand name ("gsubz", any capitalisation) wherever it
 * appears in string values that reach a client, API consumer, or the admin UI.
 *
 * Rules:
 * - Only the exact word "gsubz" (case-insensitive) is replaced with "*****".
 * - Object keys are NEVER touched — only string values.
 * - The object's shape, numeric/boolean/null values, arrays, and all other
 *   data are passed through completely unchanged.
 */

export const PROVIDER_MASK = '*****'

/** Case-insensitive match for the exact word "gsubz" only. */
const PROVIDER_PATTERN = /gsubz/gi

/** Replaces every occurrence of "gsubz" (any case) in a string with *****. */
export function maskProviderName(value: string): string {
  return value.replace(PROVIDER_PATTERN, PROVIDER_MASK)
}

/** True when the string contains "gsubz" in any capitalisation. */
export function containsProviderName(value: unknown): boolean {
  if (typeof value !== 'string') return false
  PROVIDER_PATTERN.lastIndex = 0
  return PROVIDER_PATTERN.test(value)
}

/**
 * Walks any JSON-like value and masks "gsubz" in string values only.
 * Keys, numbers, booleans, and nulls are left completely untouched.
 */
export function sanitizeProviderPayload<T>(value: T, depth = 0): T {
  if (depth > 12) return value

  if (typeof value === 'string') {
    return maskProviderName(value) as unknown as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeProviderPayload(item, depth + 1)) as unknown as T
  }

  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      // Keys are preserved exactly — only values are masked.
      out[key] = sanitizeProviderPayload(val, depth + 1)
    }
    return out as unknown as T
  }

  // Numbers, booleans, null, undefined — untouched.
  return value
}

/**
 * Sanitizes a value that may be either a JSON string or an already-parsed
 * object. JSON strings are parsed, cleaned, and re-serialised so the mask
 * cannot break the payload structure; non-JSON strings are masked as plain text.
 */
export function sanitizeMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return sanitizeProviderPayload(value)

  const trimmed = value.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      return JSON.stringify(sanitizeProviderPayload(parsed))
    } catch {
      // Not valid JSON — fall through to plain text masking.
    }
  }

  return maskProviderName(value)
}
