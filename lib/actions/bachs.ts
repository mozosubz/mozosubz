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
  /** Corridor the customer paid through: usd_card, ngn_bank_transfer, crypto, momo_*, ... */
  paymentMethod?: string | null
  /** What Bachs collected so far (amount_paid). */
  amountPaid?: string | null
  /** What the charge is set to settle as (settlement_amount) + its currency. */
  settlementAmount?: string | null
  settlementCurrency?: string | null
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
      // SECURITY: the list endpoint returns the ORG's payments (most recent
      // first) and does not reliably filter by checkout_id — observed live.
      // Picking the first item used to credit a deposit from SOMEONE ELSE'S
      // succeeded payment. Only a record whose own checkout_id matches the
      // one we asked about may be used.
      const listEnvelope = asRecord(listData)
      const items = Array.isArray(listEnvelope?.items)
        ? (listEnvelope!.items as unknown[]).map((it) => asRecord(it)).filter(Boolean)
        : []
      let record: Record<string, unknown> | null | undefined = items.find((it) => {
        if (!it) return false
        const source = asRecord(it.source)
        const itsCheckout =
          typeof it.checkout_id === 'string'
            ? it.checkout_id
            : source && typeof source.checkout_id === 'string'
              ? source.checkout_id
              : null
        return itsCheckout === encoded
      })

      if (record) {
        const paymentStatus = typeof record.status === 'string' ? record.status : null
        // Fee fields on the payment object (live API shape): `fee` is the
        // money Bachs deducted in the CHARGE currency (USD for a USD-card
        // payment), `fee_paid_by` is null until the charge settles, and
        // `payment_method` is either a corridor string or an object with a
        // `type` (usd_card / ngn_bank_transfer / crypto / momo_*). The list
        // view omits nothing critical, but fall back to the full retrieve
        // when fee fields are missing.
        const listPaymentId =
          typeof record.payment_id === 'string'
            ? record.payment_id
            : typeof record.id === 'string'
              ? record.id
              : null
        if (listPaymentId && record.fee == null && !record.payment_method) {
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
        const fees = asRecord(record.fees)
        const feeObject = fees && (fees.amount != null)
        const feeValue = feeObject ? fees.amount : record.fee
        const feeCurrencyValue = feeObject && typeof fees.currency === 'string' ? fees.currency : null
        const paymentMethodRaw = record.payment_method
        const paymentMethodValue =
          typeof paymentMethodRaw === 'string'
            ? paymentMethodRaw
            : asRecord(paymentMethodRaw) && typeof asRecord(paymentMethodRaw)!.type === 'string'
              ? String(asRecord(paymentMethodRaw)!.type)
              : null
        return {
          success: true,
          status: paymentStatus as string,
          substatus: typeof record.substatus === 'string' ? record.substatus : null,
          chargeId: listPaymentId ?? undefined,
          amount:
            typeof record.amount === 'string' || typeof record.amount === 'number'
              ? String(record.amount)
              : undefined,
          currency: typeof record.currency === 'string' ? record.currency : undefined,
          feeAmount:
            feeValue != null && (typeof feeValue === 'string' || typeof feeValue === 'number')
              ? String(feeValue)
              : null,
          feeCurrency: feeCurrencyValue,
          feeUsd:
            typeof record.fee_usd === 'string' || typeof record.fee_usd === 'number'
              ? String(record.fee_usd)
              : null,
          feePaidBy: typeof record.fee_paid_by === 'string' ? record.fee_paid_by : null,
          paymentMethod: paymentMethodValue,
          amountPaid:
            typeof record.amount_paid === 'string' || typeof record.amount_paid === 'number'
              ? String(record.amount_paid)
              : null,
          settlementAmount:
            typeof record.settlement_amount === 'string' || typeof record.settlement_amount === 'number'
              ? String(record.settlement_amount)
              : null,
          settlementCurrency:
            typeof record.settlement_currency === 'string' ? record.settlement_currency : null,
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

export interface BachsCorridorFee {
  /** Bachs' fee in the CHARGE currency (USD 4.61 for a USD-card payment). */
  feeOriginal: string | null
  feeCurrency: string | null
  /** Bachs' fee converted to naira at the charge's own implied FX rate. */
  feeNaira: number | null
  /** The FX rate implied by the charge itself (settlement / charge amount). */
  impliedFxRate: number | null
  /**
   * The part of Bachs' fee the platform's deposit fee does NOT already cover —
   * this is what gets deducted from the user's wallet credit. Bank transfers
   * are covered by the deposit rule (₦50 + 1.61% ≥ Bachs 1.5%), so their
   * excess is 0 and the user pays exactly what the deposit page promised.
   */
  excessNaira: number | null
}

/**
 * Convert Bachs' fee for a payment into naira and split it into the covered
 * and uncovered parts.
 *
 * Conversion uses the FX implied by the charge itself — settlement_amount /
 * charge amount — which is the exact rate Bachs applied to THAT payment
 * (e.g. a ₦100,000 checkout re-priced to $70.30 implies ₦1,422.48/$, so the
 * $4.61 card fee is ₦6,557.61 in platform terms). When the charge currency is
 * already NGN no conversion happens.
 *
 * ourFeeNaira is the deposit fee the user was already charged (deposit_rules).
 * Anything Bachs takes beyond that is the platform's exposure, and the owner's
 * policy is to pass that excess to the user's wallet credit.
 */
export function computeCorridorFee(
  lookup: {
    feeAmount?: string | null
    currency?: string | null
    amount?: string | null
    settlementAmount?: string | null
  },
  ourFeeNaira: number
): BachsCorridorFee {
  const feeOriginal = lookup.feeAmount ?? null
  const feeCurrency = lookup.currency ?? null
  const impliedFxRate =
    lookup.settlementAmount != null &&
    lookup.amount != null &&
    Number(lookup.settlementAmount) > 0 &&
    Number(lookup.amount) > 0 &&
    feeCurrency != null &&
    feeCurrency !== 'NGN'
      ? Number(lookup.settlementAmount) / Number(lookup.amount)
      : null

  let feeNaira: number | null = null
  if (feeOriginal != null) {
    const fee = Number(feeOriginal)
    if (Number.isFinite(fee)) {
      if (feeCurrency == null || feeCurrency === 'NGN') {
        feeNaira = fee
      } else if (impliedFxRate != null) {
        feeNaira = fee * impliedFxRate
      }
    }
  }

  const excessNaira =
    feeNaira != null ? Math.max(0, Math.round((feeNaira - ourFeeNaira) * 100) / 100) : null

  return {
    feeOriginal,
    feeCurrency,
    feeNaira: feeNaira != null ? Math.round(feeNaira * 100) / 100 : null,
    impliedFxRate,
    excessNaira,
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
  fee?: {
    amount: string | null
    currency: string | null
    usd: string | null
    paidBy: string | null
    method: string | null
    /** The charge's own amount + currency (USD 70.30 for a USD-card payment). */
    chargeAmount: string | null
    chargeCurrency: string | null
    /** What the charge is set to settle as (naira for us). */
    settlementAmount: string | null
    settlementCurrency: string | null
  }
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
    // The fee is denominated in the CHARGE currency (USD for a USD-card
    // payment), not the settlement currency — record which one it is so the
    // admin UI never subtracts dollars from naira.
    const feeCurrency = lookup.feeCurrency ?? (lookup.feeAmount != null ? lookup.currency ?? null : null)
    if (feeCurrency) update.bachs_fee_currency = feeCurrency
    if (lookup.feeUsd != null) update.bachs_fee_usd = lookup.feeUsd
    if (lookup.paymentMethod) update.bachs_payment_method = lookup.paymentMethod
    // settlement_amount is a NAIRA column — only Bachs' settlement figure
    // (settlement_amount, always NGN for us) belongs in it. amount_paid is
    // what the customer paid in the CHARGE currency (USD for a USD-card
    // payment) and must never be written there; it lives in the raw payload.
    const settledAs = lookup.settlementAmount != null ? Number(lookup.settlementAmount) : null
    if (settledAs != null && settledAs > 0) update.settlement_amount = lookup.settlementAmount
    // fee_paid_by flips from null once the charge settles.
    if (lookup.feePaidBy) update.settled = lookup.feePaidBy === 'merchant'

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
        chargeAmount: lookup.amount ?? null,
        chargeCurrency: lookup.currency ?? null,
        settlementAmount: lookup.settlementAmount ?? null,
        settlementCurrency: lookup.settlementCurrency ?? null,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[BACHS] Fee metadata sync failed:', message, { paymentReference })
    return { success: false, error: message }
  }
}
