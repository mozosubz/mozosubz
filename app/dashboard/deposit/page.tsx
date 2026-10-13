import { getDepositRules } from "@/lib/actions/deposit-rules"
import { DepositClient } from "@/components/deposit-client"

/**
 * Server-rendered deposit page.
 *
 * The active deposit_rules row is fetched on the server before any HTML is
 * sent, so the form is fully interactive on first paint — no "Loading…"
 * button, no skeleton on the "you will receive" line.
 *
 * Realtime + silent polling fallback for admin fee changes lives inside
 * <DepositClient />.
 *
 * Preconnects: the overlay SDK comes from checkout.bachs.io and the paid
 * checkout iframe loads from the checkout origin (sandbox-checkout.bachs.io
 * in sandbox, checkout.bachs.io live). Warming TLS/DNS here shaves the
 * connection setup off the first overlay open.
 */
export default async function DepositPage() {
  const initialRules = await getDepositRules()

  return (
    <>
      <link rel="preconnect" href="https://checkout.bachs.io" />
      <link rel="preconnect" href="https://sandbox-checkout.bachs.io" />
      <DepositClient initialRules={initialRules} />
    </>
  )
}
