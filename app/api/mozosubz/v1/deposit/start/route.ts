import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  initTransaction,
  initializePayment,
  getMonnifyAccessToken,
} from '@/lib/actions/monnify'
import { updateTransactionWithMonnifyData } from '@/lib/actions/transactions'
import { generatePaymentReference } from '@/lib/utils/payment-reference'
import { getDepositRules } from '@/lib/actions/deposit-rules'
import { calculateDepositFee } from '@/lib/utils/deposit-fee'

export async function POST(request: NextRequest) {
  console.log('[V1-DEPOSIT] POST')

  try {
    const auth = await v1AuthOrRespond(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => ({} as any))
    const { amount, description } = body || {}

    const numAmount = parseFloat(String(amount))
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid amount is required' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    // Pre-warm the Monnify token in parallel with everything else. The
    // first call inside initTransaction will pick up the cached value
    // once this resolves, removing one round-trip from the critical path.
    void getMonnifyAccessToken()

    // Profile lookup and deposit-rules lookup are independent — fetch
    // them concurrently instead of sequentially.
    const [profileRes, depositRules] = await Promise.all([
      admin
        .from('profiles')
        .select('email, full_name')
        .eq('id', auth.userId)
        .maybeSingle(),
      getDepositRules(),
    ])

    const profile = profileRes.data
    if (profileRes.error || !profile?.email) {
      console.error('[V1-DEPOSIT] Profile lookup failed')
      return NextResponse.json(
        { success: false, error: 'Failed to load user profile' },
        { status: 400 },
      )
    }

    // Calculate deposit fee.
    let processingFee = 50
    let netAmount = numAmount - processingFee
    if (depositRules) {
      const feeCalc = calculateDepositFee(numAmount, depositRules)
      processingFee = feeCalc.processingFee
      netAmount = feeCalc.netAmount
    }

    const paymentReference = generatePaymentReference(auth.userId)
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString()
    const nowIso = new Date().toISOString()

    // The local DB insert and the Monnify init-transaction call are
    // independent — neither needs the other's result. Run them in
    // parallel to halve their combined wall time.
    const [insertResult, initTxResult] = await Promise.all([
      admin
        .from('monnify_transactions')
        .insert({
          user_id: auth.userId,
          payment_reference: paymentReference,
          amount: numAmount,
          status: 'PENDING',
          expires_at: expiresAt,
          processing_fee: processingFee,
          net_amount: netAmount,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('id')
        .maybeSingle(),
      initTransaction(
        numAmount,
        String(description || 'Wallet deposit'),
        paymentReference,
        auth.userId,
        profile.email,
        profile.full_name || 'User',
      ),
    ])

    if (insertResult.error || !insertResult.data) {
      console.error('[V1-DEPOSIT] Failed to create transaction row')
      return NextResponse.json(
        { success: false, error: 'Failed to create transaction' },
        { status: 500 },
      )
    }

    if (!initTxResult.success || !initTxResult.transactionReference) {
      return NextResponse.json(
        { success: false, error: initTxResult.error || 'Failed to initialize payment' },
        { status: 502 },
      )
    }

    // init-payment depends on init-transaction's reference, so this stays
    // sequential. The token is already cached, so no auth round-trip.
    const initPayResult = await initializePayment(initTxResult.transactionReference)
    if (!initPayResult.success) {
      return NextResponse.json(
        { success: false, error: initPayResult.error || 'Failed to initialize payment' },
        { status: 502 },
      )
    }

    // The webhook needs these fields to credit the wallet, so we must
    // await the update before responding.
    const updateResult = await updateTransactionWithMonnifyData(paymentReference, {
      transactionReference: initTxResult.transactionReference,
      accountNumber: initPayResult.accountNumber,
      bankName: initPayResult.bankName,
      accountName: initPayResult.accountName,
      bankCode: initPayResult.bankCode,
      ussdCode: initPayResult.ussdCode,
      monnifyResponse: initPayResult,
    })

    if (!updateResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update payment details' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      paymentReference,
      expiresAt,
      amount: numAmount,
      processingFee,
      netAmount,
      account: {
        accountNumber: initPayResult.accountNumber,
        accountName: initPayResult.accountName,
        bankName: initPayResult.bankName,
        bankCode: initPayResult.bankCode,
      },
      checkoutUrl: `https://mozosubz.xyz/checkout/${paymentReference}`,
    })
  } catch (error) {
    console.error('[V1-DEPOSIT] Error')
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
