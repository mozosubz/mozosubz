/**
 * scheduleVerifyPending
 *
 * Fires a fire-and-forget POST to /api/provider/verify-pending after a provider
 * API call times out. The route retries verifyTransaction() up to three times
 * over ~2 minutes, and if it resolves as SUCCESS it deducts the wallet and
 * updates the transaction row. If it resolves as FAILED (or retries are
 * exhausted) it marks FAILED and leaves the wallet untouched.
 *
 * The caller must have already saved the transaction as PENDING before
 * calling this. The function is intentionally fire-and-forget — it swallows
 * all errors so a scheduling failure never bubbles up to the user.
 */
export function scheduleVerifyPending(payload: {
  requestID: string
  userId: string
  amount: number
  balanceBefore: number
  category: string
  /** Delay in ms before the first verify attempt. Defaults to 30 000. */
  initialDelayMs?: number
}): void {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

  const internalToken = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!internalToken) {
    console.error("[v0] scheduleVerifyPending: SUPABASE_SERVICE_ROLE_KEY not set — cannot schedule")
    return
  }

  // Fire and forget — no await, no error propagation to caller
  fetch(`${baseUrl}/api/provider/verify-pending`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${internalToken}`,
    },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error("[v0] scheduleVerifyPending fetch failed (swallowed):", err)
  })

  console.log(`[v0] scheduleVerifyPending queued | requestID=${payload.requestID}`)
}
