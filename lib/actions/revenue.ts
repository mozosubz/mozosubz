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
export async function getRevenueData(dateRange: 'today' | '7days' | '30days' | 'all' = 'all'): Promise<RevenueData | null> {
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
      .select('id, amount, status, created_at')
      .eq('category', 'WALLET_FUND')
      .eq('status', 'SUCCESS')
      .gte('created_at', startDate.toISOString())

    // Fetch all data/airtime/cable purchases (these generate markups)
    const { data: purchases } = await supabase
      .from('transactions')
      .select('id, amount, status, created_at, category, service_id, plan_details')
      .in('category', ['DATA', 'CABLE'])
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

    // Calculate deposit fee revenue
    let depositFeeRevenue = 0
    deposits?.forEach((deposit) => {
      let fee = baseFee
      if (deposit.amount >= thresholdAmount) {
        fee = baseFee + (deposit.amount * percentageFee) / 100
      }
      depositFeeRevenue += fee
    })

    // For markup revenue, only count purchases with active pricing rules that have markup
    let markupRevenue = 0
    if (purchases && purchases.length > 0) {
      // Get all active pricing rules with plan names
      const { data: pricingRules } = await supabase
        .from('pricing_rules')
        .select('service_id, plan_name, markup_type, markup_value')
        .eq('is_active', true)

      purchases.forEach((purchase) => {
        // Extract network prefix from service_id (e.g., "mtn" from "mtn_gifting")
        const networkPrefix = purchase.service_id?.split('_')[0].toLowerCase()
        
        // Find pricing rule matching network prefix AND plan name
        const pricingRule = pricingRules?.find(rule => 
          rule.service_id && 
          networkPrefix &&
          rule.service_id.toLowerCase() === networkPrefix &&
          rule.plan_name &&
          purchase.plan_details &&
          rule.plan_name.toLowerCase() === purchase.plan_details.toLowerCase() &&
          rule.markup_value > 0
        )
        
        if (pricingRule) {
          let markup = 0
          if (pricingRule.markup_type === 'fixed') {
            markup = pricingRule.markup_value
          } else if (pricingRule.markup_type === 'percentage') {
            markup = purchase.amount * (pricingRule.markup_value / 100)
          }
          markupRevenue += markup
        }
      })
    }

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
        // Extract network prefix from service_id (e.g., "mtn" from "mtn_gifting")
        const networkPrefix = purchase.service_id?.split('_')[0].toLowerCase()
        
        // Find pricing rule matching network prefix AND plan name
        const pricingRule = pricingRules?.find(rule => 
          rule.service_id && 
          networkPrefix &&
          rule.service_id.toLowerCase() === networkPrefix &&
          rule.plan_name &&
          purchase.plan_details &&
          rule.plan_name.toLowerCase() === purchase.plan_details.toLowerCase() &&
          rule.markup_value > 0
        )

        if (pricingRule) {
          let markup = 0
          if (pricingRule.markup_type === 'fixed') {
            markup = pricingRule.markup_value
          } else if (pricingRule.markup_type === 'percentage') {
            markup = purchase.amount * (pricingRule.markup_value / 100)
          }

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
