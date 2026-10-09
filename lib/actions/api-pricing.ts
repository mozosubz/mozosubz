'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface ApiPricingRule {
  id: string
  service_id: string
  plan_name: string
  base_price: number
  markup_type: 'fixed' | 'percentage'
  markup_value: number
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Verifies the caller is an authenticated admin.
 * Uses the admin client for the profile lookup so RLS can never hide the row.
 */
async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) return { ok: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return { ok: false, error: 'Admin access required' }
  return { ok: true }
}

/**
 * Reads pricing rules for a service using the admin client.
 * The page previously queried from the browser with the anon key, where RLS
 * silently returned zero rows, making existing rules look like they didn't exist.
 */
export async function getApiPricingRules(
  serviceId: string
): Promise<{ success: boolean; error?: string; rules?: ApiPricingRule[] }> {
  const guard = await requireAdmin()
  if (!guard.ok) return { success: false, error: guard.error }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_pricing_rules')
    .select('*')
    .eq('service_id', serviceId)
    .order('base_price', { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, rules: (data || []) as ApiPricingRule[] }
}

/**
 * Per-service counts so the admin can see coverage across every service
 * without clicking through each tab.
 */
export async function getApiPricingOverview(): Promise<{
  success: boolean
  error?: string
  counts?: Record<string, { total: number; active: number; duplicates: number }>
}> {
  const guard = await requireAdmin()
  if (!guard.ok) return { success: false, error: guard.error }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_pricing_rules')
    .select('service_id, plan_name, is_active')

  if (error) return { success: false, error: error.message }

  const counts: Record<string, { total: number; active: number; duplicates: number }> = {}
  const seen: Record<string, Set<string>> = {}

  for (const row of data || []) {
    const sid = row.service_id as string
    if (!counts[sid]) {
      counts[sid] = { total: 0, active: 0, duplicates: 0 }
      seen[sid] = new Set()
    }
    counts[sid].total += 1
    if (row.is_active) counts[sid].active += 1
    if (seen[sid].has(row.plan_name as string)) counts[sid].duplicates += 1
    else seen[sid].add(row.plan_name as string)
  }

  return { success: true, counts }
}

/**
 * Removes duplicate rules for a service, keeping the most recently updated row
 * for each plan name. The table has no unique constraint, so repeated bulk
 * creates in the past produced multiple conflicting prices per plan.
 */
export async function dedupeApiPricingRules(
  serviceId: string
): Promise<{ success: boolean; error?: string; removed?: number }> {
  const guard = await requireAdmin()
  if (!guard.ok) return { success: false, error: guard.error }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_pricing_rules')
    .select('id, plan_name, updated_at, created_at')
    .eq('service_id', serviceId)

  if (error) return { success: false, error: error.message }

  const newestByPlan = new Map<string, { id: string; stamp: number }>()
  const idsToRemove: string[] = []

  for (const row of data || []) {
    const stamp = new Date((row.updated_at || row.created_at) as string).getTime()
    const current = newestByPlan.get(row.plan_name as string)
    if (!current) {
      newestByPlan.set(row.plan_name as string, { id: row.id as string, stamp })
    } else if (stamp > current.stamp) {
      idsToRemove.push(current.id)
      newestByPlan.set(row.plan_name as string, { id: row.id as string, stamp })
    } else {
      idsToRemove.push(row.id as string)
    }
  }

  if (idsToRemove.length > 0) {
    const { error: delError } = await admin
      .from('api_pricing_rules')
      .delete()
      .in('id', idsToRemove)
    if (delError) return { success: false, error: delError.message }
  }

  revalidatePath('/admin/api-pricing')
  return { success: true, removed: idsToRemove.length }
}

/**
 * Deletes many rules at once.
 */
export async function bulkDeleteApiPricingRules(
  ruleIds: string[]
): Promise<{ success: boolean; error?: string; removed?: number }> {
  const guard = await requireAdmin()
  if (!guard.ok) return { success: false, error: guard.error }

  const admin = createAdminClient()
  const { error } = await admin.from('api_pricing_rules').delete().in('id', ruleIds)
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/api-pricing')
  return { success: true, removed: ruleIds.length }
}

export async function createApiPricingRule(
  serviceId: string,
  planName: string,
  basePrice: number,
  markupType: 'fixed' | 'percentage',
  markupValue: number
): Promise<{ success: boolean; error?: string; data?: ApiPricingRule }> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) return { success: false, error: 'Not authenticated' }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('api_pricing_rules')
      .insert([{
        service_id: serviceId,
        plan_name: planName,
        base_price: basePrice,
        markup_type: markupType,
        markup_value: markupValue,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/api-pricing')
    return { success: true, data }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function updateApiPricingRule(
  ruleId: string,
  updates: {
    basePrice?: number
    markupType?: 'fixed' | 'percentage'
    markupValue?: number
    isActive?: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) return { success: false, error: 'Not authenticated' }

    const admin = createAdminClient()
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (updates.basePrice !== undefined) updateData.base_price = updates.basePrice
    if (updates.markupType !== undefined) updateData.markup_type = updates.markupType
    if (updates.markupValue !== undefined) updateData.markup_value = updates.markupValue
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive

    const { error } = await admin
      .from('api_pricing_rules')
      .update(updateData)
      .eq('id', ruleId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/api-pricing')
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function deleteApiPricingRule(
  ruleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) return { success: false, error: 'Not authenticated' }

    const admin = createAdminClient()
    const { error } = await admin
      .from('api_pricing_rules')
      .delete()
      .eq('id', ruleId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/api-pricing')
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function bulkUpdateApiPricingRules(
  ruleIds: string[],
  markupType: 'fixed' | 'percentage',
  markupValue: number
): Promise<{ success: boolean; error?: string; updated?: number }> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) return { success: false, error: 'Not authenticated' }

    const admin = createAdminClient()
    const uniqueRuleIds = Array.from(new Set(ruleIds.filter(Boolean)))
    const { error } = await admin
      .from('api_pricing_rules')
      .update({
        markup_type: markupType,
        markup_value: markupValue,
        updated_at: new Date().toISOString(),
      })
      .in('id', uniqueRuleIds)

    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/api-pricing')
    return { success: true, updated: uniqueRuleIds.length }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

/**
 * Upserts per-plan API pricing where each plan carries its own markup. Used by
 * the "other services" section (exam pins, eSIM, social), where a single shared
 * markup would be wrong.
 */
export async function saveApiPlanPricing(
  serviceId: string,
  plans: Array<{
    planName: string
    basePrice: number
    markupType: 'fixed' | 'percentage'
    markupValue: number
  }>
): Promise<{ success: boolean; error?: string; saved?: number }> {
  try {
    const guard = await requireAdmin()
    if (!guard.ok) return { success: false, error: guard.error }

    const admin = createAdminClient()
    const now = new Date().toISOString()

    const uniquePlans = Array.from(
      new Map(
        plans
          .filter((plan) => plan.planName.trim())
          .map((plan) => [plan.planName.trim().toLowerCase(), { ...plan, planName: plan.planName.trim() }])
      ).values()
    )

    if (uniquePlans.length === 0) return { success: true, saved: 0 }

    const { error } = await admin.from('api_pricing_rules').upsert(
      uniquePlans.map((plan) => ({
        service_id: serviceId,
        plan_name: plan.planName,
        base_price: plan.basePrice,
        markup_type: plan.markupType,
        markup_value: plan.markupValue,
        is_active: true,
        created_at: now,
        updated_at: now,
      })),
      { onConflict: 'service_id,plan_name' }
    )

    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/api-pricing')
    return { success: true, saved: uniquePlans.length }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function bulkCreateApiPricingRules(
  serviceId: string,
  plans: Array<{ planName: string; basePrice: number }>,
  markupType: 'fixed' | 'percentage',
  markupValue: number
): Promise<{ success: boolean; error?: string; created?: number; updated?: number }> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) return { success: false, error: 'Not authenticated' }

    const admin = createAdminClient()
    const now = new Date().toISOString()

    // Count what already exists purely so we can report created vs updated
    const { data: existing, error: fetchError } = await admin
      .from('api_pricing_rules')
      .select('plan_name')
      .eq('service_id', serviceId)

    if (fetchError) return { success: false, error: fetchError.message }

    const uniquePlans = Array.from(
      new Map(plans.map((plan) => [plan.planName.trim().toLowerCase(), { ...plan, planName: plan.planName.trim() }])).values()
    )
    const existingNames = new Set((existing || []).map((row) => String(row.plan_name).trim().toLowerCase()))
    const updatedCount = uniquePlans.filter((p) => existingNames.has(p.planName.toLowerCase())).length

    const { error: upsertError } = await admin
      .from('api_pricing_rules')
      .upsert(
        uniquePlans.map((plan) => ({
          service_id: serviceId,
          plan_name: plan.planName,
          base_price: plan.basePrice,
          markup_type: markupType,
          markup_value: markupValue,
          is_active: true,
          created_at: now,
          updated_at: now,
        })),
        { onConflict: 'service_id,plan_name' }
      )

    if (upsertError) return { success: false, error: upsertError.message }

    revalidatePath('/admin/api-pricing')
    return {
      success: true,
      created: uniquePlans.length - updatedCount,
      updated: updatedCount,
    }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
