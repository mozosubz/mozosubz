import { NextRequest, NextResponse } from 'next/server'
import { verifyAndCreditPayment } from '@/lib/actions/transactions'
import { getBachsPaymentByCheckoutId } from '@/lib/actions/bachs'
import { mapBachsStatus } from '@/lib/api/bachs'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, RATE_LIMIT_CONFIG, getRateLimitIdentifier } from '@/lib/utils/rate-limit'
import { logAPIRequest, getUserIPAddress } from '@/lib/utils/api-tracking'

/**
 * POST /api/payments/verify
 * 
 * Secure payment verification endpoint
 * User clicks "I Have Paid" → this endpoint queries Bachs directly
 * Only credits wallet if Bachs confirms the payment as succeeded
 * 
 * SECURITY:
 * - Verifies user owns the transaction
 * - Queries Bachs directly (no trust on client claims)
 * - Idempotent: marks transaction SUCCESS immediately to prevent double-crediting
 * - Rate limited to 8 requests/minute
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const ipAddress = getUserIPAddress(request)

  try {
    // SECURITY: Rate limit payment verification
    const rateLimitKey = getRateLimitIdentifier(request)
    const { allowed } = await checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIG.PAYMENT_VERIFY)

    if (!allowed) {
      await logAPIRequest({
        endpoint: "/api/payments/verify",
        method: "POST",
        statusCode: 429,
        duration: Date.now() - startTime,
        ipAddress,
        suspiciousFlag: true,
      })
      return NextResponse.json(
        { success: false, error: 'Too many verification requests. Please wait before trying again.' },
        { status: 429 }
      )
    }

    const { paymentReference } = await request.json()

    if (!paymentReference) {
      return NextResponse.json(
        { success: false, error: 'Payment reference required' },
        { status: 400 }
      )
    }


    // Step 1: Verify user owns this transaction
    const supabase = await createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user?.id) {
      await logAPIRequest({
        endpoint: "/api/payments/verify",
        method: "POST",
        statusCode: 401,
        duration: Date.now() - startTime,
        ipAddress,
      })
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // The admin client is required here: verification must read the row (and its
    // Bachs checkout id) without RLS narrowing the result — ownership is enforced
    // explicitly below against the authenticated session user.
    const admin = createAdminClient()
    const { data: transaction, error: txError } = await admin
      .from('monnify_transactions')
      .select('user_id, status, amount, bachs_checkout_id')
      .eq('payment_reference', paymentReference)
      .maybeSingle()

    if (txError || !transaction) {
      console.error('[VERIFY_API] Transaction not found:', paymentReference)
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Verify user owns this transaction
    if (transaction.user_id !== user.id) {
      console.error('[VERIFY_API] User mismatch - unauthorized access attempt:', {
        paymentReference,
        ownerId: transaction.user_id,
        attemptedUserId: user.id,
      })
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Step 2: Already credited — short-circuit without another provider call.
    if (transaction.status === 'SUCCESS') {
      return NextResponse.json({
        success: true,
        status: 'SUCCESS',
        credited: true,
        message: 'Payment already verified and wallet credited',
        paymentReference,
        amount: transaction.amount,
        alreadyProcessed: true,
      })
    }

    // Verification is Bachs-only by design — there is intentionally no Monnify fallback.
    if (!transaction.bachs_checkout_id) {
      console.error('[VERIFY_API] No Bachs checkout id on transaction:', paymentReference)
      return NextResponse.json(
        {
          success: false,
          status: transaction.status,
          credited: false,
          error: 'No Bachs checkout session found for this payment. Please contact support.',
          paymentReference,
        },
        { status: 400 }
      )
    }

    // Step 3: Query Bachs (the provider) for the authoritative payment status.
    const bachsPayment = await getBachsPaymentByCheckoutId(transaction.bachs_checkout_id)

    if (!bachsPayment.success) {
      console.error('[VERIFY_API] Bachs lookup failed:', bachsPayment.error, { paymentReference })
      return NextResponse.json(
        {
          success: false,
          credited: false,
          error: 'Failed to verify with Bachs. Please try again or contact support.',
          paymentReference,
        },
        { status: 400 }
      )
    }

    // Step 4: Map the provider status onto our internal vocabulary.
    // The wallet is only ever credited on SUCCESS — never on any other status.
    const internalStatus = mapBachsStatus(bachsPayment.status ?? '', bachsPayment.substatus ?? null)

    if (internalStatus !== 'SUCCESS') {
      return NextResponse.json(
        {
          success: false,
          status: internalStatus,
          credited: false,
          error: `Payment status is ${internalStatus}. Please check your payment and try again.`,
          paymentReference,
        },
        { status: 400 }
      )
    }

    // Step 5: Bachs confirms SUCCESS — credit the wallet with the idempotency guard.
    const creditResult = await verifyAndCreditPayment(paymentReference)

    if (!creditResult.success) {
      console.error('[VERIFY_API] Failed to credit wallet:', creditResult.error)
      return NextResponse.json(
        {
          success: false,
          status: 'SUCCESS',
          credited: false,
          error: 'Payment verified but failed to credit wallet. Contacting support...',
          paymentReference,
        },
        { status: 500 }
      )
    }


    return NextResponse.json({
      success: true,
      status: 'SUCCESS',
      credited: !!creditResult.success,
      message: 'Payment verified and wallet credited successfully',
      paymentReference,
      amount: transaction.amount,
      alreadyProcessed: 'alreadyProcessed' in creditResult ? creditResult.alreadyProcessed : false,
    })
  } catch (error) {
    console.error('[VERIFY_API] Exception:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
