/**
 * POST /api/provider/verify-pending
 *
 * Internal-only endpoint. Called fire-and-forget from every service action
 * whenever the provider API call times out.
 *
 * Flow
 * ────
 * 1. Validates the internal bearer token.
 * 2. Polls verifyTransaction() every 500 ms for up to 120 s.
 * 3. On confirmed SUCCESS  → atomicDeductWallet + updateTransactionStatus("SUCCESS")
 * 4. On confirmed FAILURE  → updateTransactionStatus("FAILED"), wallet untouched
 * 5. If 120 s elapses with no settlement → mark FAILED, wallet untouched
 *
 * Security
 * ────────
 * Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> — server-side only, never
 * exposed to the browser.
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyTransaction } from "@/lib/api/gsubz"
import { resolveProviderError } from "@/lib/utils/provider-error"
import { atomicDeductWallet, atomicRefundWallet, updateTransactionStatus } from "@/lib/utils/save-transaction"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTransactionEmail } from "@/lib/email/send-transaction-email"

const INTERNAL_TOKEN = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Poll interval in ms */
const POLL_INTERVAL_MS = 500
/** Maximum total time to keep polling in ms (2 minutes) */
const MAX_POLL_MS = 120_000

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** True when the provider response indicates a settled success. */
function isProviderSuccess(r: any): boolean {
  return (
    (r?.code === 200 || r?.code === "200" || r?.code === "000") &&
    (r?.status === "TRANSACTION_SUCCESSFUL" ||
      r?.status === "success" ||
      r?.status === "successful" ||
      r?.description === "TRANSACTION_SUCCESSFUL")
  )
}

/**
 * True when the provider response is a hard failure.
 * Statuses that indicate the provider is still processing are NOT failures.
 */
function isProviderFailure(r: any): boolean {
  if (!r) return false
  const pending = ["pending", "processing", "PENDING", "PROCESSING", "initiated", "INITIATED"]
  if (isProviderSuccess(r)) return false
  return !pending.includes(r?.status ?? "")
}

export async function POST(request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const auth = request.headers.get("Authorization") ?? ""
  if (!INTERNAL_TOKEN || auth !== `Bearer ${INTERNAL_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    requestID: string
    userId: string
    amount: number
    balanceBefore: number
    category: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { requestID, userId, amount, balanceBefore, category } = body

  if (!requestID || !userId) {
    return NextResponse.json({ error: "Missing requestID or userId" }, { status: 400 })
  }


  const deadline = Date.now() + MAX_POLL_MS
  let attempt = 0

  while (Date.now() < deadline) {
    attempt++

    let verifyResponse: any
    try {
      verifyResponse = await verifyTransaction(requestID)
    } catch (err) {
      console.error(`[v0] verify-pending attempt ${attempt} fetch error:`, err)
      // Network error — wait and retry
      await delay(POLL_INTERVAL_MS)
      continue
    }


    // ── Confirmed SUCCESS ───────────────────────────────────────────────────
    if (isProviderSuccess(verifyResponse)) {

      const deductResult = await atomicDeductWallet(userId, amount)

      if (!deductResult.success) {
        console.error(`[v0] verify-pending deduct failed after confirmed success:`, deductResult.error)
        await updateTransactionStatus(requestID, "FAILED", { apiResponse: verifyResponse })
        return NextResponse.json({ settled: "FAILED", reason: "deduct_failed" })
      }

      const balanceAfter = deductResult.newBalance!

      await updateTransactionStatus(requestID, "SUCCESS", {
        balanceAfter,
        apiResponse: verifyResponse,
      })

      // Fire receipt email — non-blocking, swallow errors
      try {
        const supabase = createAdminClient()
        const { data: tx } = await supabase
          .from("transactions")
          .select("*")
          .eq("transaction_id", requestID)
          .single()

        if (tx) {
          sendTransactionEmail({
            userId: tx.user_id,
            category: tx.category,
            serviceName: tx.service_name,
            amount: tx.amount,
            status: "SUCCESS",
            transactionId: requestID,
            extras: [
              { label: "Recipient", value: tx.phone },
              { label: "Balance Before", value: `₦${Number(balanceBefore).toLocaleString()}` },
              { label: "Balance After", value: `₦${Number(balanceAfter).toLocaleString()}` },
            ],
          }).catch(() => {})
        }
      } catch {
        // Email failure must never affect settlement
      }

      return NextResponse.json({ settled: "SUCCESS", balanceAfter, attempts: attempt })
    }

    // ── Confirmed FAILURE ───────────────────────────────────────────────────
    if (isProviderFailure(verifyResponse)) {
      const resolved = resolveProviderError(verifyResponse)

      await updateTransactionStatus(requestID, "FAILED", { apiResponse: verifyResponse })
      // Refund the user since the provider confirmed the transaction failed
      await atomicRefundWallet(userId, amount)
      
      return NextResponse.json({ settled: "FAILED", code: resolved.code, attempts: attempt, refunded: true })
    }

    // Still pending — wait 500ms and poll again
    await delay(POLL_INTERVAL_MS)
  }

  // ── Deadline exceeded ─────────────────────────────────────────────────────
  await updateTransactionStatus(requestID, "FAILED")
  // Provider never settled the transaction within 2 minutes, so refund the user
  await atomicRefundWallet(userId, amount)

  return NextResponse.json({ settled: "FAILED", reason: "deadline_exceeded", attempts: attempt, refunded: true })
}
