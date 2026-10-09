/**
 * API (Connect Key) pricing resolution.
 *
 * API users are charged from the dedicated `api_pricing_rules` table, never the
 * dashboard `pricing_rules`. Plan-based services (data, cable, exam pins, eSIM,
 * social) store one row per plan; per-transaction services (bulk SMS, recharge
 * pins) store an enable flag plus a markup in `api_service_settings`.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export type ApiMarkupType = 'fixed' | 'percentage'

export interface ApiMarkup {
  type: ApiMarkupType
  value: number
}

/**
 * Settings keys for per-transaction API services. Electricity keeps its
 * historical key so existing rows and the electricity route stay untouched.
 */
export const API_SERVICE_KEYS = {
  electricity: 'api_electricity_enabled',
  bulkSms: 'bulk-sms',
  rechargePins: 'recharge-pins',
} as const

/** Applies an API markup to a base price, rounded to kobo. */
export function applyApiMarkup(base: number, markup: ApiMarkup): number {
  const result = markup.type === 'fixed' ? base + markup.value : base * (1 + markup.value / 100)
  return Math.round(result * 100) / 100
}

function toMarkup(type: unknown, value: unknown): ApiMarkup {
  return {
    type: type === 'percentage' ? 'percentage' : 'fixed',
    value: Number(value ?? 0) || 0,
  }
}

/**
 * Final API price for a plan, or null when the plan has no active API rule
 * (i.e. it is not enabled for API users).
 */
export async function resolveApiPlanPrice(
  serviceId: string,
  planName: string
): Promise<number | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('api_pricing_rules')
    .select('base_price, markup_type, markup_value')
    .eq('service_id', serviceId)
    .eq('plan_name', planName)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)

  const rule = data?.[0]
  if (!rule) return null
  return applyApiMarkup(Number(rule.base_price), toMarkup(rule.markup_type, rule.markup_value))
}

/**
 * Enable flag and markup for a per-transaction API service. Defaults to enabled
 * with no markup so a service keeps working until an admin turns it off.
 */
export async function resolveApiServiceSettings(
  serviceId: string
): Promise<{ enabled: boolean; markup: ApiMarkup }> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('api_service_settings')
    .select('enabled, markup_type, markup_value')
    .eq('service_id', serviceId)
    .maybeSingle()

  return {
    enabled: data?.enabled ?? true,
    markup: toMarkup(data?.markup_type, data?.markup_value),
  }
}
