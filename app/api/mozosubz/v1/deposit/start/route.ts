import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { initTransaction, initializePayment } from '@/lib/actions/monnify'
import { createTransaction, updateTransactionWithMonnifyData } from '@/lib/actions/transactions'
import { generatePaymentReference } from '@/lib/utils/payment-reference'
import { getDepositRules } from '@/lib/actions/deposit-rules'
import { calculateDepositFee } from '@/lib/utils/deposit-fee'

export async function POST(request: NextRequest) {
  console.log('[MOZOSUBZ-V1] POST /deposit/start')
  
  try {
    const keyVerification = await verifyConnectKey(request)
    
    if (!keyVerification.success) {
      console.warn('[MOZOSUBZ-V1] Auth failed')
      return NextResponse.json(
        { success: false, error: keyVerification.error },
        { status: keyVerification.status || 401 },
      )
    }

    const body = await request.json()
    const { amount, description } = body

    if (!amount || parseFloat(amount) <= 0) {
      console.warn('[MOZOSUBZ-V1] Invalid amount')
      return NextResponse.json(
        { success: false, error: 'Valid amount is required' },
        { status: 400 },
      )
    }

    const userId = keyVerification.context?.userId
    if (!userId) {
      console.warn('[MOZOSUBZ-V1] User ID not found')
      return NextResponse.json(
        { success: false, error: 'User not authenticated' },
        { status: 401 },
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

    console.log('[MOZOSUBZ-V1] Processing deposit')

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
      console.error('[MOZOSUBZ-V1] Failed to create transaction')
      return NextResponse.json(
        { success: false, error: 'Failed to create transaction' },
        { status: 500 },
      )
    }

    // Initialize with Monnify
    const initTxResult = await initTransaction(
      parseFloat(amount),
      description || 'Wallet deposit',
      paymentReference,
      userId,
      'user@example.com',
      'User'
    )

    if (!initTxResult.success) {
      console.error('[MOZOSUBZ-V1] Monnify init failed')
      return NextResponse.json(
        { success: false, error: initTxResult.error || 'Failed to initialize payment' },
        { status: 400 },
      )
    }

    // Initialize payment
    const initPayResult = await initializePayment(initTxResult.transactionReference)

    if (!initPayResult.success) {
      console.error('[MOZOSUBZ-V1] Payment init failed')
      return NextResponse.json(
        { success: false, error: initPayResult.error || 'Failed to initialize payment' },
        { status: 400 },
      )
    }

    // Update transaction
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
      console.error('[MOZOSUBZ-V1] Failed to update transaction')
      return NextResponse.json(
        { success: false, error: 'Failed to update payment details' },
        { status: 500 },
      )
    }

    console.log('[MOZOSUBZ-V1] Deposit initiated successfully')

    return NextResponse.json({
      success: true,
      paymentReference,
      transactionId: createTxResult.transactionId,
      checkoutUrl: `/checkout/${paymentReference}`,
    })
  } catch (error) {
    console.error('[MOZOSUBZ-V1] Error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
