import 'server-only'

import crypto from 'crypto'
import { BACHS_SECRET_KEY } from '@/lib/api/bachs-config'

// Origin of the Bachs overlay script (https://checkout.bachs.io/bachs.js) and
// of the hosted checkout pages the overlay embeds.
export const BACHS_CHECKOUT_ORIGIN = 'https://checkout.bachs.io'

// Our internal payment-row statuses. These are provider-agnostic on purpose so
// the rest of the app does not speak Bachs vocabulary.
export type BachsInternalStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'REVIEW' | 'REFUNDED'

/**
 * Map a Bachs payment status (plus optional substatus) onto our internal
 * status vocabulary. Unrecognised statuses fall back to PENDING: the
 * fail-safe rule is that nothing is ever credited on an unknown status.
 */
export function mapBachsStatus(status: string, substatus?: string | null): BachsInternalStatus {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : ''

  switch (normalized) {
    case 'open':
      // Substatus may be awaiting_payment / awaiting_approval / last_attempt_failed.
      return 'PENDING'
    case 'succeeded':
      return 'SUCCESS'
    case 'accepted':
      // Under-/overpayment accepted as the final outcome; platform policy: credit.
      return 'SUCCESS'
    case 'underpaid':
    case 'overpaid':
      // Do NOT auto-credit — flagged for finance review (substatus carries detail).
      return 'REVIEW'
    case 'failed':
      return 'FAILED'
    case 'incomplete':
      // Substatus is 'abandoned' or 'expired' — both close the local row as
      // EXPIRED, so the substatus does not change the outcome here.
      return substatus === 'expired' ? 'EXPIRED' : 'EXPIRED'
    case 'refunded':
    case 'partially_refunded':
    case 'auto_refunded':
      return 'REFUNDED'
    default:
      // Fail-safe: never credit on an unknown status.
      return 'PENDING'
  }
}

/**
 * Verify the `X-Bachs-Signature` webhook header against the RAW request body.
 *
 * The Bachs docs specify an HMAC header but not the digest algorithm, so we
 * accept EITHER HMAC-SHA512 (the default — Paystack-style) OR HMAC-SHA256 of
 * the raw body string keyed with BACHS_SECRET_KEY. The hex digest is compared
 * case-insensitively (both sides lowercased) and timing-safely.
 *
 * Never throws: a missing header, a missing key, malformed input or any other
 * error all return false (fail closed).
 */
export function verifyBachsSignature(rawBody: string, signatureHeader: string | null): boolean {
  try {
    if (!signatureHeader || signatureHeader.trim().length === 0) return false
    if (!BACHS_SECRET_KEY) return false

    // Hex digests are compared case-insensitively: normalise to lowercase.
    const received = signatureHeader.trim().toLowerCase()

    for (const algorithm of ['sha512', 'sha256'] as const) {
      const expected = crypto
        .createHmac(algorithm, BACHS_SECRET_KEY)
        .update(rawBody, 'utf8')
        .digest('hex')
        .toLowerCase()

      const expectedBuffer = Buffer.from(expected, 'utf8')
      const receivedBuffer = Buffer.from(received, 'utf8')

      // timingSafeEqual throws on length mismatch — check lengths first,
      // which itself leaks nothing useful to a forger.
      if (expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
        return true
      }
    }

    return false
  } catch (error) {
    console.error('[BACHS] Signature verification error:', error instanceof Error ? error.message : error)
    return false
  }
}

// Shape of a Bachs checkout session as returned by POST /v1/checkout-sessions.
export interface BachsCheckoutSession {
  checkoutId: string
  checkoutUrl: string
  status: string
  expiresAt: string | null
  createdAt: string | null
}

// Payment object carried inside a Bachs webhook event.
export interface BachsPaymentEventData {
  charge_id?: string
  checkout_id?: string
  status?: string
  amount?: string
  currency?: string
}

// Top-level Bachs webhook event envelope.
export interface BachsWebhookEvent {
  id?: string
  type?: string
  created_at?: string
  organization_id?: string
  data?: BachsPaymentEventData
}

/**
 * Safely parse a raw webhook body into a BachsWebhookEvent. Returns null on
 * malformed JSON, JSON null, arrays or primitives — callers must treat null
 * as "not a valid event" and never act on it.
 */
export function parseBachsWebhookEvent(rawBody: string): BachsWebhookEvent | null {
  try {
    const parsed: unknown = JSON.parse(rawBody)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as BachsWebhookEvent
  } catch {
    return null
  }
}
