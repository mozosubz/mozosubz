'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type ApiMarkupType = 'fixed' | 'percentage'

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  return Boolean(data?.is_admin)
}

/**
 * Enable flag and markup for a per-transaction API service (bulk SMS, recharge
 * pins). A missing row means the service is enabled with no markup.
 */
export async function getApiServiceSettings(serviceId: string): Promise<{
  success: boolean
  error?: string
  enabled?: boolean
  markupType?: ApiMarkupType
  markupValue?: number
}> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_service_settings')
    .select('enabled, markup_type, markup_value')
    .eq('service_id', serviceId)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  return {
    success: true,
    enabled: data?.enabled ?? true,
    markupType: (data?.markup_type as ApiMarkupType) ?? 'fixed',
    markupValue: Number(data?.markup_value ?? 0),
  }
}

export async function setApiServiceEnabled(
  serviceId: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string; enabled?: boolean }> {
  if (!(await requireAdmin())) return { success: false, error: 'Admin access required' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('api_service_settings')
    .upsert(
      { service_id: serviceId, enabled, updated_at: new Date().toISOString() },
      { onConflict: 'service_id' }
    )

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/api-pricing')
  return { success: true, enabled }
}

export async function setApiServiceMarkup(
  serviceId: string,
  markupType: ApiMarkupType,
  markupValue: number
): Promise<{ success: boolean; error?: string }> {
  if (!(await requireAdmin())) return { success: false, error: 'Admin access required' }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('api_service_settings')
    .select('service_id')
    .eq('service_id', serviceId)
    .maybeSingle()

  const payload: Record<string, unknown> = {
    service_id: serviceId,
    markup_type: markupType,
    markup_value: markupValue,
    updated_at: new Date().toISOString(),
  }
  // A brand-new row must not inherit the table's `enabled = false` default and
  // silently switch the service off just because a markup was saved.
  if (!existing) payload.enabled = true

  const { error } = await admin
    .from('api_service_settings')
    .upsert(payload, { onConflict: 'service_id' })

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/api-pricing')
  return { success: true }
}
