import { randomBytes } from "crypto"

/**
 * Normalize a WhatsApp phone number to E.164 form (no spaces, no dashes,
 * a leading "+", country code included). Supports Nigerian inputs like
 * "08012345678" / "8012345678" → "+2348012345678".
 *
 * Returns null when the input cannot be normalized.
 */
export function normalizeWhatsAppPhone(input: string | null | undefined): string | null {
  if (!input) return null
  // Strip everything except digits and a leading "+"
  let cleaned = String(input).trim().replace(/[^\d+]/g, "")
  if (!cleaned) return null

  // If it doesn't start with "+", try to apply the Nigerian default.
  if (!cleaned.startsWith("+")) {
    if (cleaned.startsWith("00")) {
      cleaned = "+" + cleaned.slice(2)
    } else if (cleaned.startsWith("234")) {
      cleaned = "+" + cleaned
    } else if (cleaned.startsWith("0") && cleaned.length === 11) {
      cleaned = "+234" + cleaned.slice(1)
    } else if (cleaned.length === 10) {
      cleaned = "+234" + cleaned
    } else {
      // Unknown format — let it through with a "+" prefix so the regex below
      // decides if it's valid.
      cleaned = "+" + cleaned
    }
  }

  // E.164: "+" followed by 8 to 15 digits.
  if (!/^\+\d{8,15}$/.test(cleaned)) return null

  return cleaned
}

/**
 * Generate a one-time connect token. The token is opaque, URL-safe, and
 * carries enough entropy to be infeasible to guess in the 10-minute window.
 *
 * Format: "MZ_" prefix + 32 base32-style characters.
 */
export function generateConnectToken(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/1/I — easier to read
  const bytes = randomBytes(32)
  let out = ""
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length]
  }
  return `MZ_${out}`
}

/**
 * Connect tokens are valid for 10 minutes after generation.
 */
export const CONNECT_TOKEN_TTL_MS = 10 * 60 * 1000

/**
 * Mask a phone number for display: "+2348012345678" → "+234801*****678".
 */
export function maskWhatsAppPhone(phone: string | null | undefined): string {
  if (!phone) return ""
  if (phone.length <= 6) return phone
  const head = phone.slice(0, phone.length - 6)
  const tail = phone.slice(-3)
  return `${head}***${tail}`
}
