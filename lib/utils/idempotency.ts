"use server"

import crypto from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyTransaction } from "@/lib/api/gsubz"

/**
 * Stable idempotency / requestID derivation.
 *
 * Goal: a user double-clicking the "Buy" button, or a flaky network causing
 * the client to retry, must NEVER produce two real purchases. We solve this
 * without any schema migration or external store by deriving a deterministic
 * `requestID` from the purchase intent + a short time bucket:
 *
 *   requestID = "IDM" + sha256(userId | category | phone | amount | plan | bucket).slice(0,24)
 *
 * Within the bucket window (default 30s) every retry of the *same intent*
 * collapses to the same requestID. We then:
 *
 *   1. Look up the `transactions` table for any row with that transaction_id.
 *      If we find one — even if it's still being processed — we return it
 *      and skip the rest of the flow. This is the "second click" guard.
 *
 *   2. Pass the same requestID to gsubz. Gsubz dedupes upstream on requestID
 *      too, so even if our DB lookup races, the provider will not bill twice.
 *
 *   3. On a gsubz network error or timeout, the caller MUST reconcile by
 *      calling `reconcileWithProvider(requestID)` — gsubz's verify endpoint
 *      returns the authoritative state of that requestID, so we never mark
 *      a successful provider-side transaction as failed locally.
 *
 * If the v1 API caller already supplied their own `requestID`, we honor it
 * verbatim and skip the derivation — that key is their idempotency token.
 */

const DEFAULT_BUCKET_MS = 30_000

export interface IdempotencyParts {
  userId: string
  category: "AIRTIME" | "DATA" | "CABLE" | "ELECTRICITY" | "RECHARGE_PINS"
  /** The recipient phone, smartcard, or meter number. */
  recipient: string
  /** Final NGN amount as a number; coerced to fixed-2 so 100 and 100.0 collide. */
  amount: number
  /** Optional plan / package / variation code that further narrows the intent. */
  plan?: string
  /** Optional caller-supplied key (e.g. from v1 API). When set, used as-is. */
  clientRequestID?: string
  /** Override the bucket window. */
  bucketMs?: number
}

export async function deriveRequestID(parts: IdempotencyParts): Promise<string> {
  if (parts.clientRequestID && parts.clientRequestID.trim().length > 0) {
    return parts.clientRequestID.trim()
  }
  const bucket = Math.floor(Date.now() / (parts.bucketMs || DEFAULT_BUCKET_MS))
  const hash = crypto
    .createHash("sha256")
    .update(
      [
        parts.userId,
        parts.category,
        String(parts.recipient || "").trim().toLowerCase(),
        Number(parts.amount).toFixed(2),
        String(parts.plan || "").trim().toLowerCase(),
        String(bucket),
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 24)
  return `IDM${hash}`
}

/**
 * Look up the transactions table for an existing row keyed by transaction_id.
 * Returns the row (or null) so the caller can short-circuit and return the
 * same outcome to the client. We scope by user_id as a defense-in-depth
 * check — even if a key somehow collided across users, we'd never leak.
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
 * Ask gsubz what *really* happened with this requestID. Used after a network
 * error or timeout on the buy call so we don't tell the user "failed" when
 * the provider actually completed the transaction.
 *
 * Returns one of: "success" | "failed" | "unknown". Callers should treat
 * "unknown" as still-pending (i.e. neither debit nor declare failure yet).
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

    // Gsubz returns a non-success code/status when it knows it failed. If we
    // got *any* well-formed response back, treat absence of success as a
    // definitive failure.
    if (verify && (code || status)) return { status: "failed", raw: verify }

    return { status: "unknown", raw: verify }
  } catch (err) {
    console.error("[idempotency] reconcileWithProvider error:", err)
    return { status: "unknown" }
  }
}
