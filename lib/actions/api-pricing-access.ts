'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const SETTING_KEY = 'api_electricity_enabled'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  return Boolean(data?.is_admin)
}

export async function getApiElectricityAccess() {
  const admin = createAdminClient()
  const { data, error } = await admin.from('api_service_settings').select('enabled').eq('service_id', SETTING_KEY).maybeSingle()
  if (error) return { success: false, enabled: false, error: error.message }
  return { success: true, enabled: data?.enabled ?? false }
}

export async function setApiElectricityAccess(enabled: boolean) {
  if (!(await requireAdmin())) return { success: false, error: 'Admin access required' }
  const admin = createAdminClient()
  const { error } = await admin.from('api_service_settings').upsert({ service_id: SETTING_KEY, enabled, updated_at: new Date().toISOString() }, { onConflict: 'service_id' })
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/api-pricing')
  return { success: true, enabled }
}

export { SETTING_KEY }
