import Gsubz, { GsubzError, type TransactionResponse } from "gsubz-sdk"

/**
 * Server-only GSUBZ client built on the `gsubz-sdk` package.
 *
 * `lib/api/gsubz.ts` is the hand-rolled client the original four services use.
 * This module wraps the SDK instead, which covers the rest of the documented
 * GSUBZ surface — exam pins, eSIM, bulk SMS, social orders and meter/smartcard
 * verification — and enforces the doc's rules for us: idempotent requestIDs,
 * `status`-aware success checks (HTTP 200 can still be a failure) and typed
 * errors.
 *
 * Never import this from a client component: it reads GSUBZ_API_KEY.
 */

let cached: Gsubz | null = null

export function getGsubz(): Gsubz {
  if (!cached) {
    cached = new Gsubz({
      apiKey: process.env.GSUBZ_API_KEY,
      baseUrl: process.env.GSUBZ_BASE_URL || undefined,
      timeoutMs: 120_000,
    })
  }
  return cached
}

/** Normalized outcome every SDK purchase is reduced to, so actions stay uniform. */
export interface GsubzOutcome {
  success: boolean
  /** True when the provider never answered — the purchase may still have gone through. */
  pending: boolean
  code: number | string
  description: string
  /** Plain-words provider message. The token/pin text lives here too. */
  apiResponse: string
  transactionID?: string
  requestID?: string
  amount?: number
  amountPaid?: number
  raw: Record<string, unknown>
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

function toId(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  const text = String(value).trim()
  return text === "" ? undefined : text
}

/**
 * Run an SDK purchase and reduce both outcomes to one shape.
 *
 * The SDK throws `GsubzError` for anything that is not a success, so a resolved
 * promise is always a success and a rejection is always a failure — except a
 * client timeout, which is neither: the purchase may have completed on the
 * provider side, so it is surfaced as `pending` for the verify job.
 */
export async function runGsubz(fn: () => Promise<TransactionResponse>): Promise<GsubzOutcome> {
  try {
    const res = await fn()
    return {
      success: true,
      pending: false,
      code: res.code ?? 200,
      description: "TRANSACTION_SUCCESSFUL",
      apiResponse: typeof res.api_response === "string" ? res.api_response : "",
      transactionID: toId(res.transactionID),
      requestID: toId(res.requestID),
      amount: toNumber(res.amount),
      amountPaid: toNumber(res.amountPaid),
      raw: res as Record<string, unknown>,
    }
  } catch (error) {
    return normalizeGsubzError(error)
  }
}

export function normalizeGsubzError(error: unknown): GsubzOutcome {
  if (error instanceof GsubzError) {
    const timedOut = error.code === 0 && error.description === "CLIENT_TIMEOUT"
    return {
      success: false,
      pending: timedOut,
      code: error.code,
      description: error.description,
      apiResponse: error.apiResponse ?? "",
      requestID: toId(error.body.requestID),
      raw: error.body,
    }
  }

  const aborted = error instanceof Error && error.name === "AbortError"
  return {
    success: false,
    pending: aborted,
    code: 0,
    description: aborted ? "CLIENT_TIMEOUT" : "NETWORK_ERROR",
    apiResponse: error instanceof Error ? error.message : "Unknown provider error",
    raw: {},
  }
}

/**
 * User-facing message for a failed outcome. Provider-side problems (their
 * float, a disabled service) are not the customer's fault, so they are phrased
 * as a temporary outage rather than surfaced raw.
 */
export function gsubzFailureMessage(outcome: GsubzOutcome): string {
  if (outcome.pending) {
    return "Your request is taking longer than expected. We are verifying it in the background — your wallet will only be charged if it succeeds."
  }
  switch (Number(outcome.code)) {
    case 401:
      return "That plan is no longer available. Please pick another."
    case 402:
    case 406:
      return "This service is temporarily unavailable. Please try again shortly — you have not been charged."
    case 404:
      return "We could not find that customer or plan. Please check the details and try again."
    case 429:
      return "Too many requests right now. Please try again in a moment."
    case 502:
      return "The provider is temporarily unavailable. Please try again shortly."
    default:
      return outcome.apiResponse || "The transaction could not be completed. Please try again in a few minutes."
  }
}

/** A single social-media order option from the `socials` catalogue. */
export interface SocialService {
  value: number | string
  category: string
  min: number
  max: number
  price: string
  display_name: string
  description?: string
}

/**
 * The `socials` catalogue comes back under `list` (not `plans`), so it is read
 * off the raw response rather than through the SDK's `PlansResponse` typing.
 */
export async function getSocialServices(): Promise<SocialService[]> {
  const res = (await getGsubz().getPlans("socials")) as unknown as { list?: SocialService[] }
  return Array.isArray(res.list) ? res.list : []
}
