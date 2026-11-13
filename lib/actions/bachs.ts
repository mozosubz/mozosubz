'use server'

import { BACHS_BASE_URL, BACHS_SECRET_KEY, isBachsConfigured } from '@/lib/api/bachs-config'
import type { BachsCheckoutSession } from '@/lib/api/bachs'

// ---------------------------------------------------------------------------
// Shared plumbing for the Bachs API.
//
// Every call is bounded by an 8s AbortController timeout so a slow/hung Bachs
// endpoint can never pin a serverless invocation, and every JSON read is
// guarded so a non-JSON error page becomes a clean failure instead of a throw.
// The secret key only ever travels in the Authorization header and is never
// logged.
// ---------------------------------------------------------------------------
const BACHS_REQUEST_TIMEOUT_MS = 8000

async function fetchWithBachsTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), BACHS_REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
  } finally {
    clearTimeout(timer)
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function asRecord(payload: unknown): Record<string, unknown> | null {
  return payload !== null && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : null
}

// Bachs normally returns the resource flat; tolerate a `{ data: {...} }`
// envelope (and a `{ data: [...] }` list for filtered GETs) just in case.
function pickResource(payload: unknown, key: string): Record<string, unknown> | null {
  const root = asRecord(payload)
  if (!root) return null
  if (key in root) return root
  const nested = asRecord(root.data)
  if (nested) return nested
  if (Array.isArray(root.data)) {
    const first = asRecord(root.data[0])
    if (first) return first
  }
  return root
}

// The payments list endpoint answers `{ "items": [ {...} ] }` (confirmed
// against the live sandbox API). Extract the first record from `items`/`data`
// arrays, or accept a flat payment object.
function pickPaymentRecord(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload)
  if (!root) return null
  for (const listKey of ['items', 'data'] as const) {
    const list = root[listKey]
    if (Array.isArray(list)) {
      const first = asRecord(list[0])
      if (first) return first
    }
  }
  return root
}

function providerErrorMessage(payload: unknown, fallback: string): string {
  const record = asRecord(payload)
  if (record) {
    for (const key of ['message', 'error'] as const) {
      const value = record[key]
      if (typeof value === 'string' && value.trim().length > 0) return value
    }
  }
  return fallback
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

/**
 * Create a Bachs checkout session for a raw amount and return the hosted
 * checkout URL the client-side overlay opens.
 *
 * Raw-amount sessions need NO catalog product (confirmed in the Bachs docs):
 * `pricing` carries `{currency, amount}` where amount is a decimal STRING with
 * exactly 2 decimals — Bachs never uses minor units.
 *
 * `reference` and `userId` are not sent to Bachs; they travel on our local
 * payment row so the webhook (which only carries checkout/payment ids) can be
 * matched back to it.
 */
export async function createBachsCheckoutSession(input: {
  amount: number
  currency?: 'NGN'
  reference: string
  email: string
  name: string
  userId: string
  /** Omitted for overlay sessions — see the deposit route. */
  successUrl?: string
  cancelUrl?: string
}): Promise<{ success: boolean; error?: string; session?: BachsCheckoutSession }> {
  if (!isBachsConfigured()) {
    return { success: false, error: 'Bachs is not configured (missing BACHS_SECRET_KEY)' }
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, error: 'Invalid amount: must be a finite number greater than 0' }
  }

  const amountString = input.amount.toFixed(2)

  const requestBody: Record<string, unknown> = {
    pricing: {
      currency: input.currency ?? 'NGN',
      amount: amountString,
    },
    customer: {
      email: input.email,
      name: input.name,
    },
  }
  // Redirect URLs are optional (Bachs docs: may be left out). Overlay
  // sessions omit them so the checkout iframe shows Bachs' own success
  // screen instead of navigating inside the modal.
  if (input.successUrl) requestBody.success_url = input.successUrl
  if (input.cancelUrl) requestBody.cancel_url = input.cancelUrl

  try {
    const response = await fetchWithBachsTimeout(`${BACHS_BASE_URL}/v1/checkout-sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BACHS_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const data = await safeJson(response)

    if (!response.ok) {
      const message = providerErrorMessage(
        data,
        `Bachs checkout session request failed with status ${response.status}`
      )
      console.error('[BACHS] Checkout session request failed:', response.status, message, {
        reference: input.reference,
      })
      return { success: false, error: message }
    }

    const record = pickResource(data, 'checkout_id')
    if (!record) {
      console.error('[BACHS] Checkout session response was not a JSON object', {
        reference: input.reference,
      })
      return { success: false, error: 'Bachs returned an unreadable checkout session response' }
    }

    const checkoutId = typeof record.checkout_id === 'string' ? record.checkout_id : null
    const checkoutUrl = typeof record.checkout_url === 'string' ? record.checkout_url : null

    if (!checkoutId || !checkoutUrl) {
      console.error('[BACHS] Checkout session response missing checkout_id or checkout_url', {
        reference: input.reference,
      })
      return { success: false, error: 'Bachs returned an incomplete checkout session' }
    }

    const session: BachsCheckoutSession = {
      checkoutId,
      checkoutUrl,
      status: typeof record.status === 'string' ? record.status : 'open',
      expiresAt: typeof record.expires_at === 'string' ? record.expires_at : null,
      createdAt: typeof record.created_at === 'string' ? record.created_at : null,
    }

    return { success: true, session }
  } catch (error) {
    if (isAbortError(error)) {
      console.error('[BACHS] Checkout session request timed out after 8s', { reference: input.reference })
      return { success: false, error: 'Bachs checkout session request timed out' }
    }
    const message = errorMessage(error)
    console.error('[BACHS] Checkout session request error:', message, { reference: input.reference })
    return { success: false, error: `Failed to create Bachs checkout session: ${message}` }
  }
}

/**
 * Look up the authoritative status of a Bachs payment by checkout id.
 *
 * Strategy (confirmed against the live sandbox API):
 *  1. GET /v1/payments?checkout_id=<id> → `{ items: [payment, ...] }`. When a
 *     payment exists this is the payment-level truth (lowercase status:
 *     succeeded / failed / underpaid / ...).
 *  2. If the list is empty (nothing paid yet) fall back to
 *     GET /v1/checkout-sessions/<id>, whose `payment_status` (succeeded/...)
 *     or `status` (open/completed/expired) describes the checkout itself.
 * An empty payments list is NOT an error: it means "no payment yet", which
 * maps to PENDING and never credits.
 */
export async function getBachsPaymentByCheckoutId(checkoutId: string): Promise<{
  success: boolean
  error?: string
  status?: string
  substatus?: string | null
  chargeId?: string
  amount?: string
  currency?: string
  /** Fee Bachs actually deducted (fees.amount) + its currency. Null until the charge settles. */
  feeAmount?: string | null
  feeCurrency?: string | null
  /** Same fee converted to USD by Bachs (fee_usd). */
  feeUsd?: string | null
  /** 'merchant' (fee came out of the charge) or 'platform' — null until settlement. */
  feePaidBy?: string | null
  /** Corridor the customer paid through: CARD, NGN_BANK_TRANSFER, USD_CARD, CRYPTO, MOMO_*, ... */
  paymentMethod?: string | null
  /** What Bachs actually collected so far (amount_paid). */
  amountPaid?: string | null
  raw?: unknown
}> {
  if (!isBachsConfigured()) {
    return { success: false, error: 'Bachs is not configured (missing BACHS_SECRET_KEY)' }
  }

  if (!checkoutId || checkoutId.trim().length === 0) {
    return { success: false, error: 'checkoutId is required' }
  }

  const encoded = encodeURIComponent(checkoutId.trim())

  const authHeaders = {
    Authorization: `Bearer ${BACHS_SECRET_KEY}`,
    Accept: 'application/json',
  }

  try {
    // 1. Payment-level lookup via the filtered list.
    const listResponse = await fetchWithBachsTimeout(
      `${BACHS_BASE_URL}/v1/payments?checkout_id=${encoded}`,
      { method: 'GET', headers: authHeaders }
    )
    const listData = await safeJson(listResponse)

    if (listResponse.ok) {
      let record = pickPaymentRecord(listData)
      const status =
        record && typeof record.status === 'string' && record.status.trim().length > 0
          ? record.status
          : null
      // A record is a payment only when it carries a status and is not the
      // empty-list envelope itself.
      const isPayment = record !== null && status !== null && !Array.isArray((record as Record<string, unknown>).items)

      if (isPayment && record) {
        // The list representation omits fee details — Bachs documents them on
        // the payment retrieve endpoint ("every payment reports the fee that
        // was actually applied to it"). Re-read the full payment when we have
        // its id and the list view didn't already carry fee fields.
        const listPaymentId =
          typeof record.payment_id === 'string'
            ? record.payment_id
            : typeof record.id === 'string'
              ? record.id
              : null
        const hasFeeInfo =
          (record as Record<string, unknown>).fees != null ||
          (record as Record<string, unknown>).fee_usd != null ||
          (record as Record<string, unknown>).payment_method != null
        if (listPaymentId && !hasFeeInfo) {
          try {
            const retrieveResponse = await fetchWithBachsTimeout(
              `${BACHS_BASE_URL}/v1/payments/${encodeURIComponent(listPaymentId)}`,
              { method: 'GET', headers: authHeaders }
            )
            const retrieveData = await safeJson(retrieveResponse)
            const full = asRecord(retrieveData)
            if (retrieveResponse.ok && full) {
              record = full
            }
          } catch {
            // Fee detail is best-effort; the list record still answers status.
          }
        }
        // Fee fields on the payment object: fees { amount, currency } (the
        // money Bachs deducted), fee_usd (same fee converted), fee_paid_by
        // ('merchant' | 'platform', null until the charge settles) and
        // payment_method (the corridor the customer paid through — for cards
        // Bachs reports 'CARD', not the USD_CARD/NGN_CARD corridor name).
        const fees = (record as Record<string, unknown>).fees as
          | Record<string, unknown>
          | null
        | undefined
        return {
          success: true,
          status: status as string,
          substatus: typeof record.substatus === 'string' ? record.substatus : null,
          // Payment objects expose their own id (ch_...); charge_id may be
          // absent from the list representation.
          chargeId:
            typeof record.charge_id === 'string'
              ? record.charge_id
              : typeof record.payment_id === 'string'
                ? record.payment_id
                : typeof record.id === 'string'
                  ? record.id
                  : undefined,
          amount:
            typeof record.amount === 'string' || typeof record.amount === 'number'
              ? String(record.amount)
              : undefined,
          currency: typeof record.currency === 'string' ? record.currency : undefined,
          feeAmount:
            fees && (typeof fees.amount === 'string' || typeof fees.amount === 'number')
              ? String(fees.amount)
              : null,
          feeCurrency: fees && typeof fees.currency === 'string' ? fees.currency : null,
          feeUsd:
            typeof record.fee_usd === 'string' || typeof record.fee_usd === 'number'
              ? String(record.fee_usd)
              : null,
          feePaidBy: typeof record.fee_paid_by === 'string' ? record.fee_paid_by : null,
          paymentMethod: typeof record.payment_method === 'string' ? record.payment_method : null,
          amountPaid:
            typeof record.amount_paid === 'string' || typeof record.amount_paid === 'number'
              ? String(record.amount_paid)
              : null,
          raw: listData,
        }
      }
    } else if (listResponse.status !== 404) {
      const message = providerErrorMessage(
        listData,
        `Bachs payment lookup failed with status ${listResponse.status}`
      )
      console.error('[BACHS] Payment list lookup failed:', listResponse.status, message, { checkoutId })
      return { success: false, error: message }
    }

    // 2. No payment yet (or list endpoint unavailable) — read the checkout
    // session itself. Its payment_status is authoritative for whether money
    // was actually collected.
    const sessionResponse = await fetchWithBachsTimeout(
      `${BACHS_BASE_URL}/v1/checkout-sessions/${encoded}`,
      { method: 'GET', headers: authHeaders }
    )
    const sessionData = await safeJson(sessionResponse)

    if (!sessionResponse.ok) {
      const message = providerErrorMessage(
        sessionData,
        `Bachs checkout session lookup failed with status ${sessionResponse.status}`
      )
      console.error('[BACHS] Checkout session lookup failed:', sessionResponse.status, message, { checkoutId })
      return { success: false, error: message }
    }

    const session = asRecord(sessionData)
    if (!session) {
      console.error('[BACHS] Checkout session payload was not a JSON object', { checkoutId })
      return { success: false, error: 'Bachs returned an unreadable checkout session' }
    }

    const paymentStatus =
      typeof session.payment_status === 'string' && session.payment_status.trim().length > 0
        ? session.payment_status
        : null
    const sessionStatus =
      typeof session.status === 'string' && session.status.trim().length > 0 ? session.status : null
    const status = paymentStatus || sessionStatus

    if (!status) {
      console.error('[BACHS] Checkout session payload missing status and payment_status', { checkoutId })
      return { success: false, error: 'Bachs checkout session payload is missing a status', raw: sessionData }
    }

    const charge = asRecord(session.charge)
    const chargeId =
      charge && typeof charge.payment_id === 'string'
        ? charge.payment_id
        : charge && typeof charge.charge_id === 'string'
          ? charge.charge_id
          : charge && typeof charge.id === 'string'
            ? charge.id
            : undefined

    return {
      success: true,
      status,
      substatus: null,
      chargeId,
      amount: typeof session.amount === 'string' ? session.amount : undefined,
      currency: typeof session.currency === 'string' ? session.currency : undefined,
      raw: sessionData,
    }
  } catch (error) {
    if (isAbortError(error)) {
      console.error('[BACHS] Payment lookup timed out after 8s', { checkoutId })
      return { success: false, error: 'Bachs payment lookup timed out' }
    }
    const message = errorMessage(error)
    console.error('[BACHS] Payment lookup request error:', message, { checkoutId })
    return { success: false, error: `Bachs payment lookup failed: ${message}` }
  }
}

/**
 * Fetch the Bachs payment for a deposit row and persist what Bachs charged
 * for it — fee (amount + currency + USD equivalent), the payment corridor the
 * customer used, and what Bachs collected.
 *
 * Why: our deposit fee (deposit_rules) is a flat naira percentage that knows
 * nothing about the corridor. Bachs charges 2% for local NGN cards, 5% + $0.40
 * for US cards, base + 1.5% for international cards, 1.5% for crypto — and a
 * customer can pay an NGN-priced checkout with any of them. Recording the
 * provider fee per charge makes admin revenue (processing_fee − bachs_fee)
 * real instead of assumed.
 *
 * Fee fields on the payment object are null until the charge settles, so this
 * is safe to call repeatedly (webhook credit, verify poll, admin reconcile):
 * each call overwrites the columns with whatever Bachs currently reports.
 */
export async function syncBachsFeeMetadata(paymentReference: string): Promise<{
  success: boolean
  error?: string
  fee?: { amount: string | null; currency: string | null; usd: string | null; paidBy: string | null; method: string | null }
}> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()

    const { data: row, error } = await admin
      .from('monnify_transactions')
      .select('payment_reference, bachs_checkout_id, provider')
      .eq('payment_reference', paymentReference)
      .maybeSingle()

    if (error || !row || row.provider !== 'bachs' || !row.bachs_checkout_id) {
      return { success: false, error: error?.message || 'Not a Bachs deposit' }
    }

    const lookup = await getBachsPaymentByCheckoutId(String(row.bachs_checkout_id))
    if (!lookup.success) {
      return { success: false, error: lookup.error }
    }

    // Keep the provider's own view of the payment on the row (same slot the
    // Monnify flow uses) so fee oddities can be inspected later without
    // another API call.
    const update: Record<string, unknown> = {
      monnify_response: (lookup.raw ?? null) as object | null,
    }
    if (lookup.feeAmount != null) update.bachs_fee = lookup.feeAmount
    if (lookup.feeCurrency != null) update.bachs_fee_currency = lookup.feeCurrency
    if (lookup.feeUsd != null) update.bachs_fee_usd = lookup.feeUsd
    if (lookup.paymentMethod != null) update.bachs_payment_method = lookup.paymentMethod
    if (lookup.amountPaid != null) update.settlement_amount = lookup.amountPaid
    if (lookup.feePaidBy === 'merchant') update.settled = true

    if (Object.keys(update).length > 0) {
      const { error: updateError } = await admin
        .from('monnify_transactions')
        .update(update)
        .eq('payment_reference', paymentReference)
      if (updateError) {
        console.error('[BACHS] Failed to persist fee metadata:', updateError.message, { paymentReference })
        return { success: false, error: updateError.message }
      }
    }

    return {
      success: true,
      fee: {
        amount: lookup.feeAmount ?? null,
        currency: lookup.feeCurrency ?? null,
        usd: lookup.feeUsd ?? null,
        paidBy: lookup.feePaidBy ?? null,
        method: lookup.paymentMethod ?? null,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[BACHS] Fee metadata sync failed:', message, { paymentReference })
    return { success: false, error: message }
  }
}
