import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createServerClient } from '@/lib/supabase/server'
import { initTransaction, initializePayment } from '@/lib/actions/monnify'
import { createTransaction, updateTransactionWithMonnifyData } from '@/lib/actions/transactions'
import { generatePaymentReference } from '@/lib/utils/payment-reference'
import { getDepositRules } from '@/lib/actions/deposit-rules'
import { calculateDepositFee } from '@/lib/utils/deposit-fee'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1-DEPOSIT] POST /deposit/start')
  
  try {
    const keyVerification = await verifyConnectKey(request)
    
    if (!keyVerification.success) {
      console.warn('[MOZOSUBZ-V1-DEPOSIT] Authorization failed')
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    const body = await request.json()
    const { amount, description } = body

    console.log('[MOZOSUBZ-V1-DEPOSIT] Request: amount=' + amount)

    if (!amount || parseFloat(amount) <= 0) {
      console.warn('[MOZOSUBZ-V1-DEPOSIT] Invalid amount: ' + amount)
      return NextResponse.json(
        { success: false, error: 'Valid amount is required' },
        { status: 400 },
      )
    }

    const userId = keyVerification.context?.userId
    if (!userId) {
      console.warn('[MOZOSUBZ-V1-DEPOSIT] User ID missing')
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 },
      )
    }

    // Get user profile for email and name
    const supabase = await createServerClient()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profile) {
      console.error('[MOZOSUBZ-V1-DEPOSIT] Failed to get profile')
      return NextResponse.json(
        { success: false, error: 'Failed to get user information' },
        { status: 400 },
      )
    }

    // Calculate deposit fee
    const depositRules = await getDepositRules()
    let processingFee = 50
    let netAmount = parseFloat(amount) - processingFee

    if (depositRules) {
      const feeCalc = calculateDepositFee(parseFloat(amount), depositRules)
      processingFee = feeCalc.processingFee
      netAmount = feeCalc.netAmount
    }

    console.log('[MOZOSUBZ-V1-DEPOSIT] Fee calculated: ' + processingFee)

    const paymentReference = generatePaymentReference(userId)
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString()

    // Create transaction
    const createTxResult = await createTransaction(
      paymentReference,
      parseFloat(amount),
      expiresAt,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      processingFee,
      netAmount
    )

    if (!createTxResult.success) {
      console.error('[MOZOSUBZ-V1-DEPOSIT] Transaction creation failed')
      return NextResponse.json(
        { success: false, error: 'Failed to create transaction' },
        { status: 500 },
      )
    }

    console.log('[MOZOSUBZ-V1-DEPOSIT] Transaction created: ' + createTxResult.transactionId)

    // Initialize with Monnify
    const initTxResult = await initTransaction(
      parseFloat(amount),
      description || 'Wallet deposit',
      paymentReference,
      userId,
      profile.email,
      profile.full_name || 'User'
    )

    if (!initTxResult.success) {
      console.error('[MOZOSUBZ-V1-DEPOSIT] Monnify initialization failed')
      return NextResponse.json(
        { success: false, error: initTxResult.error || 'Failed to initialize payment' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-DEPOSIT] Monnify initialized')

    // Initialize payment to get temporary account details
    const initPayResult = await initializePayment(initTxResult.transactionReference)

    if (!initPayResult.success) {
      console.error('[MOZOSUBZ-V1-DEPOSIT] Payment initialization failed')
      return NextResponse.json(
        { success: false, error: initPayResult.error || 'Failed to initialize payment' },
        { status: 400 },
      )
    }

    console.log('[MOZOSUBZ-V1-DEPOSIT] Payment initialized')

    // Update transaction with Monnify data
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
      console.error('[MOZOSUBZ-V1-DEPOSIT] Failed to update transaction')
      return NextResponse.json(
        { success: false, error: 'Failed to update payment details' },
        { status: 500 },
      )
    }

    console.log('[MOZOSUBZ-V1-DEPOSIT] Success')

    return NextResponse.json({
      success: true,
      paymentReference,
      transactionId: createTxResult.transactionId,
      checkoutUrl: `/checkout/${paymentReference}`,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1-DEPOSIT] Error')
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
