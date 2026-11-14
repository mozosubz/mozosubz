/**
 * Bachs corridor fee math — shared by the credit path and the admin reconcile
 * endpoint. Plain module (no "use server"): it exports pure functions.
 */

export interface BachsCorridorFee {
  /** Bachs' fee in the CHARGE currency (USD 4.61 for a USD-card payment). */
  feeOriginal: string | null
  feeCurrency: string | null
  /** Bachs' fee converted to naira at the charge's own implied FX rate. */
  feeNaira: number | null
  /** The FX rate implied by the charge itself (settlement / charge amount). */
  impliedFxRate: number | null
  /**
   * The part of Bachs' fee the platform's deposit fee does NOT already cover —
   * this is what gets deducted from the user's wallet credit. Bank transfers
   * are covered by the deposit rule (₦50 + 1.61% ≥ Bachs 1.5%), so their
   * excess is 0 and the user pays exactly what the deposit page promised.
   */
  excessNaira: number | null
}

/**
 * Convert Bachs' fee for a payment into naira and split it into the covered
 * and uncovered parts.
 *
 * Conversion uses the FX implied by the charge itself — settlement_amount /
 * charge amount — which is the exact rate Bachs applied to THAT payment
 * (e.g. a ₦100,000 checkout re-priced to $70.30 implies ₦1,422.48/$, so the
 * $4.61 card fee is ₦6,557.61 in platform terms). When the charge currency is
 * already NGN no conversion happens.
 *
 * ourFeeNaira is the deposit fee the user was already charged (deposit_rules).
 * Anything Bachs takes beyond that is the platform's exposure, and the owner's
 * policy is to pass that excess to the user's wallet credit.
 */
export function computeCorridorFee(
  lookup: {
    feeAmount?: string | null
    currency?: string | null
    amount?: string | null
    settlementAmount?: string | null
  },
  ourFeeNaira: number
): BachsCorridorFee {
  const feeOriginal = lookup.feeAmount ?? null
  const feeCurrency = lookup.currency ?? null
  const impliedFxRate =
    lookup.settlementAmount != null &&
    lookup.amount != null &&
    Number(lookup.settlementAmount) > 0 &&
    Number(lookup.amount) > 0 &&
    feeCurrency != null &&
    feeCurrency !== 'NGN'
      ? Number(lookup.settlementAmount) / Number(lookup.amount)
      : null

  let feeNaira: number | null = null
  if (feeOriginal != null) {
    const fee = Number(feeOriginal)
    if (Number.isFinite(fee)) {
      if (feeCurrency == null || feeCurrency === 'NGN') {
        feeNaira = fee
      } else if (impliedFxRate != null) {
        feeNaira = fee * impliedFxRate
      }
    }
  }

  const excessNaira =
    feeNaira != null ? Math.max(0, Math.round((feeNaira - ourFeeNaira) * 100) / 100) : null

  return {
    feeOriginal,
    feeCurrency,
    feeNaira: feeNaira != null ? Math.round(feeNaira * 100) / 100 : null,
    impliedFxRate,
    excessNaira,
  }
}

/**
 * Fetch the Bachs payment for a deposit row and persist what Bachs charged
 * for it — fee (amount + currency + USD equivalent), the payment corridor the
 * customer used, and what Bachs collected.
 *
 * Why: our deposit fee (deposit_rules) is a flat naira percentage that knows
 * nothing about the corridor. Bachs charges 2% for local NGN cards, 5% + $0.40
 * for US cards, base + 1.5% for international cards, 1.5% for crypto — and a
 * customer can pay an NGN-priced checkout with any of them. Recording the
 * provider fee per charge makes admin revenue (processing_fee − bachs_fee)
 * real instead of assumed.
 *
 * Fee fields on the payment object are null until the charge settles, so this
 * is safe to call repeatedly (webhook credit, verify poll, admin reconcile):
 * each call overwrites the columns with whatever Bachs currently reports.
 */

/**
 * Async wrapper: same math as computeCorridorFee, but when the charge does
 * not reveal its own FX (no settlement_amount vs charge amount), the fee is
 * converted with the REAL-TIME naira rate from lib/api/fx-rate.ts instead of
 * skipping the deduction.
 */
export async function resolveCorridorFee(
  lookup: {
    feeAmount?: string | null
    currency?: string | null
    amount?: string | null
    settlementAmount?: string | null
  },
  ourFeeNaira: number
): Promise<BachsCorridorFee & { rateSource: string }> {
  const base = computeCorridorFee(lookup, ourFeeNaira)

  // Implied FX already produced a naira figure — that is Bachs' own applied
  // rate and the most accurate possible source.
  if (base.feeNaira != null) {
    return { ...base, rateSource: base.impliedFxRate != null ? "charge-implied" : "charge-currency-ngn" }
  }

  // No implied rate: convert with the live naira rate.
  if (base.feeOriginal == null || base.feeCurrency == null || base.feeCurrency === "NGN") {
    return { ...base, rateSource: "unavailable" }
  }

  const { getNairaRate } = await import("@/lib/api/fx-rate")
  const { rate, source } = await getNairaRate(base.feeCurrency)
  if (rate == null) {
    return { ...base, rateSource: "unavailable" }
  }

  const fee = Number(base.feeOriginal)
  const feeNaira = Math.round(fee * rate * 100) / 100
  const excessNaira = Math.max(0, Math.round((feeNaira - ourFeeNaira) * 100) / 100)
  return {
    ...base,
    feeNaira,
    impliedFxRate: rate,
    excessNaira,
    rateSource: `live:${source}`,
  }
}
