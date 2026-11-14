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
