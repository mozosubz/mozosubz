import crypto from "crypto"

/**
 * Pure helpers for idempotency. NO "use server" directive here because we
 * export a type (`IdempotencyParts`) — Server Action files may only export
 * async functions. The DB-touching helpers live in idempotency-actions.ts.
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

/**
 * Stable idempotency / requestID derivation.
 *
 *   requestID = "IDM" + sha256(userId | category | recipient | amount | plan | bucket).slice(0,24)
 *
 * Within the bucket window (default 30s) every retry of the *same intent*
 * collapses to the same requestID. Callers (in idempotency-actions.ts)
 * then use this id to (a) look up an existing local transaction row, and
 * (b) pass to gsubz so the provider also dedupes upstream.
 *
 * If the v1 API caller already supplied their own `requestID`, we honor it
 * verbatim — that key is their idempotency token.
 */
export function deriveRequestID(parts: IdempotencyParts): string {
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
