'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { DepositRules } from '@/lib/utils/deposit-fee'

export interface RevenueData {
  today: number
  thisWeek: number
  thisMonth: number
  allTime: number
  depositFeeRevenue: number
  markupRevenue: number
  /** Charged-to-customers minus what the provider charged us, across every
   *  purchase with a recorded provider_cost. The number that cannot drift. */
  trueMargin: number
  chargedTotal: number
  providerCostTotal: number
  /** Portion of chargedTotal that has a recorded provider cost. */
  marginCovered: number
  todayGrowth: number
  weekGrowth: number
  monthGrowth: number
}

export interface RevenueActivity {
  id: string
  type: 'deposit_fee' | 'markup'
  amount: number
  user_id: string
  description: string
  date: string
  transactionId?: string
}

/**
 * Calculate revenue from all sources
 * - Deposit fees: Fixed fee per successful deposit
 * - Markup earnings: (selling_price - base_price) from plan purchases
 */
/**
 * Pricing rules are stored per NETWORK ('mtn'), while transactions store the
 * plan TYPE ('mtn_sme') or 'network-airtime' ('glo-airtime'). The headline
 * markup figure used to compare them for exact equality — 'mtn' never equals
 * 'mtn_sme', so markupRevenue summed to zero no matter how many sales carried
 * a markup. These helpers mirror the lookup the pricing engine performs at
 * purchase time (lib/pricing/markup.ts).
 */
function networkKeyOf(serviceId: unknown): string {
  return String(serviceId ?? '').toLowerCase().trim().split(/[_-]/)[0]
}

function normalisePlan(name: unknown): string {
  return String(name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

interface RuleLike {
  service_id: string | null
  plan_name: string | null
  markup_type: string | null
  markup_value: number | null
  base_price?: number | null
}

/** The rule that applied to a purchase, or undefined when none matched. */
function findRuleForPurchase(
  rules: RuleLike[] | null | undefined,
  serviceId: unknown,
  planDetails: unknown,
): RuleLike | undefined {
  const exact = String(serviceId ?? '').toLowerCase().trim()
  const network = networkKeyOf(serviceId)
  const plan = normalisePlan(planDetails)
  if (!plan || (!exact && !network)) return undefined
  return rules?.find(
    (rule) =>
      rule.service_id &&
      (rule.service_id.toLowerCase().trim() === exact || rule.service_id.toLowerCase().trim() === network) &&
      rule.plan_name &&
      normalisePlan(rule.plan_name) === plan,
  )
}

/** Markup in naira for one purchase under its rule. */
function markupForPurchase(purchaseAmount: number, rule: RuleLike | undefined): number {
  if (!rule) return 0
  const value = Number(rule.markup_value || 0)
  if (!(value > 0)) return 0
  if (rule.markup_type === 'fixed') return value
  // Percentage rules are percentages of the plan's base price (the price the
  // provider charged), falling back to the charged amount when the rule row
  // carries no base.
  const base = Number(rule.base_price || 0)
  const basis = base > 0 ? base : purchaseAmount
  return (basis * value) / 100
}

/**
 * 'use server' exports are HTTP-callable. Revenue figures are aggregate but
 * still internal — refuse callers that are not an admin (profiles.is_admin,
 * or the ADMIN_EMAILS fallback list).
 */
async function assertAdminAccess(): Promise<boolean> {
  try {
    const { createServerClient } = await import('@/lib/supabase/server')
    const { isFallbackAdmin } = await import('@/lib/utils/hardcoded-admin')
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false
    const { data: profile } = await createAdminClient()
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()
    return profile?.is_admin === true || isFallbackAdmin(user.email)
  } catch {
    return false
  }
}

export async function getRevenueData(dateRange: 'today' | '7days' | '30days' | 'all' = 'all'): Promise<RevenueData | null> {
  if (!(await assertAdminAccess())) {
    console.error('[v0] getRevenueData refused for non-admin caller')
    return null
  }

  const supabase = createAdminClient()

  try {
    const now = new Date()
    let startDate: Date

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(0)
    }

    // Fetch all deposit transactions (these generate deposit fees)
    const { data: deposits } = await supabase
      .from('transactions')
      .select('id, amount, status, created_at, payment_reference')
      .eq('category', 'WALLET_FUND')
      .eq('status', 'SUCCESS')
      .gte('created_at', startDate.toISOString())

    // Every purchase category earns margin (markup over provider cost).
    // FIX (2026-10-11): this used to be ['DATA','CABLE'] only, so airtime,
    // electricity, bulk SMS, social and exam-pin sales were invisible here.
    const PURCHASE_CATEGORIES = ['DATA', 'AIRTIME', 'CABLE', 'ELECTRICITY', 'BULK_SMS', 'SOCIAL', 'EXAM_PINS', 'ESIM', 'RECHARGE_PINS']
    const { data: purchases } = await supabase
      .from('transactions')
      .select('id, amount, provider_cost, status, created_at, category, service_id, plan_details')
      .in('category', PURCHASE_CATEGORIES)
      .eq('status', 'SUCCESS')
      .gte('created_at', startDate.toISOString())

    // Get current deposit rules for fee calculation
    const { data: depositRules } = await supabase
      .from('deposit_rules')
      .select('*')
      .eq('is_active', true)
      .single()

    const baseFee = depositRules?.base_fee || 50
    const percentageFee = depositRules?.percentage_fee || 1.5
    const thresholdAmount = depositRules?.threshold_amount || 2500

    // Deposit fee revenue from what was ACTUALLY charged, not a re-derivation
    // from today's rules (rules change; history must not). The fee really
    // charged lives on the monnify_transactions row: processing_fee, or
    // amount - net_amount when the provider reports it that way.
    const { data: feeRows } = await supabase
      .from('monnify_transactions')
      .select('payment_reference, amount, net_amount, processing_fee, status')
      .eq('status', 'SUCCESS')
      .gte('created_at', startDate.toISOString())

    const feeByRef = new Map<string, number>()
    ;(feeRows || []).forEach((row) => {
      const ref = (row as { payment_reference?: string }).payment_reference
      const processingFee = Number((row as { processing_fee?: number }).processing_fee || 0)
      const amount = Number((row as { amount?: number }).amount || 0)
      const net = Number((row as { net_amount?: number }).net_amount || 0)
      const fee = processingFee > 0 ? processingFee : Math.max(amount - net, 0)
      if (ref) feeByRef.set(ref, fee)
    })

    let depositFeeRevenue = 0
    deposits?.forEach((deposit) => {
      const ref = (deposit as { payment_reference?: string }).payment_reference
      const actual = ref ? feeByRef.get(ref) : undefined
      if (actual !== undefined) {
        depositFeeRevenue += actual
        return
      }
      // No provider row (admin credit etc.) — fall back to the rule of the day.
      let fee = baseFee
      if (deposit.amount >= thresholdAmount) {
        fee = baseFee + (deposit.amount * percentageFee) / 100
      }
      depositFeeRevenue += fee
    })

    // Markup revenue and TRUE MARGIN.
    // Markup = what the pricing rules say we add over base.
    // Margin = what we charged minus what the provider actually charged us —
    // recorded per transaction (provider_cost from the provider's amountPaid
    // or balance delta), so this number cannot drift from reality.
    let markupRevenue = 0
    let providerCostTotal = 0
    let chargedTotal = 0
    let marginCovered = 0
    if (purchases && purchases.length > 0) {
      const { data: pricingRules } = await supabase
        .from('pricing_rules')
        .select('service_id, plan_name, base_price, markup_type, markup_value')
        .eq('is_active', true)

      purchases.forEach((purchase) => {
        const amount = Number(purchase.amount || 0)
        chargedTotal += amount
        const providerCost =
          purchase.provider_cost === null || purchase.provider_cost === undefined
            ? null
            : Number(purchase.provider_cost)
        if (providerCost !== null && Number.isFinite(providerCost)) {
          providerCostTotal += providerCost
          marginCovered += amount
        }

        // Rules are keyed per network ('mtn'), transactions per plan type
        // ('mtn_sme') — match via the shared resolver, never exact equality.
        const rule = findRuleForPurchase(pricingRules, purchase.service_id, purchase.plan_details)
        const markup = markupForPurchase(amount, rule)
        if (markup > 0) markupRevenue += markup
      })
    }

    const trueMargin = chargedTotal - providerCostTotal

    const totalRevenue = depositFeeRevenue + markupRevenue

    // Calculate growth percentages (compare to previous period)
    const previousPeriodRevenue = await getPreviousPeriodRevenue(dateRange, depositRules)

    return {
      today: dateRange === 'today' ? totalRevenue : 0,
      thisWeek: dateRange === '7days' ? totalRevenue : 0,
      thisMonth: dateRange === '30days' ? totalRevenue : 0,
      allTime: dateRange === 'all' ? totalRevenue : 0,
      depositFeeRevenue,
      markupRevenue,
      trueMargin,
      chargedTotal,
      providerCostTotal,
      marginCovered,
      todayGrowth: ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100 || 0,
      weekGrowth: 0,
      monthGrowth: 0,
    }
  } catch (error) {
    console.error('[v0] Error calculating revenue:', error)
    return null
  }
}

/**
 * Get revenue activity for display in table
 */
export async function getRevenueActivity(limit: number = 50): Promise<RevenueActivity[] | null> {
  if (!(await assertAdminAccess())) {
    console.error('[v0] getRevenueActivity refused for non-admin caller')
    return null
  }

  const supabase = createAdminClient()

  try {
    const activity: RevenueActivity[] = []

    // Get recent deposits (deposit fee revenue)
    const { data: deposits } = await supabase
      .from('transactions')
      .select('id, user_id, amount, status, created_at')
      .eq('category', 'WALLET_FUND')
      .eq('status', 'SUCCESS')
      .order('created_at', { ascending: false })
      .limit(limit / 2)

    const { data: depositRules } = await supabase
      .from('deposit_rules')
      .select('*')
      .eq('is_active', true)
      .single()

    const baseFee = depositRules?.base_fee || 50
    const percentageFee = depositRules?.percentage_fee || 1.5
    const thresholdAmount = depositRules?.threshold_amount || 2500

    deposits?.forEach((deposit) => {
      let fee = baseFee
      if (deposit.amount >= thresholdAmount) {
        fee = baseFee + (deposit.amount * percentageFee) / 100
      }

      activity.push({
        id: `deposit-${deposit.id}`,
        type: 'deposit_fee',
        amount: fee,
        user_id: deposit.user_id,
        description: `Deposit fee on ₦${deposit.amount.toLocaleString()}`,
        date: new Date(deposit.created_at).toISOString(),
        transactionId: deposit.id,
      })
    })

    // Get recent service purchases that may have markups (DATA and CABLE only - no AIRTIME)
    const { data: purchases } = await supabase
      .from('transactions')
      .select('id, user_id, amount, category, status, created_at, service_id, plan_details')
      .in('category', ['DATA', 'CABLE'])
      .eq('status', 'SUCCESS')
      .order('created_at', { ascending: false })
      .limit(limit / 2)

    if (purchases && purchases.length > 0) {
      // Get ALL active pricing rules with plan names
      const { data: pricingRules } = await supabase
        .from('pricing_rules')
        .select('service_id, plan_name, markup_type, markup_value')
        .eq('is_active', true)

      purchases.forEach((purchase) => {
        // Same resolver the headline figure uses — one definition of "which
        // rule applied to this purchase".
        const pricingRule = findRuleForPurchase(pricingRules, purchase.service_id, purchase.plan_details)
        const markup = markupForPurchase(Number(purchase.amount || 0), pricingRule)

        if (pricingRule) {
          if (markup > 0) {
            activity.push({
              id: `markup-${purchase.id}`,
              type: 'markup',
              amount: markup,
              user_id: purchase.user_id,
              description: `${purchase.category} markup on ₦${purchase.amount.toLocaleString()}`,
              date: new Date(purchase.created_at).toISOString(),
              transactionId: purchase.id,
            })
          }
        }
      })
    }

    return activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit)
  } catch (error) {
    console.error('[v0] Error fetching revenue activity:', error)
    return null
  }
}

/**
 * Helper: Get previous period revenue for growth calculation
 */
async function getPreviousPeriodRevenue(dateRange: string, depositRules: DepositRules | null): Promise<number> {
  const supabase = createAdminClient()
  const now = new Date()
  let startDate: Date
  let endDate: Date

  switch (dateRange) {
    case 'today':
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000)
      break
    case '7days':
      endDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30days':
      endDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    default:
      return 0
  }

  const { data: deposits } = await supabase
    .from('transactions')
    .select('amount')
    .eq('category', 'WALLET_FUND')
    .eq('status', 'SUCCESS')
    .gte('created_at', startDate.toISOString())
    .lt('created_at', endDate.toISOString())

  const baseFee = depositRules?.base_fee || 50
  const percentageFee = depositRules?.percentage_fee || 1.5
  const thresholdAmount = depositRules?.threshold_amount || 2500

  let revenue = 0
  deposits?.forEach((deposit) => {
    let fee = baseFee
    if (deposit.amount >= thresholdAmount) {
      fee = baseFee + (deposit.amount * percentageFee) / 100
    }
    revenue += fee
  })

  return revenue
}
