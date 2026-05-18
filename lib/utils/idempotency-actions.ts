"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { verifyTransaction } from "@/lib/api/gsubz"

/**
 * DB- and provider-touching helpers for idempotency. Lives in its own file
 * so it can carry the "use server" directive without conflicting with the
 * type export in `idempotency.ts`.
 */

/**
 * Look up the transactions table for an existing row keyed by transaction_id.
 * Scoped by user_id as defense-in-depth.
 */
export async function findExistingTransaction(userId: string, transactionId: string) {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("transaction_id", transactionId)
      .maybeSingle()
    return data
  } catch (err) {
    console.error("[idempotency] findExistingTransaction error:", err)
    return null
  }
}

/**
 * Ask gsubz what really happened with this requestID. Used after a network
 * error or timeout on the buy call.
 *
 * Returns "success" | "failed" | "unknown". Callers MUST treat "unknown"
 * as still-pending — neither debit nor declare failure.
 */
export async function reconcileWithProvider(
  requestID: string,
): Promise<{ status: "success" | "failed" | "unknown"; raw?: any }> {
  try {
    const verify = await verifyTransaction(requestID)
    const code = String(verify?.code ?? "")
    const status = String(verify?.status ?? "")
    const desc = String(verify?.description ?? "")
    const okCode = code === "200" || code === "000"
    const okStatus =
      status === "TRANSACTION_SUCCESSFUL" ||
      status === "success" ||
      status === "successful" ||
      desc === "TRANSACTION_SUCCESSFUL"

    if (okCode && okStatus) return { status: "success", raw: verify }
    if (verify && (code || status)) return { status: "failed", raw: verify }
    return { status: "unknown", raw: verify }
  } catch (err) {
    console.error("[idempotency] reconcileWithProvider error:", err)
    return { status: "unknown" }
  }
}
