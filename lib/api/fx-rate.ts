import "server-only"

/**
 * Real-time naira exchange rates.
 *
 * Used by the corridor-fee pass-through: Bachs reports its fee in the CHARGE
 * currency (USD for a USD card, USDT for crypto, NGN for bank transfer). When
 * the charge itself does not reveal its applied FX (settlement_amount ÷ charge
 * amount), this service supplies the current naira rate so the fee can still
 * be converted before crediting.
 *
 * Sources (free, no API key):
 *  1. open.er-api.com  — fiat rates vs USD (USD/NGN/GHS/KES/...).
 *  2. cdn.jsdelivr.net @fawazahmed0/currency-api — every code incl. crypto
 *     (USDT/USDC), used as the fallback and for non-fiat codes.
 *
 * Fail-safe contract: never throws. On failure it returns rate: null and the
 * caller credits the promised amount instead of converting with a wrong rate.
 */

const MEMORY_TTL = 10 * 60 * 1000
const memory = new Map<string, { rate: number; source: string; at: number }>()

function normalizeCurrency(currency: string): string {
  // Corridor names ride along network/asset suffixes: USDT_BEP20, MOMO_KES…
  const code = currency.split("_")[0].trim().toLowerCase()
  return code
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new Error(`FX source ${url} returned ${response.status}`)
  return response.json()
}

/** NGN per 1 unit of `currency`, or null when both sources fail. */
export async function getNairaRate(
  currency: string
): Promise<{ rate: number | null; source: string }> {
  const code = normalizeCurrency(currency)
  if (!code) return { rate: null, source: "unavailable" }
  if (code === "ngn") return { rate: 1, source: "identity" }

  const cached = memory.get(code)
  if (cached && Date.now() - cached.at < MEMORY_TTL) {
    return { rate: cached.rate, source: cached.source }
  }

  // 1. Fiat: USD-based table gives NGN per USD and cur per USD in one call.
  try {
    const data = (await fetchJson("https://open.er-api.com/v6/latest/USD")) as {
      rates?: Record<string, number>
    }
    const rates = data.rates
    if (rates && typeof rates.NGN === "number" && rates.NGN > 0) {
      if (code === "usd") {
        memory.set(code, { rate: rates.NGN, source: "open.er-api.com", at: Date.now() })
        return { rate: rates.NGN, source: "open.er-api.com" }
      }
      const perUsd = rates[code]
      if (typeof perUsd === "number" && perUsd > 0) {
        const rate = rates.NGN / perUsd
        memory.set(code, { rate, source: "open.er-api.com", at: Date.now() })
        return { rate, source: "open.er-api.com" }
      }
    }
  } catch {
    // fall through to the secondary source
  }

  // 2. Fawazahmed0 currency API — covers crypto (usdt/usdc) and the rest.
  try {
    const data = (await fetchJson(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${code}.json`
    )) as Record<string, Record<string, number>>
    const table = data[code]
    const ngn = table?.ngn
    if (typeof ngn === "number" && ngn > 0) {
      memory.set(code, { rate: ngn, source: "currency-api", at: Date.now() })
      return { rate: ngn, source: "currency-api" }
    }
  } catch {
    // both sources unavailable
  }

  return { rate: null, source: "unavailable" }
}
