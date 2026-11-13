import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { syncBachsFeeMetadata } from '@/lib/actions/bachs'
import { checkRateLimit, RATE_LIMIT_CONFIG, getRateLimitIdentifier } from '@/lib/utils/rate-limit'

/**
 * GET /api/admin/bachs-fee?reference=MOZO_...
 *
 * Admin fee reconciliation for Bachs deposits. Fetches the payment straight
 * from Bachs and persists what Bachs charged (fee amount/currency/USD, the
 * payment corridor the customer used, what was collected). Bachs' fee fields
 * are null until a charge settles, so this is safe to re-run any time — it
 * overwrites with whatever Bachs currently reports.
 *
 * Returns (values only, never provider credentials):
 *   amount, our processing_fee, bachs_fee (+currency/usd/paid_by),
 *   payment_method, net_amount, true_revenue (= processing_fee - bachs_fee
 *   when both are in naira).
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const ip = getRateLimitIdentifier(request)
  const { allowed } = await checkRateLimit(ip, RATE_LIMIT_CONFIG.ADMIN_ACTION)
  if (!allowed) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  const reference = request.nextUrl.searchParams.get('reference')?.trim() || ''
  if (!reference || !/^MOZO_[A-Za-z0-9_]+$/i.test(reference)) {
    return NextResponse.json({ success: false, error: 'A payment reference is required' }, { status: 400 })
  }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from('monnify_transactions')
    .select(
      'payment_reference, amount, processing_fee, net_amount, status, provider, bachs_fee, bachs_fee_currency, bachs_fee_usd, bachs_payment_method, settlement_amount, settled'
    )
    .eq('payment_reference', reference)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ success: false, error: 'Deposit not found' }, { status: 404 })
  }
  if (row.provider !== 'bachs') {
    return NextResponse.json(
      { success: false, error: 'Not a Bachs deposit — provider: ' + row.provider },
      { status: 400 }
    )
  }

  const sync = await syncBachsFeeMetadata(reference)

  // Re-read after the sync so the response reflects persisted state.
  const { data: fresh } = await admin
    .from('monnify_transactions')
    .select('bachs_fee, bachs_fee_currency, bachs_fee_usd, bachs_payment_method, settlement_amount, settled')
    .eq('payment_reference', reference)
    .maybeSingle()

  const ourFee = Number(row.processing_fee || 0)
  // Bachs reports the fee in the CHARGE currency (USD for a USD-card payment).
  // Convert for display using the FX implied by the charge itself:
  // settlement_amount / charge amount = Bachs' applied rate for this payment
  // (e.g. ₦100,000 settled for a $70.30 charge → ₦1,422.48/$).
  const chargeAmount =
    sync.success && sync.fee?.chargeAmount != null ? Number(sync.fee.chargeAmount) : null
  const chargeCurrency = sync.success ? sync.fee?.chargeCurrency ?? null : null
  const bachsFeeNaira =
    fresh?.bachs_fee != null && (fresh?.bachs_fee_currency == null || fresh.bachs_fee_currency === 'NGN')
      ? Number(fresh.bachs_fee)
      : null
  const impliedFxRate =
    fresh?.settlement_amount != null && chargeAmount && Number(fresh.settlement_amount) > 0 && chargeAmount > 0 && chargeCurrency && chargeCurrency !== 'NGN'
      ? Number(fresh.settlement_amount) / chargeAmount
      : null
  const bachsFeeNairaEstimate =
    bachsFeeNaira ??
    (fresh?.bachs_fee != null && impliedFxRate ? Number(fresh.bachs_fee) * impliedFxRate : null)

  return NextResponse.json({
    success: true,
    reference: row.payment_reference,
    amount: Number(row.amount),
    ourProcessingFee: ourFee,
    walletCredit: Number(row.net_amount || row.amount),
    status: row.status,
    bachsFee: fresh?.bachs_fee ?? null,
    bachsFeeCurrency: fresh?.bachs_fee_currency ?? null,
    bachsFeeUsd: fresh?.bachs_fee_usd ?? null,
    bachsFeePaidBy: sync.success ? sync.fee?.paidBy ?? null : null,
    paymentMethod: fresh?.bachs_payment_method ?? null,
    collected: fresh?.settlement_amount ?? null,
    settled: fresh?.settled ?? null,
    impliedFxRate,
    bachsFeeNairaEstimate: bachsFeeNairaEstimate != null ? Math.round(bachsFeeNairaEstimate * 100) / 100 : null,
    trueRevenueNaira:
      bachsFeeNairaEstimate != null ? Math.round((ourFee - bachsFeeNairaEstimate) * 100) / 100 : null,
    syncError: sync.success ? null : sync.error,
  })
}
