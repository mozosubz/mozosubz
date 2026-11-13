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
  if (!reference || !/^MOZO_[A-Za-z0-9]+$/i.test(reference.replace(/_/g, ''))) {
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
  const bachsFeeNaira =
    fresh?.bachs_fee != null && (fresh?.bachs_fee_currency == null || fresh.bachs_fee_currency === 'NGN')
      ? Number(fresh.bachs_fee)
      : null

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
    trueRevenueNaira: bachsFeeNaira != null ? Math.round((ourFee - bachsFeeNaira) * 100) / 100 : null,
    syncError: sync.success ? null : sync.error,
  })
}
