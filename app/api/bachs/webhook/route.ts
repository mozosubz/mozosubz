import { NextRequest, NextResponse } from 'next/server'
import { verifyBachsSignature, mapBachsStatus, parseBachsWebhookEvent } from '@/lib/api/bachs'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyAndCreditPayment } from '@/lib/actions/transactions'

export const runtime = 'nodejs'

/**
 * Bachs webhook — replacement for app/api/monnify/webhook/route.ts.
 *
 * Flow: verify X-Bachs-Signature against the RAW body, parse, find the local
 * row by bachs_checkout_id, then credit via verifyAndCreditPayment (idempotent)
 * and persist the provider metadata.
 *
 * Retry safety: every handled path (and the catch-all) returns HTTP 200, since
 * Bachs retries non-2xx deliveries and a duplicate delivery is harmless —
 * verifyAndCreditPayment refuses to double-credit. Unverified or unparseable
 * payloads are never processed.
 *
 * Event types in scope: checkout.completed, checkout.expired,
 * collection.succeeded, collection.failed, collection.underpaid — anything else
 * is tolerated (metadata recorded, no status move).
 */

// Provider statuses that are explicitly NOT a successful collection.
const NEGATIVE_MARKERS = [
  'FAILED',
  'DECLINED',
  'UNDERPAID',
  'OVERPAID',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'AUTO_REFUNDED',
  'EXPIRED',
  'INCOMPLETE',
  'ABANDONED',
  'OPEN',
  'PENDING',
  'CANCELLED',
  'CANCELED',
  'TIMED_OUT',
]

export async function POST(request: NextRequest) {
  try {
    // 1. RAW body first, before any parsing — the signature is computed over
    // the exact bytes Bachs sent. Current deliveries carry
    // X-Bachs-Signature-V2 ("t=...,v1=..."); the legacy header name is kept
    // as a fallback for manual replays.
    const raw = await request.text()
    const signature =
      request.headers.get('x-bachs-signature-v2') ?? request.headers.get('x-bachs-signature')

    // Never process an unverified payload. Respond 200 so Bachs doesn't retry
    // garbage — there is nothing to gain from receiving it again.
    if (!verifyBachsSignature(raw, signature ?? '')) {
      console.error('[BACHS WEBHOOK] Invalid signature')
      return NextResponse.json({ status: 'ignored' })
    }

    const parsed = parseBachsWebhookEvent(raw)
    if (!parsed) {
      console.error('[BACHS WEBHOOK] Unparseable payload')
      return NextResponse.json({ status: 'ignored' })
    }

    // Loosely typed view of the parsed event so the field reads below compile
    // regardless of how tightly (or loosely) lib/api/bachs types the payload.
    const event = parsed as unknown as { id?: unknown; type?: unknown; data?: unknown }
    const eventType = event.type == null ? '' : String(event.type)
    const data = (event.data ?? {}) as unknown as Record<string, unknown>

    // checkout_id is the correlation key; fall back to charge_id for events
    // that only carry the charge (the lookup below uses bachs_checkout_id).
    const checkoutId = String(data.checkout_id ?? data.charge_id ?? '').trim()
    if (!checkoutId) {
      console.warn('[BACHS WEBHOOK] Event has no checkout_id/charge_id', { type: eventType, id: event.id })
      return NextResponse.json({ status: 'ignored' })
    }

    const supabase = createAdminClient()
    const { data: row, error: lookupError } = await supabase
      .from('monnify_transactions')
      .select('payment_reference, status, provider_status, bachs_charge_id')
      .eq('bachs_checkout_id', checkoutId)
      .maybeSingle()

    if (lookupError) {
      console.error('[BACHS WEBHOOK] Lookup failed', { checkoutId, error: lookupError })
      return NextResponse.json({ status: 'ignored' })
    }

    // Not one of our deposits (or a checkout created before the migration).
    if (!row) {
      console.warn('[BACHS WEBHOOK] No local transaction for checkout id — not ours', { checkoutId, type: eventType })
      return NextResponse.json({ status: 'ignored' })
    }

    const providerStatus = data.status == null ? '' : String(data.status)
    const providerStatusUpper = providerStatus.trim().toUpperCase()
    const paymentStatus = data.payment_status == null ? '' : String(data.payment_status).trim().toLowerCase()
    const substatus = typeof data.substatus === 'string' ? data.substatus : undefined
    const chargeId = String(data.charge_id ?? data.payment_id ?? '').trim()

    // 2. Map the provider status to our internal vocabulary.
    const mapped = mapBachsStatus(providerStatus, substatus ?? '')
    let internal = mapped == null ? '' : String(mapped).trim().toUpperCase()

    // The event TYPE is authoritative for the two success events: when Bachs
    // says checkout.completed / collection.succeeded, the money is in unless
    // the provider status explicitly says otherwise (e.g. underpaid/refunded),
    // or — for checkout.completed — the checkout collected no payment at all
    // (payment_status "no_payment_required", i.e. a free/setup completion).
    const successEventType = eventType === 'collection.succeeded' || eventType === 'checkout.completed'
    const noPaymentRequired =
      (eventType === 'checkout.completed' && paymentStatus === 'no_payment_required') ||
      providerStatusUpper === 'NO_PAYMENT_REQUIRED'
    if (successEventType && !noPaymentRequired && !NEGATIVE_MARKERS.includes(providerStatusUpper)) {
      internal = 'SUCCESS'
    }

    // 3. Decide the internal status to persist. `status` only ever moves to
    // SUCCESS here through verifyAndCreditPayment (below), or to FAILED/EXPIRED
    // for failed/expired events. REVIEW / REFUNDED / underpaid stay in
    // provider_status with `status` untouched (finance handles them manually).
    let targetStatus: 'SUCCESS' | 'FAILED' | 'EXPIRED' | null = null
    if (internal === 'SUCCESS') {
      targetStatus = 'SUCCESS'
    } else if (internal === 'FAILED') {
      targetStatus = 'FAILED'
    } else if (internal === 'EXPIRED') {
      targetStatus = 'EXPIRED'
    } else if (!internal || internal === 'UNKNOWN') {
      // Mapper didn't recognise the status — fall back to the event type.
      if (eventType === 'collection.failed') targetStatus = 'FAILED'
      else if (eventType === 'checkout.expired') targetStatus = 'EXPIRED'
    }

    if (targetStatus === 'SUCCESS') {
      // Idempotent: refuses to double-credit an already-SUCCESS row.
      const creditResult = await verifyAndCreditPayment(row.payment_reference)
      if (creditResult.success) {
        console.log('[BACHS WEBHOOK] Credited payment', {
          paymentReference: row.payment_reference,
          alreadyProcessed: 'alreadyProcessed' in creditResult ? creditResult.alreadyProcessed : false,
        })
      } else {
        console.error('[BACHS WEBHOOK] Credit failed', {
          paymentReference: row.payment_reference,
          error: 'error' in creditResult ? creditResult.error : 'unknown error',
        })
      }
    }

    // 4. Always persist the provider metadata (never clobbers an existing
    // charge id when the event carries only a checkout id).
    const metaUpdate: Record<string, unknown> = {
      provider_status: providerStatus || eventType || 'unknown',
    }
    const existingChargeId = row.bachs_charge_id == null ? '' : String(row.bachs_charge_id).trim()
    metaUpdate.bachs_charge_id = chargeId || existingChargeId || null

    const { error: metaError } = await supabase
      .from('monnify_transactions')
      .update(metaUpdate)
      .eq('payment_reference', row.payment_reference)

    if (metaError) {
      console.error('[BACHS WEBHOOK] Failed to persist provider metadata', {
        paymentReference: row.payment_reference,
        error: metaError,
      })
    }

    // 5. Terminal FAILED/EXPIRED moves, guarded so a late duplicate event can
    // never downgrade a row that has already been credited. The live
    // valid_status CHECK currently allows PENDING/SUCCESS/EXPIRED/CANCELLED —
    // a rejected FAILED move is logged and the provider_status above still
    // records the truth.
    if (targetStatus === 'FAILED' || targetStatus === 'EXPIRED') {
      const { error: statusError } = await supabase
        .from('monnify_transactions')
        .update({ status: targetStatus })
        .eq('payment_reference', row.payment_reference)
        .neq('status', 'SUCCESS')

      if (statusError) {
        console.error('[BACHS WEBHOOK] Could not move status to', targetStatus, {
          paymentReference: row.payment_reference,
          error: statusError.message,
        })
      }
    }

    return NextResponse.json({ status: 'success' })
  } catch (error) {
    console.error('[BACHS WEBHOOK] Exception:', error)
    // 200 even on unexpected errors: Bachs retries non-2xx, and duplicates are
    // safe because verifyAndCreditPayment is idempotent.
    return NextResponse.json({ status: 'success' })
  }
}
