import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { initTransaction, initializePayment } from '@/lib/actions/monnify'
import { createTransaction, updateTransactionWithMonnifyData } from '@/lib/actions/transactions'
import { generatePaymentReference } from '@/lib/utils/payment-reference'
import { getDepositRules } from '@/lib/actions/deposit-rules'
import { calculateDepositFee } from '@/lib/utils/deposit-fee'

/**
 * POST /api/whatsapp/deposit/initiate
 *
 * WhatsApp bot calls this to initiate a deposit for a WhatsApp user.
 * Returns payment details (bank account, USSD code, etc.) and transparent fee breakdown.
 *
 * Bot uses the same logic as /api/deposit/start but:
 * - Takes whatsappPhone instead of session auth
 * - Returns transparent fee breakdown
 * - Status 200 for all responses
 *
 * Body: {
 *   "whatsappPhone": "+2349056458312",
 *   "amount": "10000",
 *   "description": "Fund wallet"
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { whatsappPhone, amount, description } = body

    // --- Validate inputs ---
    if (!whatsappPhone || !amount) {
      return NextResponse.json(
        {
          success: true,
          authenticated: false,
          message: 'Missing required fields: whatsappPhone, amount',
        },
        { status: 200 }
      )
    }

    const parsedAmount = parseFloat(amount)
    if (parsedAmount <= 0) {
      return NextResponse.json(
        {
          success: true,
          error: 'Amount must be greater than 0',
        },
        { status: 200 }
      )
    }

    const admin = createAdminClient()

    // --- Resolve WhatsApp to user_id ---
    const { data: session } = await admin
      .from('whatsapp_sessions')
      .select('user_id, is_verified')
      .eq('whatsapp_phone', whatsappPhone)
      .maybeSingle()

    if (!session) {
      return NextResponse.json(
        {
          success: true,
          authenticated: false,
          message: 'This WhatsApp number is not connected to an active Mozosubz account. Please connect it on the website first.',
        },
        { status: 200 }
      )
    }

    if (!session.is_verified) {
      return NextResponse.json(
        {
          success: true,
          authenticated: false,
          message: 'This WhatsApp number has been disconnected from your account. Please reconnect it on the website.',
        },
        { status: 200 }
      )
    }

    const userId = session.user_id

    // --- Get user profile ---
    const { data: profile } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          message: 'User profile not found',
        },
        { status: 200 }
      )
    }

    // --- Calculate deposit fee ---
    const depositRules = await getDepositRules()
    let processingFee = 50
    let netAmount = parsedAmount - processingFee

    if (depositRules) {
      const feeCalc = calculateDepositFee(parsedAmount, depositRules)
      processingFee = feeCalc.processingFee
      netAmount = feeCalc.netAmount
    }

    // --- Generate payment reference ---
    const paymentReference = generatePaymentReference(userId)
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString()

    // --- Create transaction in DB ---
    const createTxResult = await createTransaction(
      paymentReference,
      parsedAmount,
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
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to create transaction',
        },
        { status: 200 }
      )
    }

    // --- Initialize with Monnify ---
    const initTxResult = await initTransaction(
      parsedAmount,
      description || 'Wallet deposit',
      paymentReference,
      userId,
      profile.email,
      profile.full_name || 'User'
    )

    if (!initTxResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: initTxResult.error || 'Failed to initialize payment',
        },
        { status: 200 }
      )
    }

    // --- Get payment details ---
    const initPayResult = await initializePayment(initTxResult.transactionReference)

    if (!initPayResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: initPayResult.error || 'Failed to get payment details',
        },
        { status: 200 }
      )
    }

    // --- Update transaction with Monnify data ---
    await updateTransactionWithMonnifyData(paymentReference, {
      transactionReference: initTxResult.transactionReference,
      accountNumber: initPayResult.accountNumber,
      bankName: initPayResult.bankName,
      accountName: initPayResult.accountName,
      bankCode: initPayResult.bankCode,
      ussdCode: initPayResult.ussdCode,
      monnifyResponse: initPayResult,
    })

    // --- Log success ---
    void admin.from('whatsapp_audit_logs').insert({
      user_id: userId,
      whatsapp_phone: whatsappPhone,
      event_type: 'deposit_initiated',
      details: { amount: parsedAmount },
    })

    // --- Return transparent response ---
    return NextResponse.json({
      success: true,
      paymentReference,
      transferDetails: {
        grossAmount: parsedAmount,
        description: 'Amount you need to transfer',
      },
      feeBreakdown: {
        processingFee,
        feePercentage: depositRules ? '1-2%' : 'Standard rate',
      },
      amountYouReceive: {
        amount: netAmount,
        description: 'This will be added to your wallet after processing',
      },
      bankAccount: {
        accountNumber: initPayResult.accountNumber,
        bankName: initPayResult.bankName,
        accountName: initPayResult.accountName,
        bankCode: initPayResult.bankCode,
      },
      ussdCode: initPayResult.ussdCode,
      instructions: [
        `1. Transfer exactly ₦${parsedAmount.toLocaleString()} to the account above`,
        `2. Or dial ${initPayResult.ussdCode} and follow the prompts`,
        `3. After transfer, your balance will be updated to ₦${netAmount.toLocaleString()}`,
        `4. Keep your payment reference: ${paymentReference}`,
      ],
      summary: `Transfer ₦${parsedAmount.toLocaleString()} to receive ₦${netAmount.toLocaleString()} (after ₦${processingFee} fee)`,
    })
  } catch (error) {
    console.error('[v0] whatsapp deposit error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      },
      { status: 200 }
    )
  }
}
