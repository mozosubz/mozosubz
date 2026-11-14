'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMonnifyAccessToken, monnifyFetch } from './monnify'
import { MONNIFY_BASE_URL } from '@/lib/api/monnify-config'
import { sendTransactionEmail } from '@/lib/email/send-transaction-email'
import { isValidTransactionReference, isValidAmount } from '@/lib/utils/input-validation'
import { getDepositRules } from './deposit-rules'
import { calculateDepositFee } from '@/lib/utils/deposit-fee'

/**
 * Get a transaction by payment_reference
 * SECURITY: Validates payment_reference format before DB query
 */
export async function getTransaction(paymentReference: string) {
  try {
    // SECURITY: Validate reference format to prevent injection
    if (!isValidTransactionReference(paymentReference)) {
      return { success: false, error: 'Invalid payment reference format' }
    }

    const supabase = await createServerClient()
    
    const { data, error } = await supabase
      .from('monnify_transactions')
      .select('*')
      .eq('payment_reference', paymentReference)
      .maybeSingle()

    if (error) {
      console.error('[TRANSACTION] Error fetching transaction:', error)
      return { success: false, error: error.message }
    }

    if (!data) {
      return { success: false, error: 'Transaction not found', status: 'NOT_FOUND' }
    }

    // Check if expired
    if (data.status === 'PENDING' && new Date(data.expires_at) < new Date()) {
      // Update status to EXPIRED
      await supabase
        .from('monnify_transactions')
        .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
        .eq('id', data.id)

      data.status = 'EXPIRED'
    }

    return {
      success: true,
      data: {
        id: data.id,
        paymentReference: data.payment_reference,
        transactionReference: data.transaction_reference,
        amount: data.amount,
        status: data.status,
        accountNumber: data.account_number,
        bankName: data.bank_name,
        accountName: data.account_name,
        bankCode: data.bank_code,
        ussdCode: data.ussd_code,
        createdAt: data.created_at,
        expiresAt: data.expires_at,
        paidAt: data.paid_at,
      },
    }
  } catch (error) {
    console.error('[TRANSACTION] Exception:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Create a new transaction in the database
 * SECURITY: Validates all inputs to prevent injection attacks
 */
export async function createTransaction(
  paymentReference: string,
  amount: number,
  expiresAt: string,
  transactionReference?: string,
  accountNumber?: string,
  bankName?: string,
  accountName?: string,
  bankCode?: string,
  ussdCode?: string,
  processingFee?: number,
  netAmount?: number
) {
  try {
    // SECURITY: Validate all inputs
    if (!isValidTransactionReference(paymentReference)) {
      throw new Error('Invalid payment reference format')
    }

    if (!isValidAmount(amount) || amount < 100 || amount > 1000000) {
      throw new Error('Invalid amount')
    }

    if (transactionReference && !isValidTransactionReference(transactionReference)) {
      throw new Error('Invalid transaction reference format')
    }

    const supabase = await createServerClient()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user?.id) {
      return { success: false, error: 'User not authenticated' }
    }

    // SECURITY: This is a server action, so its arguments are attacker-controlled.
    // The credited net_amount must come from server-side fee rules, never the caller.
    void processingFee
    void netAmount
    const depositRules = await getDepositRules()
    const fee = depositRules
      ? calculateDepositFee(amount, depositRules)
      : { processingFee: 50, netAmount: Math.round((amount - 50) * 100) / 100 }
    processingFee = fee.processingFee
    netAmount = fee.netAmount

    if (!(netAmount > 0) || netAmount > amount) {
      return { success: false, error: 'Invalid deposit amount after fees' }
    }

    const { data, error } = await createAdminClient()
      .from('monnify_transactions')
      .insert({
        user_id: user.id,
        payment_reference: paymentReference,
        transaction_reference: transactionReference,
        amount,
        status: 'PENDING',
        account_number: accountNumber,
        bank_name: bankName,
        account_name: accountName,
        bank_code: bankCode,
        ussd_code: ussdCode,
        expires_at: expiresAt,
        processing_fee: processingFee,
        net_amount: netAmount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[TRANSACTION] Error creating transaction:', error)
      return { success: false, error: error.message }
    }

    return { success: true, transactionId: data?.id }
  } catch (error) {
    console.error('[TRANSACTION] Exception:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  paymentReference: string,
  status: 'PENDING' | 'SUCCESS' | 'EXPIRED' | 'CANCELLED'
) {
  try {
    const supabase = await createServerClient()
    
    const { error } = await supabase
      .from('monnify_transactions')
      .update({
        status,
        updated_at: new Date().toISOString(),
        paid_at: status === 'SUCCESS' ? new Date().toISOString() : undefined,
      })
      .eq('payment_reference', paymentReference)

    if (error) {
      console.error('[TRANSACTION] Error updating status:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[TRANSACTION] Exception:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Cancel a transaction
 */
export async function cancelTransaction(paymentReference: string) {
  try {
    const supabase = await createServerClient()
    
    // Verify user owns this transaction
    const { data: transaction, error: fetchError } = await supabase
      .from('monnify_transactions')
      .select('user_id, status')
      .eq('payment_reference', paymentReference)
      .maybeSingle()

    if (fetchError || !transaction) {
      return { success: false, error: 'Transaction not found' }
    }

    // Verify it's the current user's transaction
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user?.id || user.id !== transaction.user_id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Only allow cancelling PENDING transactions
    if (transaction.status !== 'PENDING') {
      return { success: false, error: `Cannot cancel ${transaction.status} transaction` }
    }

    const { error: updateError } = await supabase
      .from('monnify_transactions')
      .update({
        status: 'CANCELLED',
        updated_at: new Date().toISOString(),
      })
      .eq('payment_reference', paymentReference)

    if (updateError) {
      console.error('[TRANSACTION] Error cancelling:', updateError)
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[TRANSACTION] Exception:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Update transaction with Monnify response data
 */
export async function updateTransactionWithMonnifyData(
  paymentReference: string,
  data: {
    transactionReference?: string
    accountNumber?: string
    bankName?: string
    accountName?: string
    bankCode?: string
    ussdCode?: string
    monnifyResponse?: any
  }
) {
  try {
    const supabase = await createServerClient()
    
    
    // FIX 2: Use .select() to get back the updated row and verify the update matched
    const { data: updated, error } = await supabase
      .from('monnify_transactions')
      .update({
        transaction_reference: data.transactionReference ?? null,
        account_number: data.accountNumber ?? null,
        bank_name: data.bankName ?? null,
        account_name: data.accountName ?? null,
        bank_code: data.bankCode ?? null,
        ussd_code: data.ussdCode ?? null,
        monnify_response: data.monnifyResponse ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('payment_reference', paymentReference)
      .select('id, payment_reference, transaction_reference, account_number, bank_name')
      .maybeSingle()

    if (error) {
      console.error('[TRANSACTION_UPDATE] Supabase error:', error)
      return { success: false, error: error.message }
    }

    // CRITICAL: If updated is null, it means the WHERE clause matched 0 rows
    if (!updated) {
      console.error('[TRANSACTION_UPDATE] ❌ Update matched 0 rows:', { paymentReference })
      return { success: false, error: 'Update matched 0 rows - payment_reference not found' }
    }


    return { success: true, updated }
  } catch (error) {
    console.error('[TRANSACTION_UPDATE] Exception:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Attach Bachs checkout-session data to an existing transaction row.
 * Called by the Bachs branch of /api/deposit/start right after the session is
 * created, so the webhook can find the row by bachs_checkout_id. Uses the admin
 * client because the row must be tagged even when no user session is involved.
 */
export async function attachBachsCheckout(
  paymentReference: string,
  data: { checkoutId: string; checkoutUrl: string; providerStatus?: string }
) {
  try {
    const supabase = createAdminClient()

    // .select() verifies the update matched a row instead of silently no-oping.
    const { data: updated, error } = await supabase
      .from('monnify_transactions')
      .update({
        provider: 'bachs',
        bachs_checkout_id: data.checkoutId,
        bachs_checkout_url: data.checkoutUrl,
        provider_status: data.providerStatus ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('payment_reference', paymentReference)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[TRANSACTION_UPDATE] Error attaching Bachs checkout:', error)
      return { success: false, error: error.message }
    }

    // CRITICAL: If updated is null, it means the WHERE clause matched 0 rows
    if (!updated) {
      console.error('[TRANSACTION_UPDATE] ❌ Bachs attach matched 0 rows:', { paymentReference })
      return { success: false, error: 'Update matched 0 rows - payment_reference not found' }
    }

    return { success: true }
  } catch (error) {
    console.error('[TRANSACTION_UPDATE] Exception:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Verify and credit payment - updates wallet balance and logs transaction
 * CRITICAL: Set monnify_transactions.status = SUCCESS immediately after payment confirmation
 * to prevent duplicate processing from polling
 *
 * Trusted callers: (1) the Bachs webhook, after X-Bachs-Signature verification,
 * and (2) /api/payments/verify, after the route confirms ownership.
 */
export async function verifyAndCreditPayment(paymentReference: string) {
  try {
    // SECURITY: Use admin client (bypass RLS) — this function is only called from
    // trusted backend paths:
    //   1) The Bachs webhook, after X-Bachs-Signature verification.
    //   2) /api/payments/verify, after the route confirms the auth user owns the row
    //      AND Bachs itself reports the payment as succeeded.
    // Without admin, the webhook (which has no user session/cookies) hits RLS and
    // always returns "Transaction not found", even though the row exists.
    const supabase = createAdminClient()

    // Get transaction details from monnify_transactions table
    const { data: transaction, error: txError } = await supabase
      .from('monnify_transactions')
      .select('user_id, amount, status, provider, bank_name, account_number, account_name, transaction_reference, processing_fee, net_amount')
      .eq('payment_reference', paymentReference)
      .maybeSingle()

    if (txError || !transaction) {
      console.error('[TRANSACTION] Transaction not found:', paymentReference)
      return { success: false, error: 'Transaction not found' }
    }

    // CRITICAL IDEMPOTENCY CHECK: If already marked SUCCESS, skip entirely
    if (transaction.status === 'SUCCESS') {
      return { success: true, credited: true, alreadyProcessed: true }
    }

    // CRITICAL: Immediately mark as SUCCESS with atomic optimistic locking to prevent duplicate processing from concurrent webhook/polling races.
    // .select() returns the updated row. If another concurrent request claimed it first, updatedRow will be null/empty.
    const { data: updatedRows, error: markSuccessError } = await supabase
      .from('monnify_transactions')
      .update({ status: 'SUCCESS', paid_at: new Date().toISOString() })
      .eq('payment_reference', paymentReference)
      .eq('status', transaction.status) // Atomically ensure status hasn't changed
      .select('id')

    if (markSuccessError) {
      console.error('[TRANSACTION] Error marking payment as success:', markSuccessError)
      return { success: false, error: 'Error marking payment as success' }
    }

    if (!updatedRows || updatedRows.length === 0) {
      return { success: true, credited: true, alreadyProcessed: true }
    }

    // Promised credit (deposit page showed this): amount minus the deposit rule fee.
    const promisedCredit = Number(transaction.net_amount || transaction.amount)

    // Corridor fee pass-through (owner policy): the deposit fee covers Bachs'
    // bank-transfer cost, but a customer can pay the same checkout with a USD
    // card, international card, mobile money or crypto — corridors Bachs
    // charges far more for. The uncovered part of Bachs' actual fee is
    // deducted from the user's credit, so the platform never loses on the
    // corridor choice. Lookup failure must never block a paid deposit: on any
    // error we credit the promised amount and the platform absorbs the fee.
    let corridorFee: Awaited<ReturnType<typeof import('@/lib/api/bachs-fees')['resolveCorridorFee']>> | null = null
    if (transaction.provider === 'bachs') {
      try {
        const [bachs, { resolveCorridorFee }] = await Promise.all([
          import('@/lib/actions/bachs'),
          import('@/lib/api/bachs-fees'),
        ])
        const { data: feeRow } = await supabase
          .from('monnify_transactions')
          .select('bachs_checkout_id')
          .eq('payment_reference', paymentReference)
          .maybeSingle()
        if (feeRow?.bachs_checkout_id) {
          const lookup = await bachs.getBachsPaymentByCheckoutId(String(feeRow.bachs_checkout_id))
          if (lookup.success) {
            corridorFee = await resolveCorridorFee(lookup, Number(transaction.processing_fee || 0))
            const { syncBachsFeeMetadata } = bachs
            const persisted = await syncBachsFeeMetadata(paymentReference)
            if (!persisted.success) {
              console.warn('[TRANSACTION] Bachs fee metadata not persisted (non-fatal):', persisted.error)
            }
          } else {
            console.warn('[TRANSACTION] Bachs payment lookup failed during credit (crediting promised amount):', lookup.error)
          }
        }
      } catch (feeError) {
        console.warn('[TRANSACTION] Corridor fee computation failed (crediting promised amount):', feeError)
      }
    }
    const corridorExcess = corridorFee?.excessNaira ?? 0
    const creditAmount = Math.max(0, Math.round((promisedCredit - corridorExcess) * 100) / 100)

    // Atomic credit: the RPC row-locks the profile and adds in one statement, so a
    // concurrent purchase deduction can't be overwritten by a stale read here.
    const { data: newBalance, error: creditError } = await supabase.rpc('refund_wallet_balance', {
      user_id: transaction.user_id,
      refund_amount: creditAmount,
    })

    if (creditError || newBalance === null || newBalance === undefined) {
      console.error('[TRANSACTION] Error crediting wallet:', creditError)
      // Release the claim so the webhook/polling can retry instead of losing the deposit.
      await supabase
        .from('monnify_transactions')
        .update({ status: transaction.status })
        .eq('payment_reference', paymentReference)
      return { success: false, error: 'Error crediting wallet' }
    }

    const balanceAfter = Number(newBalance)
    const balanceBefore = Number((balanceAfter - creditAmount).toFixed(2))

    // Record what was actually deducted from the user for the corridor fee.
    if (transaction.provider === 'bachs' && corridorExcess > 0) {
      await supabase
        .from('monnify_transactions')
        .update({ bachs_fee_charged_naira: corridorExcess })
        .eq('payment_reference', paymentReference)
    }


    // Log transaction to transactions table with full schema
    // Check if profile exists (if they have a wallet balance, they're a valid user)
    const { data: profileExists } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', transaction.user_id)
      .maybeSingle()

    if (profileExists) {
      const { error: saveError } = await supabase
        .from('transactions')
        .insert({
          user_id: transaction.user_id,
          transaction_id: paymentReference,
          category: 'WALLET_FUND',
          service_id: transaction.transaction_reference || (transaction.provider === 'bachs' ? 'bachs_checkout' : 'bank_transfer'),
          service_name: transaction.provider === 'bachs' ? 'Bachs Checkout' : (transaction.bank_name || 'Bank Transfer'),
          amount: creditAmount,
          phone: '',
          status: 'SUCCESS',
          description: transaction.bank_name
            ? `Wallet funded via bank transfer from ${transaction.bank_name}`
            : `Wallet funded via checkout (${transaction.transaction_reference || 'online'})`,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          api_response: JSON.stringify({
            account: transaction.account_number,
            accountName: transaction.account_name,
            bankName: transaction.bank_name,
            depositAmount: transaction.amount,
            processingFee: transaction.processing_fee || 0,
            netAmount: creditAmount,
            ...(corridorFee && corridorFee.excessNaira
              ? {
                  corridorFeeOriginal: corridorFee.feeOriginal,
                  corridorFeeCurrency: corridorFee.feeCurrency,
                  corridorFeeNaira: corridorFee.feeNaira,
                  corridorFeeCharged: corridorFee.excessNaira,
                }
              : {}),
          }),
          created_at: new Date().toISOString(),
          payment_reference: paymentReference,
          transaction_reference: transaction.transaction_reference,
          monnify_account_number: transaction.account_number,
          monnify_bank_name: transaction.bank_name,
          monnify_account_name: transaction.account_name,
          payment_method: 'BANK_TRANSFER',
        })

      if (saveError) {
        console.error('[TRANSACTION] Error logging transaction:', saveError)
        // Don't fail the payment if transaction logging fails - wallet is already updated
      }
    } else {
      console.warn('[TRANSACTION] Profile not found, skipping transaction log:', transaction.user_id)
    }


    // Fire-and-forget receipt. This path only runs for NEWLY credited deposits
    // (the idempotency check above returns early for duplicates), so the email
    // will only be sent once per successful deposit.
    sendTransactionEmail({
      userId: transaction.user_id,
      category: 'WALLET_FUND',
      serviceName: transaction.bank_name || 'Bank Transfer',
      amount: creditAmount,
      status: 'SUCCESS',
      transactionId: paymentReference,
      paymentMethod: 'Bank Transfer',
      extras: [
        ...(corridorFee && corridorFee.excessNaira
          ? [{
              label: `Processor fee (${(corridorFee.feeCurrency || '').toUpperCase()} card/int'l)`,
              value: `−₦${corridorFee.excessNaira.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            }]
          : []),
        { label: 'New balance', value: `₦${balanceAfter.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      ],
    }).catch((err) => {
      console.error('[TRANSACTION] deposit email failed (swallowed):', err)
    })

    return { success: true, credited: true, creditedAmount: creditAmount }
  } catch (error) {
    console.error('[TRANSACTION] Exception:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Query Monnify for real-time transaction status using transactionReference
 * This is the Monnify reference, not our internal paymentReference
 */
export async function queryMonnifyTransaction(paymentReference: string, useAdminClient = false) {
  try {
    // First, get the transaction from our DB to get the transactionReference.
    // The admin client is used by the webhook fallback, which runs without a
    // user session and would otherwise be blocked by RLS.
    const supabase = useAdminClient ? createAdminClient() : await createServerClient()
    const { data: dbTransaction, error: dbError } = await supabase
      .from('monnify_transactions')
      .select('transaction_reference, user_id, amount, bank_name')
      .eq('payment_reference', paymentReference)
      .maybeSingle()

    if (dbError || !dbTransaction || !dbTransaction.transaction_reference) {
      console.error('[MONNIFY_QUERY] DB transaction not found or no transactionReference:', paymentReference)
      return { success: false, error: 'Transaction not found in database' }
    }

    const accessToken = await getMonnifyAccessToken()
    if (!accessToken) {
      return { success: false, error: 'Failed to authenticate with Monnify' }
    }

    // Query Monnify using their transactionReference (not our paymentReference)
    const encodedRef = encodeURIComponent(dbTransaction.transaction_reference)
    const response = await monnifyFetch(
      `${MONNIFY_BASE_URL}/api/v2/merchant/transactions/query?transactionReference=${encodedRef}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const responseText = await response.text()

    if (!response.ok) {
      console.error('[MONNIFY_QUERY] Query failed:', response.status, responseText)
      return { success: false, error: 'Failed to query transaction' }
    }

    const data = JSON.parse(responseText) as any
    const responseBody = data.responseBody

    // Check if payment is PAID
    if (responseBody.paymentStatus === 'PAID') {
      // Credit the wallet immediately
      const creditResult = await verifyAndCreditPayment(paymentReference)
      
      if (!creditResult.success) {
        console.error('[MONNIFY_QUERY] Error crediting:', creditResult.error)
        return { success: false, error: creditResult.error }
      }

      return {
        success: true,
        paymentStatus: 'PAID',
        credited: true,
        transactionData: responseBody,
      }
    }

    return {
      success: true,
      paymentStatus: responseBody.paymentStatus || 'PENDING',
      transactionData: responseBody,
    }
  } catch (error) {
    console.error('[MONNIFY_QUERY] Exception:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Get one of the current user's transactions by row id for the receipt page.
 * SECURITY: the session user is resolved server-side and the query is scoped
 * to their user_id — the client never supplies or spoofs ownership.
 */
export async function getTransactionById(id: string) {
  try {
    const uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRx.test(id)) {
      return { success: false as const, error: 'Invalid transaction id' }
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false as const, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return { success: false as const, error: 'Failed to load transaction' }
    }
    if (!data) {
      return { success: false as const, error: 'Transaction not found' }
    }

    return { success: true as const, transaction: data }
  } catch {
    return { success: false as const, error: 'Failed to load transaction' }
  }
}
