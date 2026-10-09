import { revalidatePath } from "next/cache"
import { atomicDeductWallet, saveTransaction, type TransactionCategory } from "@/lib/utils/save-transaction"
import { scheduleVerifyPending } from "@/lib/utils/schedule-verify"
import { gsubzFailureMessage, type GsubzOutcome } from "@/lib/api/gsubz-sdk"

export interface PurchaseResult {
  success: boolean
  pending?: boolean
  message: string
  errorCode?: string
  transaction?: {
    id: string
    type: string
    amount: number
    status: "success" | "failed" | "pending"
    balance: number
    [key: string]: unknown
  }
}

export interface GsubzPurchaseContext {
  userId: string
  category: TransactionCategory
  serviceId: string
  serviceName: string
  amount: number
  phone: string
  description: string
  planDetails?: string
  serviceType?: string
  balanceBefore: number
  requestID: string
  /** Extra fields merged into the returned transaction object for the UI. */
  meta?: Record<string, unknown>
}

/**
 * Shared wallet + ledger flow for every SDK-backed purchase.
 *
 * The dashboard only ever deducts AFTER a confirmed provider success, so a
 * failure leaves the wallet untouched and a timeout is parked as PENDING for
 * the background verify job. Keeping this in one place means exam pins, eSIM,
 * bulk SMS and social orders all behave identically.
 */
export async function finalizeGsubzPurchase(
  ctx: GsubzPurchaseContext,
  outcome: GsubzOutcome,
): Promise<PurchaseResult> {
  const base = { id: ctx.requestID, type: ctx.category.toLowerCase(), amount: ctx.amount, ...ctx.meta }

  if (outcome.success) {
    const transactionId = outcome.transactionID || ctx.requestID
    const deduct = await atomicDeductWallet(ctx.userId, ctx.amount)
    if (!deduct.success) {
      // The provider already completed the purchase, so reporting a failure
      // here would invite a retry and a duplicate order (a second SMS, a second
      // pin…). Record the success and let support reconcile the wallet.
      console.error("[v0] Provider purchase succeeded but wallet deduction failed:", {
        requestID: ctx.requestID,
        userId: ctx.userId,
        amount: ctx.amount,
        error: deduct.error,
      })
    }
    const balanceAfter = deduct.success
      ? deduct.newBalance ?? ctx.balanceBefore - ctx.amount
      : ctx.balanceBefore

    await saveTransaction({
      userId: ctx.userId,
      transactionId,
      category: ctx.category,
      serviceId: ctx.serviceId,
      serviceName: ctx.serviceName,
      amount: ctx.amount,
      phone: ctx.phone,
      status: "SUCCESS",
      description: ctx.description,
      balanceBefore: ctx.balanceBefore,
      balanceAfter,
      apiResponse: outcome.raw,
      planDetails: ctx.planDetails,
      serviceType: ctx.serviceType,
      metadata: ctx.meta,
    })

    // A cache revalidation error must never turn a completed purchase into a
    // reported failure.
    try {
      revalidatePath("/dashboard")
    } catch (error) {
      console.error("[v0] revalidatePath failed after successful purchase:", error)
    }

    return {
      success: true,
      message: "Purchase successful",
      transaction: { ...base, id: transactionId, status: "success", balance: balanceAfter },
    }
  }

  if (outcome.pending) {
    await saveTransaction({
      userId: ctx.userId,
      transactionId: ctx.requestID,
      category: ctx.category,
      serviceId: ctx.serviceId,
      serviceName: ctx.serviceName,
      amount: ctx.amount,
      phone: ctx.phone,
      status: "PENDING",
      description: ctx.description,
      balanceBefore: ctx.balanceBefore,
      balanceAfter: ctx.balanceBefore,
      planDetails: ctx.planDetails,
      serviceType: ctx.serviceType,
      metadata: ctx.meta,
    })

    scheduleVerifyPending({
      requestID: ctx.requestID,
      userId: ctx.userId,
      amount: ctx.amount,
      balanceBefore: ctx.balanceBefore,
      category: ctx.category,
    })

    return { success: false, pending: true, message: gsubzFailureMessage(outcome) }
  }

  await saveTransaction({
    userId: ctx.userId,
    transactionId: ctx.requestID,
    category: ctx.category,
    serviceId: ctx.serviceId,
    serviceName: ctx.serviceName,
    amount: ctx.amount,
    phone: ctx.phone,
    status: "FAILED",
    description: ctx.description,
    balanceBefore: ctx.balanceBefore,
    balanceAfter: ctx.balanceBefore,
    apiResponse: outcome.raw,
    planDetails: ctx.planDetails,
    serviceType: ctx.serviceType,
    metadata: ctx.meta,
  })

  return {
    success: false,
    message: gsubzFailureMessage(outcome),
    errorCode: String(outcome.code),
    transaction: { ...base, status: "failed", balance: ctx.balanceBefore },
  }
}
