"use server"
import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { processReferralEarning } from "@/lib/referral"
import { sendTransactionEmail } from "@/lib/email/send-transaction-email"

export type TransactionCategory =
  | "AIRTIME"
  | "DATA"
  | "CABLE"
  | "ELECTRICITY"
  | "WALLET_FUND"
  | "RECHARGE_PINS"
  | "EXAM_PINS"
  | "ESIM"
  | "BULK_SMS"
  | "SOCIAL"
export type TransactionStatus = "SUCCESS" | "FAILED" | "PENDING"

export interface SaveTransactionPayload {
  userId: string
  transactionId: string
  category: TransactionCategory
  serviceId: string
  serviceName: string
  amount: number
  phone: string
  balanceBefore: number
  balanceAfter: number
  description: string
  status: TransactionStatus
  apiResponse?: Record<string, any>
  planDetails?: string
  serviceType?: string
  serviceVariant?: string
  /** Service-specific extras (eSIM country, SMS sender, social link, …). */
  metadata?: Record<string, any>
}

/**
 * UNIFIED TRANSACTION LOGGING
 * This is the ONLY place where transactions are saved to database
 * All services (airtime, data, cable, electricity, wallet) must use this
 */
function extractReceiptToken(apiResponse?: Record<string, any>): string | null {
  if (!apiResponse) return null
  const direct = [apiResponse.token, apiResponse.Token, apiResponse.data?.token]
  for (const value of direct) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  const raw = [apiResponse.api_response, apiResponse.message, apiResponse.response]
  for (const value of raw) {
    if (typeof value !== "string") continue
    const match = value.match(/\btoken\s*:\s*([A-Za-z0-9-]+)/i)
    if (match?.[1]) return match[1]
  }
  return null
}

export async function saveTransaction(payload: SaveTransactionPayload) {
  try {
    // Use admin client so this works for both authenticated UI users (RLS would
    // also allow it, but admin is consistent) and trusted backend callers like
    // the v1 API where there is no Supabase session cookie. The userId is
    // explicitly passed in the payload, so there is no ambient-trust risk.
    const supabase = createAdminClient()

    const transactionData = {
      user_id: payload.userId,
      transaction_id: payload.transactionId,
      category: payload.category,
      service_id: payload.serviceId,
      service_name: payload.serviceName,
      service_type: payload.serviceType || null,
      service_variant: payload.serviceVariant || null,
      amount: payload.amount,
      phone: payload.phone || "",
      status: payload.status,
      description: payload.description,
      balance_before: payload.balanceBefore,
      balance_after: payload.balanceAfter,
      api_response: payload.apiResponse ? JSON.stringify(payload.apiResponse) : null,
      plan_details: payload.planDetails || null,
      metadata: payload.metadata || null,
      created_at: new Date().toISOString(),
    }

    const { error } = await supabase.from("transactions").insert([transactionData])

    if (error) {
      console.error("[v0] Failed to save transaction:", error)
      throw error
    }


    // Process referral earning if transaction is successful
    processReferralEarning({
      id: payload.transactionId,
      user_id: payload.userId,
      category: payload.category,
      status: payload.status,
    }).catch(() => {})

    // Fire-and-forget receipt email. Email failures MUST NOT affect the
    // transaction flow — sendTransactionEmail is non-throwing internally.
    
    const extras: Array<{ label: string; value: string }> = []
    
    // Add recipient/smartcard info. Bulk SMS stores a recipient *count* in
    // `phone`, so it is described by the metadata rows below instead.
    if (payload.phone && payload.category !== 'BULK_SMS') {
      const recipientLabel = payload.category === 'CABLE' ? 'Smartcard' : 'Recipient'
      extras.push({ label: recipientLabel, value: payload.phone })
    }
    
    // Add plan details for data and cable
    if (payload.planDetails) {
      const planLabel = payload.category === 'CABLE' ? 'Package' : 'Plan'
      extras.push({ label: planLabel, value: payload.planDetails })
    }

    // GSUBZ returns electricity tokens in `api_response` as `Token : ...`.
    const receiptToken = payload.category === 'ELECTRICITY' && payload.status === 'SUCCESS'
      ? extractReceiptToken(payload.apiResponse)
      : null
    if (receiptToken) {
      extras.push({ label: 'Electricity Token', value: receiptToken })
    }

    // Service-specific details so the receipt reads like the dashboard receipt
    // for every category (eSIM country, SMS sender, social link, exam pin).
    const meta = payload.metadata || {}
    switch (payload.category) {
      case 'EXAM_PINS':
        if (meta.board) extras.push({ label: 'Exam Board', value: String(meta.board).toUpperCase() })
        if (meta.pin) extras.push({ label: 'Result Checker Pin', value: String(meta.pin) })
        break
      case 'ESIM':
        if (meta.country) extras.push({ label: 'Country', value: String(meta.country) })
        if (meta.packageCode) extras.push({ label: 'Package Code', value: String(meta.packageCode) })
        break
      case 'BULK_SMS':
        if (meta.sender) extras.push({ label: 'Sender ID', value: String(meta.sender) })
        if (meta.recipients) extras.push({ label: 'Recipients', value: String(meta.recipients) })
        if (meta.pages) extras.push({ label: 'Pages', value: String(meta.pages) })
        break
      case 'SOCIAL':
        if (meta.service) extras.push({ label: 'Service', value: String(meta.service) })
        if (meta.quantity) extras.push({ label: 'Quantity', value: String(meta.quantity) })
        if (meta.link) extras.push({ label: 'Link', value: String(meta.link) })
        break
    }

    // Add balance info
    extras.push({ label: 'Balance Before', value: `₦${Number(payload.balanceBefore).toLocaleString()}` })
    extras.push({ label: 'Balance After', value: `₦${Number(payload.balanceAfter).toLocaleString()}` })
    
    sendTransactionEmail({
      userId: payload.userId,
      category: payload.category,
      serviceName: payload.serviceName,
      amount: payload.amount,
      status: payload.status,
      transactionId: payload.transactionId,
      extras: extras.length > 0 ? extras : undefined,
    }).catch((err) => {
      console.error("[v0] sendTransactionEmail failed (swallowed):", err)
    })
    

    return {
      success: true,
    }
  } catch (error) {
    console.error("[v0] saveTransaction error:", error)
    return {
      success: false,
      error: String(error),
    }
  }
}

/**
 * UPDATE TRANSACTION STATUS
 * Patches an existing PENDING transaction to SUCCESS or FAILED after a
 * background requery confirms the real outcome. Also updates balance_after
 * when the transaction resolved as SUCCESS (the deduction happened post-save).
 */
export async function updateTransactionStatus(
  transactionId: string,
  status: "SUCCESS" | "FAILED",
  opts?: { balanceAfter?: number; apiResponse?: Record<string, any> }
) {
  try {
    const supabase = createAdminClient()

    const patch: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    }
    if (opts?.balanceAfter !== undefined) patch.balance_after = opts.balanceAfter
    if (opts?.apiResponse) patch.api_response = JSON.stringify(opts.apiResponse)

    const { error } = await supabase
      .from("transactions")
      .update(patch)
      .eq("transaction_id", transactionId)
      .eq("status", "PENDING") // Safety guard: never overwrite a finalised row

    if (error) {
      console.error("[v0] updateTransactionStatus error:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error("[v0] updateTransactionStatus exception:", error)
    return { success: false, error: String(error) }
  }
}

/**
 * ATOMIC WALLET DEDUCTION
 * Deducts amount from wallet in a single database transaction
 * This prevents race conditions when multiple requests hit simultaneously
 * Returns { success: boolean, newBalance?: number, error?: string }
 */
export async function atomicDeductWallet(userId: string, amount: number) {
  try {
    // Same reasoning as saveTransaction: needs to work for v1 API callers
    // without a Supabase session. The RPC is safe because it operates on the
    // explicit userId argument.
    const supabase = createAdminClient()

    // Use RPC call for atomic transaction - deduct and get new balance in one operation
    const { data, error } = await supabase.rpc('deduct_wallet_balance', {
      user_id: userId,
      deduct_amount: amount,
    })

    if (error) {
      console.error("[v0] atomicDeductWallet RPC error:", error)
      // Check if error is insufficient balance
      if (error.message?.includes('insufficient')) {
        return {
          success: false,
          error: 'Insufficient wallet balance',
        }
      }
      throw error
    }


    return {
      success: true,
      newBalance: data,
    }
  } catch (error) {
    console.error("[v0] atomicDeductWallet error:", error)
    return {
      success: false,
      error: String(error),
    }
  }
}

/**
 * ATOMIC WALLET REFUND
 * Adds amount back to wallet (for failed transactions)
 * Returns { success: boolean, newBalance?: number }
 */
export async function atomicRefundWallet(userId: string, amount: number) {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc('refund_wallet_balance', {
      user_id: userId,
      refund_amount: amount,
    })

    if (error) {
      console.error("[v0] atomicRefundWallet RPC error:", error)
      throw error
    }


    return {
      success: true,
      newBalance: data,
    }
  } catch (error) {
    console.error("[v0] atomicRefundWallet error:", error)
    return {
      success: false,
      error: String(error),
    }
  }
}
