import "server-only"
/**
 * Shared markup resolution for every service.
 *
 * Data and cable used to each carry their own copy of this lookup. Centralising
 * it here means a new service only has to call `applyServiceMarkup`, and every
 * consumer is invalidated together by the "pricing-rules" cache tag that
 * lib/actions/pricing.ts revalidates on any admin edit.
 */

export interface MarkupRule {
  plan_name: string
  base_price: number
  markup_type: string
  markup_value: number
}

/** Cached active pricing rules for one service_id. */
export async function getCachedPricingRules(serviceId: string): Promise<MarkupRule[]> {
  const { unstable_cache } = await import("next/cache")
  const getCached = unstable_cache(
    async () => {
      const { createClient } = await import("@supabase/supabase-js")
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data } = await supabase
        .from("pricing_rules")
        .select("plan_name, base_price, markup_type, markup_value")
        .eq("service_id", serviceId)
        .eq("is_active", true)
      return (data || []) as MarkupRule[]
    },
    [`pricing-rules-${serviceId}`],
    { revalidate: 1800, tags: ["pricing-rules", `pricing-rules-${serviceId}`] }
  )
  return getCached()
}

/** Markup amount (naira) for a base price under a rule. */
export function computeMarkup(basePrice: number, rule?: MarkupRule | null): number {
  if (!rule) return 0
  return rule.markup_type === "fixed"
    ? Number(rule.markup_value)
    : (basePrice * Number(rule.markup_value)) / 100
}

/**
 * Final unit rate for a per-transaction service that has no plan catalogue
 * (bulk SMS). When an admin has saved a rule on the pricing page, its
 * base_price is the authoritative rate and the markup is computed on top of
 * it; otherwise the code fallback applies. A non-positive resolved rate falls
 * back too, so a mistyped 0 base price can never make the service free.
 */
export async function resolveUnitRate(
  serviceId: string,
  planName: string,
  fallback: number
): Promise<number> {
  try {
    const rules = await getCachedPricingRules(serviceId)
    const rule = rules.find((r) => r.plan_name.toLowerCase() === planName.toLowerCase())
    if (!rule) return fallback
    const rate = rule.base_price + computeMarkup(rule.base_price, rule)
    return rate > 0 ? rate : fallback
  } catch (error) {
    // A pricing lookup must never block a purchase — fall back to the base price.
    console.error('[v0] resolveUnitRate failed:', error)
    return fallback
  }
}

/**
 * Final customer price for a plan: the provider price plus any active markup
 * whose plan_name matches. Matching is case-insensitive so an admin typo in
 * casing never silently drops the markup.
 */
export async function applyServiceMarkup(
  serviceId: string,
  planName: string,
  basePrice: number
): Promise<number> {
  try {
    const rules = await getCachedPricingRules(serviceId)
    const rule = rules.find((r) => r.plan_name.toLowerCase() === planName.toLowerCase())
    return basePrice + computeMarkup(basePrice, rule)
  } catch (error) {
    // A pricing lookup must never block a purchase — fall back to the base price.
    console.error('[v0] applyServiceMarkup failed:', error)
    return basePrice
  }
}
