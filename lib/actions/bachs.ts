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
  successUrl: string
  cancelUrl: string
}): Promise<{ success: boolean; error?: string; session?: BachsCheckoutSession }> {
  if (!isBachsConfigured()) {
    return { success: false, error: 'Bachs is not configured (missing BACHS_SECRET_KEY)' }
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, error: 'Invalid amount: must be a finite number greater than 0' }
  }

  const amountString = input.amount.toFixed(2)

  const requestBody = {
    pricing: {
      currency: input.currency ?? 'NGN',
      amount: amountString,
    },
    customer: {
      email: input.email,
      name: input.name,
    },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  }

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
 * Tries GET /v1/payments?checkout_id=<id> first and falls back to
 * GET /v1/payments/<id> if the query form 404s. Bachs payment objects carry a
 * `status` and an optional `substatus`; the raw payload is returned alongside
 * the mapped fields for logging.
 */
export async function getBachsPaymentByCheckoutId(checkoutId: string): Promise<{
  success: boolean
  error?: string
  status?: string
  substatus?: string | null
  chargeId?: string
  amount?: string
  currency?: string
  raw?: unknown
}> {
  if (!isBachsConfigured()) {
    return { success: false, error: 'Bachs is not configured (missing BACHS_SECRET_KEY)' }
  }

  if (!checkoutId || checkoutId.trim().length === 0) {
    return { success: false, error: 'checkoutId is required' }
  }

  const encoded = encodeURIComponent(checkoutId.trim())
  const urls = [
    `${BACHS_BASE_URL}/v1/payments?checkout_id=${encoded}`,
    `${BACHS_BASE_URL}/v1/payments/${encoded}`,
  ]

  try {
    let response: Response | null = null
    let data: unknown = null

    for (const url of urls) {
      response = await fetchWithBachsTimeout(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${BACHS_SECRET_KEY}`,
          Accept: 'application/json',
        },
      })
      data = await safeJson(response)
      // Only a 404 on the query form is worth retrying as the path form.
      if (response.status !== 404) break
    }

    if (!response) {
      return { success: false, error: 'Bachs payment lookup failed' }
    }

    if (!response.ok) {
      const message = providerErrorMessage(
        data,
        `Bachs payment lookup failed with status ${response.status}`
      )
      console.error('[BACHS] Payment lookup failed:', response.status, message, { checkoutId })
      return { success: false, error: message }
    }

    const record = pickResource(data, 'status')
    const status =
      record && typeof record.status === 'string' && record.status.trim().length > 0
        ? record.status
        : null

    if (!record || !status) {
      console.error('[BACHS] Payment payload missing a usable status', { checkoutId })
      return { success: false, error: 'Bachs payment payload is missing a status', raw: data }
    }

    return {
      success: true,
      status,
      substatus: typeof record.substatus === 'string' ? record.substatus : null,
      chargeId: typeof record.charge_id === 'string' ? record.charge_id : undefined,
      amount:
        typeof record.amount === 'string' || typeof record.amount === 'number'
          ? String(record.amount)
          : undefined,
      currency: typeof record.currency === 'string' ? record.currency : undefined,
      raw: data,
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
