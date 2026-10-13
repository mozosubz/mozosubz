import 'server-only'

import crypto from 'crypto'
import { BACHS_SECRET_KEY, BACHS_WEBHOOK_SECRET } from '@/lib/api/bachs-config'

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
 *
 * Handles both vocabularies Bachs uses:
 *  - payment/charge objects: lowercase (succeeded, failed, underpaid, ...)
 *  - webhook event data.status: UPPERCASE charge state (SUCCEEDED, ACCEPTED, OVERPAID, FAILED)
 *  - checkout session objects: open / completed / expired (+ payment_status)
 * `completed` is deliberately NOT mapped to SUCCESS here — the webhook route
 * promotes checkout.completed only when payment_status confirms a real payment.
 */
export function mapBachsStatus(status: string, substatus?: string | null): BachsInternalStatus {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : ''

  switch (normalized) {
    case 'open':
      // Substatus may be awaiting_payment / awaiting_approval / last_attempt_failed.
      // An abandoned checkout is closed as EXPIRED; otherwise it is still open.
      return substatus === 'abandoned' ? 'EXPIRED' : 'PENDING'
    case 'succeeded':
    case 'paid':
      // 'paid' is the checkout.completed payment_status value for a real payment.
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
    case 'expired':
    case 'incomplete':
      // Both close the local row as EXPIRED.
      return 'EXPIRED'
    case 'refunded':
    case 'partially_refunded':
    case 'auto_refunded':
      return 'REFUNDED'
    case 'no_payment_required':
      // Free/setup completion — nothing was collected, nothing to credit.
      return 'PENDING'
    default:
      // Fail-safe: never credit on an unknown status.
      return 'PENDING'
  }
}

// Timing-safe comparison of two hex digests; both sides are lowercased first
// and length-checked (timingSafeEqual throws on length mismatch, and the
// length of a digest leaks nothing useful to a forger).
function timingSafeHexEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected.toLowerCase(), 'utf8')
  const b = Buffer.from(received.trim().toLowerCase(), 'utf8')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Webhook timestamp tolerance, matching the Bachs docs (5 minutes).
const BACHS_WEBHOOK_TOLERANCE_SECONDS = 300

/**
 * Verify a Bachs webhook signature header against the RAW request body.
 *
 * Current scheme (X-Bachs-Signature-V2, per docs.bachs.io):
 *   header:  "t=1760000000,v1=abc...,v1=def..."
 *   signed:  `${t}.${rawBody}` with HMAC-SHA256, hex digest, keyed by the
 *            whsec_ signing secret string.
 *   Accept when ANY v1 value matches (one per valid secret during rotation)
 *   and |now - t| <= 300s.
 *
 * Legacy fallback: a bare hex digest (no t=/v1= structure) is treated as
 * HMAC-SHA256/SHA512 over the raw body with the same secret — used only by
 * manual replays/tests built before the v2 scheme was confirmed.
 *
 * Never throws: a missing header, missing key, malformed input or any other
 * error all return false (fail closed).
 */
export function verifyBachsSignature(rawBody: string, signatureHeader: string | null): boolean {
  try {
    if (!signatureHeader || signatureHeader.trim().length === 0) return false

    // The webhook signing secret (whsec_...) is what Bachs signs with — the
    // API secret key is NOT used for webhook signatures. Fall back to it only
    // if the webhook secret is not configured, so a missing env var fails
    // closed rather than breaking every delivery.
    const signingSecret = BACHS_WEBHOOK_SECRET || BACHS_SECRET_KEY
    if (!signingSecret) return false

    const header = signatureHeader.trim()

    // --- v2 scheme: t=<unix>,v1=<hex>[,v1=<hex>...] -----------------------
    if (header.includes('t=') || header.includes('v1=')) {
      const pairs: Array<[string, string]> = []
      for (const part of header.split(',')) {
        const eq = part.indexOf('=')
        if (eq === -1) continue
        pairs.push([part.slice(0, eq).trim(), part.slice(eq + 1).trim()])
      }

      const timestampRaw = pairs.find(([key]) => key === 't')?.[1]
      const timestamp = timestampRaw ? Number(timestampRaw) : NaN
      if (!Number.isFinite(timestamp)) return false
      if (Math.abs(Date.now() / 1000 - timestamp) > BACHS_WEBHOOK_TOLERANCE_SECONDS) {
        console.error('[BACHS] Webhook timestamp outside tolerance window')
        return false
      }

      const expected = crypto
        .createHmac('sha256', signingSecret)
        .update(`${timestamp}.${rawBody}`, 'utf8')
        .digest('hex')

      const v1Signatures = pairs.filter(([key]) => key === 'v1').map(([, value]) => value)
      if (v1Signatures.some((signature) => timingSafeHexEqual(expected, signature))) {
        return true
      }

      console.error('[BACHS] Signature mismatch — confirm BACHS_WEBHOOK_SECRET matches the portal signing secret')
      return false
    }

    // --- legacy bare-digest fallback --------------------------------------
    const received = header.toLowerCase()
    const expectedSha256 = crypto.createHmac('sha256', signingSecret).update(rawBody, 'utf8').digest('hex')
    if (timingSafeHexEqual(expectedSha256, received)) return true
    const expectedSha512 = crypto.createHmac('sha512', signingSecret).update(rawBody, 'utf8').digest('hex')
    if (timingSafeHexEqual(expectedSha512, received)) return true

    console.error('[BACHS] Signature mismatch — confirm BACHS_WEBHOOK_SECRET matches the portal signing secret')
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
