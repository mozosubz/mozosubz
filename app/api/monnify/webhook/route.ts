import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAndCreditPayment, queryMonnifyTransaction } from '@/lib/actions/transactions'

const SECRET_KEY = process.env.MONNIFY_SECRET_KEY || ''

/**
 * Verify Monnify webhook signature using HMAC-SHA512
 * Per Monnify docs: SHA-512(client secret key + stringified JSON body)
 * Comparison is timing-safe so forged signatures can't be probed byte by byte.
 */
function verifyWebhookSignature(body: string, signature: string): boolean {
  try {
    // HMAC-SHA512 of: SECRET_KEY + body
    const hash = crypto
      .createHmac('sha512', SECRET_KEY)
      .update(body)
      .digest('hex')

    const expected = Buffer.from(hash, 'hex')
    const received = Buffer.from(String(signature || ''), 'hex')
    // timingSafeEqual throws on length mismatch — equal-length check first,
    // which itself leaks nothing useful to a forger.
    const isValid =
      expected.length === received.length && crypto.timingSafeEqual(expected, received)

    return isValid
  } catch (error) {
    console.error('[WEBHOOK] Signature verification error:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Read the raw body for signature verification
    const body = await request.text()
    const signature = request.headers.get('monnify-signature')


    // SECURITY 1: Validate signature before processing.
    // Monnify signs production webhooks in the `monnify-signature` header but
    // OMITS the header entirely for sandbox/test-mode notifications (per their
    // docs). So: present-but-invalid = forgery attempt, reject. Absent = could
    // be sandbox or a probe — never trust the payload, but don't lose the
    // deposit either: verify out-of-band with Monnify's own transaction-status
    // API and only credit if Monnify itself confirms PAID.
    if (signature && !verifyWebhookSignature(body, signature)) {
      console.error('[WEBHOOK] ❌ Invalid signature - rejecting webhook')
      // Return 200 anyway to prevent Monnify from retrying
      return NextResponse.json({ status: 'success' })
    }

    if (!signature) {
      console.warn('[WEBHOOK] No signature header (sandbox or probe) - falling back to out-of-band verification')
    } else {
    }

    // Parse the webhook payload
    const data = JSON.parse(body)
    const eventType = data.eventType
    const eventData = data.eventData


    // Only process SUCCESSFUL_TRANSACTION events
    if (eventType !== 'SUCCESSFUL_TRANSACTION') {
      return NextResponse.json({ status: 'success' })
    }

    const paymentReference = eventData?.paymentReference
    const paymentStatus = eventData?.paymentStatus
    const monnifyTransactionRef = eventData?.transactionReference

    if (!paymentReference) {
      console.error('[WEBHOOK] No payment reference in webhook')
      return NextResponse.json({ status: 'success' })
    }

    // Unsigned webhooks never get credited from their own payload — the
    // out-of-band query below is the only path to a credit.
    if (!signature) {
      const referenceparts = paymentReference.split('|')
      const cleanPaymentReference = referenceparts[0]
      const verification = await queryMonnifyTransaction(cleanPaymentReference, true)
      if (verification.success && verification.paymentStatus === 'PAID') {
      } else {
      }
      return NextResponse.json({ status: 'success' })
    }

    // Parse payment reference format: MOZO_xxx|user_id (Monnify appends user_id)
    // Extract clean reference and user_id for dual-key lookup
    const referenceparts = paymentReference.split('|')
    const cleanPaymentReference = referenceparts[0]
    const webhookUserId = referenceparts[1] || null


    // SECURITY 2: Dual-key lookup - verify both payment_reference AND user_id match
    // This ensures we find the correct transaction even if payment reference format changes
    // Use admin client to bypass RLS policies (webhook is a trusted backend process from Monnify)
    const supabase = createAdminClient()
    
    let query = supabase
      .from('monnify_transactions')
      .select('status, webhook_received_at, user_id, amount, net_amount')
      .eq('payment_reference', cleanPaymentReference)

    // If user_id was appended by Monnify, add it to the query for extra validation
    if (webhookUserId) {
      query = query.eq('user_id', webhookUserId)
    }

    const { data: existingTx, error: queryError } = await query.maybeSingle()

    if (queryError) {
      console.error('[WEBHOOK] Error querying transaction:', queryError)
      return NextResponse.json({ status: 'success' })
    }

    // CRITICAL: If already SUCCESS, this is a duplicate webhook - don't process again
    if (existingTx?.status === 'SUCCESS') {
      return NextResponse.json({ status: 'success' })
    }

    // SECURITY 3: Verify payment status is PAID before crediting
    if (paymentStatus !== 'PAID') {
      console.warn('[WEBHOOK] Payment status not PAID, not crediting:', {
        paymentReference: cleanPaymentReference,
        paymentStatus,
      })
      return NextResponse.json({ status: 'success' })
    }

    // SECURITY 4: Verify the paid amount covers what the transaction expects.
    // A signed-but-underpaid payment (partial settlement, tampered event) must
    // never credit the full stored amount.
    const expectedAmount = Number(existingTx?.amount)
    const amountPaid = Number(eventData?.amountPaid)
    if (Number.isFinite(expectedAmount) && expectedAmount > 0) {
      if (!Number.isFinite(amountPaid) || amountPaid + 0.001 < expectedAmount) {
        console.error('[WEBHOOK] Amount mismatch - not crediting:', {
          paymentReference: cleanPaymentReference,
          expectedAmount,
          amountPaid,
        })
        return NextResponse.json({ status: 'success' })
      }
    }

    // Credit the wallet using clean payment reference (idempotent - marks SUCCESS immediately)
    const creditResult = await verifyAndCreditPayment(cleanPaymentReference)

    if (!creditResult.success) {
      console.error('[WEBHOOK] Failed to credit wallet:', {
        paymentReference: cleanPaymentReference,
        error: creditResult.error,
      })
      // Still return 200 to prevent Monnify retries
      // Error will be visible in logs for manual review
      return NextResponse.json({ status: 'success' })
    }

    // Record webhook received timestamp (for debugging duplicate scenarios)
    await supabase
      .from('monnify_transactions')
      .update({ webhook_received_at: new Date().toISOString() })
      .eq('payment_reference', cleanPaymentReference)


    return NextResponse.json({ status: 'success' })
  } catch (error) {
    console.error('[WEBHOOK] Exception:', error)
    // Return success to prevent retry loop - error logged for manual review
    return NextResponse.json({ status: 'success' })
  }
}
