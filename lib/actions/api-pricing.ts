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
    const { error } = await admin
      .from('api_pricing_rules')
      .update({
        markup_type: markupType,
        markup_value: markupValue,
        updated_at: new Date().toISOString(),
      })
      .in('id', ruleIds)

    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/api-pricing')
    return { success: true, updated: ruleIds.length }
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

    // Look up what already exists for this service so we never create duplicates
    const { data: existing, error: fetchError } = await admin
      .from('api_pricing_rules')
      .select('id, plan_name')
      .eq('service_id', serviceId)

    if (fetchError) return { success: false, error: fetchError.message }

    const existingByName = new Map(
      (existing || []).map((row) => [row.plan_name, row.id as string])
    )

    const toInsert = plans.filter((p) => !existingByName.has(p.planName))
    const toUpdate = plans.filter((p) => existingByName.has(p.planName))

    if (toInsert.length > 0) {
      const { error: insertError } = await admin
        .from('api_pricing_rules')
        .insert(
          toInsert.map((plan) => ({
            service_id: serviceId,
            plan_name: plan.planName,
            base_price: plan.basePrice,
            markup_type: markupType,
            markup_value: markupValue,
            is_active: true,
            created_at: now,
            updated_at: now,
          }))
        )
      if (insertError) return { success: false, error: insertError.message }
    }

    // Refresh existing rules so base price stays in sync with the live provider price
    for (const plan of toUpdate) {
      const id = existingByName.get(plan.planName)!
      const { error: updateError } = await admin
        .from('api_pricing_rules')
        .update({
          base_price: plan.basePrice,
          markup_type: markupType,
          markup_value: markupValue,
          is_active: true,
          updated_at: now,
        })
        .eq('id', id)
      if (updateError) return { success: false, error: updateError.message }
    }

    revalidatePath('/admin/api-pricing')
    return { success: true, created: toInsert.length, updated: toUpdate.length }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
