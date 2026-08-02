/**
 * POST /api/gsubz/verify-pending
 *
 * Internal-only endpoint. Called fire-and-forget by purchaseData (and the
 * other service actions) whenever a provider API call times out.
 *
 * Flow
 * ────
 * 1. Validates the internal bearer token so this can never be triggered by an
 *    external caller.
 * 2. Waits an initial delay (default 30 s) then calls verifyTransaction().
 * 3. If the provider hasn't settled yet it retries up to two more times (at
 *    ~60 s and ~120 s from the first call).
 * 4. On a confirmed SUCCESS  → atomicDeductWallet + updateTransactionStatus
 * 5. On a confirmed FAILURE  → updateTransactionStatus (wallet untouched)
 * 6. If the provider still hasn't settled after all retries → mark FAILED and
 *    leave wallet untouched.
 *
 * Security
 * ────────
 * The route checks Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>.  That
 * key is server-side only and is never sent to the browser.
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyTransaction } from "@/lib/api/gsubz"
import { resolveProviderError } from "@/lib/utils/provider-error"
import {
  atomicDeductWallet,
  updateTransactionStatus,
} from "@/lib/utils/save-transaction"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTransactionEmail } from "@/lib/email/send-transaction-email"

const INTERNAL_TOKEN = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Delay helper — resolves after `ms` milliseconds. */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** True when a provider response code/status indicates settled success. */
function isProviderSuccess(r: any): boolean {
  return (
    (r.code === 200 || r.code === "200" || r.code === "000") &&
    (r.status === "TRANSACTION_SUCCESSFUL" ||
      r.status === "success" ||
      r.status === "successful" ||
      r.description === "TRANSACTION_SUCCESSFUL")
  )
}

/** True when the provider response is a hard failure (not still pending). */
function isProviderFailure(r: any): boolean {
  const pending = ["pending", "processing", "PENDING", "PROCESSING"]
  return !isProviderSuccess(r) && !pending.includes(r.status ?? "")
}

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
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
    initialDelayMs?: number
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const {
    requestID,
    userId,
    amount,
    balanceBefore,
    category,
    initialDelayMs = 30_000,
  } = body

  console.log(`[v0] verify-pending START | requestID=${requestID} | category=${category}`)

  // ── Retry schedule: 30 s → 30 s → 60 s (total ≈ 2 min) ─────────────────
  const delays = [initialDelayMs, 30_000, 60_000]

  for (let attempt = 0; attempt < delays.length; attempt++) {
    await delay(delays[attempt])

    console.log(`[v0] verify-pending attempt ${attempt + 1} | requestID=${requestID}`)

    let verifyResponse: any
    try {
      verifyResponse = await verifyTransaction(requestID)
    } catch (err) {
      console.error(`[v0] verify-pending attempt ${attempt + 1} fetch error:`, err)
      // Network error — try again on next iteration
      continue
    }

    console.log(`[v0] verify-pending response attempt ${attempt + 1}:`, JSON.stringify(verifyResponse))

    if (isProviderSuccess(verifyResponse)) {
      // ── SUCCESS path ──────────────────────────────────────────────────────
      console.log(`[v0] verify-pending CONFIRMED SUCCESS | requestID=${requestID}`)

      const deductResult = await atomicDeductWallet(userId, amount)

      if (!deductResult.success) {
        // Wallet deduction failed (e.g. insufficient balance at settle time).
        // Mark as FAILED so the user isn't left with a ghost PENDING row.
        console.error(`[v0] verify-pending deduct failed after success:`, deductResult.error)
        await updateTransactionStatus(requestID, "FAILED", { apiResponse: verifyResponse })
        return NextResponse.json({ settled: "FAILED", reason: "deduct_failed" })
      }

      const balanceAfter = deductResult.newBalance!

      await updateTransactionStatus(requestID, "SUCCESS", {
        balanceAfter,
        apiResponse: verifyResponse,
      })

      // Fire success email. Fetch the transaction row to get full details for
      // the email template.
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
        // Email failure must not affect settlement
      }

      return NextResponse.json({ settled: "SUCCESS", balanceAfter })
    }

    if (isProviderFailure(verifyResponse)) {
      // ── FAILURE path ──────────────────────────────────────────────────────
      const resolved = resolveProviderError(verifyResponse)
      console.log(`[v0] verify-pending CONFIRMED FAILURE | requestID=${requestID} | code=${resolved.code}`)

      await updateTransactionStatus(requestID, "FAILED", { apiResponse: verifyResponse })

      return NextResponse.json({ settled: "FAILED", code: resolved.code })
    }

    // Still pending — continue to next retry
    console.log(`[v0] verify-pending still pending, will retry | requestID=${requestID}`)
  }

  // ── All retries exhausted — treat as failed ───────────────────────────────
  console.log(`[v0] verify-pending TIMEOUT EXHAUSTED | requestID=${requestID} — marking FAILED`)
  await updateTransactionStatus(requestID, "FAILED")

  return NextResponse.json({ settled: "FAILED", reason: "retries_exhausted" })
}
