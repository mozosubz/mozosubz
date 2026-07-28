/**
 * Translates a raw Gsubz provider payload into a clean, user-facing message.
 *
 * Gsubz returns failures in two very different shapes:
 *
 *   1. Soft failure — HTTP 200 with `status: "failed"` and the human-readable
 *      reason in an `api_response` field. There is NO `description` field.
 *        { code: 200, status: "failed",
 *          api_response: "Dear customer, you are not eligible for this offer..." }
 *
 *   2. Hard failure — non-200 code with an ALL_CAPS enum in `description`
 *      (sometimes only nested under `content`).
 *        { code: "402", status: "TRANSACTION_FAILED",
 *          description: "INSUFFICIENT_BALANCE" }
 *
 * Reading `description` alone (the old behaviour) meant shape 1 always fell
 * through to a useless "Transaction failed", and shape 2 leaked raw enums like
 * "INSUFFICIENT_BALANCE" straight to the customer — which is especially bad
 * because that refers to OUR provider float, not the customer's wallet.
 */

export type ProviderErrorCode =
  | 'NOT_ELIGIBLE'
  | 'PLAN_UNAVAILABLE'
  | 'DELIVERY_FAILED'
  | 'INVALID_RECIPIENT'
  | 'DUPLICATE_TRANSACTION'
  | 'SERVICE_UNAVAILABLE'
  | 'PROVIDER_TIMEOUT'
  | 'UNKNOWN_ERROR'

export interface ResolvedProviderError {
  /** Safe, human-readable message to show the customer or API caller. */
  message: string
  /** Stable machine-readable code so API consumers can branch on it. */
  code: ProviderErrorCode
  /** Raw provider text, for logs and the admin transaction view only. */
  providerMessage: string | null
}

/**
 * Known provider phrases mapped to a stable code and a customer-safe message.
 * Order matters — the first matching pattern wins.
 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp
  code: ProviderErrorCode
  message: string
}> = [
  {
    pattern: /not eligible/i,
    code: 'NOT_ELIGIBLE',
    message:
      'This number is not eligible for the selected bundle. Please choose a different plan and try again.',
  },
  {
    pattern: /not available|unavailable|out of stock|sold out/i,
    code: 'PLAN_UNAVAILABLE',
    message:
      'This plan is temporarily out of stock. Please choose a different plan or try again later.',
  },
  {
    pattern: /delivery failed|failed to deliver|could not be delivered/i,
    code: 'DELIVERY_FAILED',
    message:
      'The provider could not deliver this bundle. Please try again in a few minutes.',
  },
  {
    pattern: /invalid (phone|number|recipient|msisdn)|wrong number|number.*invalid/i,
    code: 'INVALID_RECIPIENT',
    message:
      'The recipient number was rejected by the network. Please check the number and try again.',
  },
  {
    pattern: /duplicate|already (processed|exists)|same request/i,
    code: 'DUPLICATE_TRANSACTION',
    message:
      'This looks like a duplicate of a recent order. Please wait a moment and check your transaction history before retrying.',
  },
  {
    // NEVER surface this verbatim — it is the provider's float, not the
    // customer's wallet, and reads as if the customer is out of money.
    pattern: /insufficient|low balance|wallet.*empty/i,
    code: 'SERVICE_UNAVAILABLE',
    message:
      'This service is temporarily unavailable. Please try again shortly — you have not been charged.',
  },
  {
    pattern: /timeout|timed out|gateway|502|503|504/i,
    code: 'PROVIDER_TIMEOUT',
    message:
      'The provider did not respond in time. Please try again in a few minutes.',
  },
]

const GENERIC_MESSAGE =
  'This transaction could not be completed. Please try again in a few minutes.'

/**
 * Pulls the most descriptive text out of whichever shape the provider used.
 */
function extractRawMessage(response: unknown): string | null {
  if (!response || typeof response !== 'object') return null
  const r = response as Record<string, unknown>
  const content = (r.content && typeof r.content === 'object' ? r.content : {}) as Record<string, unknown>

  const candidates = [
    r.api_response,
    r.message,
    r.description,
    content.api_response,
    content.message,
    content.description,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }
  return null
}

/**
 * True when the text reads like a sentence written for a human, rather than an
 * internal enum such as "TRANSACTION_FAILED" or "INSUFFICIENT_BALANCE".
 */
function isHumanReadable(text: string): boolean {
  if (/^[A-Z0-9_\-.]+$/.test(text)) return false // pure enum / code
  return /\s/.test(text) && /[a-z]/.test(text) // has spaces and lowercase
}

/**
 * Tidies provider copy: drops the "Dear customer," salutation, collapses
 * whitespace, capitalises the first letter and ensures terminal punctuation.
 */
function polish(text: string): string {
  let out = text
    .replace(/^\s*dear\s+(valued\s+)?customer[,\s]*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!out) return GENERIC_MESSAGE
  out = out.charAt(0).toUpperCase() + out.slice(1)
  if (!/[.!?]$/.test(out)) out += '.'
  return out
}

/**
 * Resolve a provider payload into a safe message plus a stable error code.
 *
 * @param response  The raw parsed JSON returned by Gsubz.
 * @param opts.refunded  When true, appends a reassurance that the wallet was
 *   refunded (v1 API deducts up-front, so failures are refunded). Omit for the
 *   dashboard flow, which only deducts after a confirmed success.
 */
export function resolveProviderError(
  response: unknown,
  opts: { refunded?: boolean } = {}
): ResolvedProviderError {
  const raw = extractRawMessage(response)

  let code: ProviderErrorCode = 'UNKNOWN_ERROR'
  let message = GENERIC_MESSAGE

  if (raw) {
    const matched = ERROR_PATTERNS.find((p) => p.pattern.test(raw))
    if (matched) {
      code = matched.code
      message = matched.message
    } else if (isHumanReadable(raw)) {
      // Unrecognised but clearly written for a customer — pass it through so
      // new provider messages stay useful instead of being flattened.
      message = polish(raw)
    }
  }

  if (opts.refunded && !/not been charged|refund/i.test(message)) {
    message += ' Your wallet has been refunded.'
  }

  return { message, code, providerMessage: raw }
}
