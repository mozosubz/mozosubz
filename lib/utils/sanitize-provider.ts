/**
 * Strips the upstream provider's brand name out of anything that can reach a
 * client, an API consumer, or the admin UI.
 *
 * The provider echoes its own name back in several places we do not control:
 * free-text `api_response` copy, the opaque `content` / `gateway` blobs, and
 * network error strings such as "getaddrinfo ENOTFOUND gsubz.com". Masking at
 * each individual call site is unreliable, so this runs at the boundaries
 * instead — on write (so nothing new is persisted with the name) and on read
 * (so rows already stored are masked too).
 */

export const PROVIDER_MASK = '*****'

/**
 * Matches the brand with any separator or spacing ("Gsubz", "GSUBZ", "g-subz",
 * "g_subz", "g subz") so a reformatted payload cannot slip past.
 */
const PROVIDER_PATTERN = /g[\s._-]*subz/gi

/** Masks every occurrence of the provider name in a string. */
export function maskProviderName(value: string): string {
  return value.replace(PROVIDER_PATTERN, PROVIDER_MASK)
}

/** True when the value contains the provider name in any form. */
export function containsProviderName(value: unknown): boolean {
  if (typeof value !== 'string') return false
  // `test` on a /g/ regex advances lastIndex between calls, so reset first.
  PROVIDER_PATTERN.lastIndex = 0
  return PROVIDER_PATTERN.test(value)
}

/**
 * Recursively masks the provider name across any JSON-like value.
 *
 * Object keys are sanitized as well as values, since the provider occasionally
 * namespaces fields (e.g. `gsubz_ref`). Strings that are themselves JSON get
 * parsed and re-serialised so nested payloads are cleaned rather than being
 * treated as one opaque blob.
 *
 * @param depth Guards against runaway recursion on deeply nested or cyclic
 *   payloads; beyond the limit the value is dropped rather than risking a
 *   stack overflow inside a transaction write.
 */
export function sanitizeProviderPayload<T>(value: T, depth = 0): T {
  if (depth > 12) return null as unknown as T

  if (typeof value === 'string') {
    return maskProviderName(value) as unknown as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeProviderPayload(item, depth + 1)) as unknown as T
  }

  if (value && typeof value === 'object') {
    // Non-plain objects (Date, Error, class instances) have no meaningful
    // key/value shape to walk, so stringify them and mask the result.
    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) {
      return maskProviderName(String(value)) as unknown as T
    }

    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[maskProviderName(key)] = sanitizeProviderPayload(val, depth + 1)
    }
    return out as unknown as T
  }

  return value
}

/**
 * Sanitizes a value that may be either a JSON string or an already-parsed
 * object. Used for `api_response`, which is stored as text in the database but
 * handed to the UI in both shapes depending on the caller.
 *
 * A JSON string is parsed, cleaned and re-serialised so the mask cannot break
 * the payload's structure; if it is not valid JSON it is masked as plain text.
 */
export function sanitizeMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return sanitizeProviderPayload(value)

  const trimmed = value.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      // Re-serialise so the caller still receives a string, matching what it
      // passed in and keeping the value valid JSON for downstream parsers.
      return JSON.stringify(sanitizeProviderPayload(parsed))
    } catch {
      // Not valid JSON after all — fall through to plain text masking.
    }
  }

  return maskProviderName(value)
}
