import "server-only"
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Get user wallet balance from database
 */
export async function getUserWalletBalance(userId: string) {
  try {
    const admin = createAdminClient()
    const { data: profile, error } = await admin
      .from('profiles')
      .select('wallet_balance')
      .eq('id', userId)
      .single()

    if (error || !profile) {
      return {
        success: false,
        balance: 0,
        error: 'Failed to fetch wallet',
      }
    }

    return {
      success: true,
      balance: profile.wallet_balance || 0,
    }
  } catch (error) {
    console.error('[V1-WALLET] Error fetching balance')
    return {
      success: false,
      balance: 0,
      error: 'Internal error',
    }
  }
}

/**
 * Clean data plans for v1 response
 * Only return displayName and price
 */
export function cleanDataPlans(plans: any[]) {
  return plans.map(plan => ({
    name: plan.displayName,
    price: parseInt(plan.price),
  }))
}

/**
 * Clean cable plans for v1 response
 */
export function cleanCablePlans(plans: any[]) {
  return plans.map(plan => ({
    name: plan.displayName,
    price: parseInt(plan.price),
  }))
}
