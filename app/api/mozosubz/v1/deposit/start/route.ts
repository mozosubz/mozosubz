import { NextRequest, NextResponse } from 'next/server'
import { v1AuthOrRespond } from '@/lib/middleware/v1-auth-helper'
import { createAdminClient } from '@/lib/supabase/admin'
import { initTransaction, initializePayment } from '@/lib/actions/monnify'
import {
  createTransaction,
  updateTransactionWithMonnifyData,
} from '@/lib/actions/transactions'
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

    // Look up user profile via admin client (no Supabase session in v1).
    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', auth.userId)
      .maybeSingle()

    if (profileError || !profile?.email) {
      console.error('[V1-DEPOSIT] Profile lookup failed')
      return NextResponse.json(
        { success: false, error: 'Failed to load user profile' },
        { status: 400 },
      )
    }

    // Calculate deposit fee.
    const depositRules = await getDepositRules()
    let processingFee = 50
    let netAmount = numAmount - processingFee
    if (depositRules) {
      const feeCalc = calculateDepositFee(numAmount, depositRules)
      processingFee = feeCalc.processingFee
      netAmount = feeCalc.netAmount
    }

    const paymentReference = generatePaymentReference(auth.userId)
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString()

    // 1. Create the local transaction row using admin (no session cookies in v1).
    const insertResult = await admin
      .from('monnify_transactions')
      .insert({
        user_id: auth.userId,
        payment_reference: paymentReference,
        amount: numAmount,
        status: 'PENDING',
        expires_at: expiresAt,
        processing_fee: processingFee,
        net_amount: netAmount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle()

    if (insertResult.error || !insertResult.data) {
      console.error('[V1-DEPOSIT] Failed to create transaction row')
      return NextResponse.json(
        { success: false, error: 'Failed to create transaction' },
        { status: 500 },
      )
    }

    // 2. Initialize the Monnify transaction.
    const initTxResult = await initTransaction(
      numAmount,
      String(description || 'Wallet deposit'),
      paymentReference,
      auth.userId,
      profile.email,
      profile.full_name || 'User',
    )
    if (!initTxResult.success || !initTxResult.transactionReference) {
      return NextResponse.json(
        { success: false, error: initTxResult.error || 'Failed to initialize payment' },
        { status: 502 },
      )
    }

    // 3. Initialize the bank transfer payment.
    const initPayResult = await initializePayment(initTxResult.transactionReference)
    if (!initPayResult.success) {
      return NextResponse.json(
        { success: false, error: initPayResult.error || 'Failed to initialize payment' },
        { status: 502 },
      )
    }

    // 4. Persist the Monnify details against our row.
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
