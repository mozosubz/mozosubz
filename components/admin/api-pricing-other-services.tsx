'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { getApiPricingRules, saveApiPlanPricing } from '@/lib/actions/api-pricing'
import {
  getApiServiceSettings,
  setApiServiceEnabled,
  setApiServiceMarkup,
} from '@/lib/actions/api-service-settings'
import { useToast } from '@/components/app-dialog'
import { RefreshCw, Save } from 'lucide-react'

type MarkupType = 'fixed' | 'percentage'

interface ProviderPlan {
  displayName: string
  value: string
  price: string
}

interface PlanRow {
  planName: string
  basePrice: number
  markupType: MarkupType
  markupValue: number
}

interface ApiPricingRule {
  id: string
  service_id: string
  plan_name: string
  base_price: number
  markup_type: MarkupType
  markup_value: number
  is_active: boolean
}

const naira = (value: number) => `₦${Math.round(value).toLocaleString()}`

function finalPrice(row: PlanRow) {
  return row.markupType === 'fixed'
    ? row.basePrice + row.markupValue
    : row.basePrice * (1 + row.markupValue / 100)
}

async function fetchPlans(query: string): Promise<ProviderPlan[]> {
  try {
    const response = await fetch(`/api/provider/plans?${query}`)
    const data = await response.json()
    return Array.isArray(data.plans) ? data.plans : []
  } catch {
    return []
  }
}

// Exam pins are stored one service per board, so each plan maps to its own
// service_id in api_pricing_rules. Keys match the board labels returned by
// getExamPinPrices, which the v1 route also uses as the plan name.
const EXAM_SERVICE_IDS: Record<string, string> = {
  'WAEC Result Checker Pin': 'waec',
  'NECO Result Checker Pin': 'neco',
  'NABTEB Result Checker Pin': 'nabteb',
}
const examServiceId = (planName: string) => EXAM_SERVICE_IDS[planName] || 'waec'

/**
 * Plan-based API pricing (exam pins, eSIM, social). Each plan carries its own
 * markup and is upserted into api_pricing_rules for its service_id.
 */
function PlanPricingSection({
  title,
  description,
  serviceId,
  plans,
  loading,
  onReload,
  resolveServiceId,
  searchable = false,
  headerExtra,
}: {
  title: string
  description: string
  serviceId: string
  plans: ProviderPlan[]
  loading: boolean
  onReload: () => void
  resolveServiceId?: (planName: string) => string
  searchable?: boolean
  headerExtra?: ReactNode
}) {
  const toast = useToast()
  const [rows, setRows] = useState<PlanRow[]>([])
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    const serviceIds = Array.from(
      new Set(plans.map((plan) => (resolveServiceId ? resolveServiceId(plan.displayName) : serviceId)))
    )

    Promise.all(serviceIds.map((id) => getApiPricingRules(id))).then((results) => {
      if (cancelled) return
      const existing = new Map<string, ApiPricingRule>()
      for (const result of results) {
        for (const rule of result.rules || []) {
          existing.set(`${rule.service_id}::${rule.plan_name}`, rule)
        }
      }
      setRows(
        plans.map((plan) => {
          const id = resolveServiceId ? resolveServiceId(plan.displayName) : serviceId
          const rule = existing.get(`${id}::${plan.displayName}`)
          return {
            planName: plan.displayName,
            basePrice: parseFloat(plan.price) || 0,
            markupType: rule?.markup_type ?? 'fixed',
            markupValue: rule ? Number(rule.markup_value) : 0,
          }
        })
      )
    })

    return () => {
      cancelled = true
    }
  }, [serviceId, plans, resolveServiceId])

  const updateRow = (planName: string, patch: Partial<PlanRow>) => {
    setRows((prev) => prev.map((row) => (row.planName === planName ? { ...row, ...patch } : row)))
  }

  const handleSave = async () => {
    setSaving(true)
    const groups = new Map<string, PlanRow[]>()
    for (const row of rows) {
      const id = resolveServiceId ? resolveServiceId(row.planName) : serviceId
      const group = groups.get(id) || []
      group.push(row)
      groups.set(id, group)
    }

    let saved = 0
    for (const [id, groupRows] of groups) {
      const result = await saveApiPlanPricing(id, groupRows)
      if (!result.success) {
        setSaving(false)
        toast(result.error || 'Could not save API pricing', 'error')
        return
      }
      saved += result.saved || 0
    }

    setSaving(false)
    toast(`${title}: saved ${saved} plan${saved === 1 ? '' : 's'}`, 'success')
    onReload()
  }

  const visibleRows = search.trim()
    ? rows.filter((row) => row.planName.toLowerCase().includes(search.trim().toLowerCase()))
    : rows

  return (
    <div className="admin-card" style={{ marginBottom: 16 }}>
      <div
        className="admin-card-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}
      >
        <div>
          <h2 className="admin-card-title">{title}</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--admin-text-secondary)', fontSize: 12 }}>{description}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {headerExtra}
          <button type="button" className="btn btn-secondary btn-sm" onClick={onReload} disabled={loading}>
            <RefreshCw size={14} />
            <span>{loading ? 'Loading...' : 'Reload'}</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving || rows.length === 0}
          >
            <Save size={14} />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      <div className="admin-card-body">
        {searchable && rows.length > 0 && (
          <input
            className="form-input"
            placeholder="Search plans..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 12, maxWidth: 320 }}
          />
        )}

        {rows.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--admin-text-tertiary)' }}>
            {loading ? 'Loading plans...' : 'No plans available right now.'}
          </p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Provider price</th>
                  <th>Markup</th>
                  <th>API price</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.planName}>
                    <td>{row.planName}</td>
                    <td>{naira(row.basePrice)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select
                          className="form-input"
                          value={row.markupType}
                          onChange={(e) => updateRow(row.planName, { markupType: e.target.value as MarkupType })}
                          style={{ width: 130 }}
                        >
                          <option value="fixed">Fixed (₦)</option>
                          <option value="percentage">Percent (%)</option>
                        </select>
                        <input
                          className="form-input"
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.markupValue}
                          onChange={(e) =>
                            updateRow(row.planName, { markupValue: parseFloat(e.target.value) || 0 })
                          }
                          style={{ width: 100 }}
                        />
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{naira(finalPrice(row))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Per-transaction API services (bulk SMS, recharge pins). Access is a simple
 * enable flag, and an optional markup is applied to the computed base price.
 */
function ServiceAccessSection({
  title,
  description,
  serviceId,
  showMarkup,
}: {
  title: string
  description: string
  serviceId: string
  showMarkup: boolean
}) {
  const toast = useToast()
  const [enabled, setEnabled] = useState(true)
  const [markupType, setMarkupType] = useState<MarkupType>('fixed')
  const [markupValue, setMarkupValue] = useState('0')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await getApiServiceSettings(serviceId)
    if (result.success) {
      setEnabled(Boolean(result.enabled))
      setMarkupType(result.markupType ?? 'fixed')
      setMarkupValue(String(result.markupValue ?? 0))
    }
    setLoading(false)
  }, [serviceId])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    setSaving(true)
    const enabledResult = await setApiServiceEnabled(serviceId, enabled)
    if (!enabledResult.success) {
      setSaving(false)
      toast(enabledResult.error || 'Could not update access', 'error')
      return
    }
    if (showMarkup) {
      const markupResult = await setApiServiceMarkup(serviceId, markupType, parseFloat(markupValue) || 0)
      if (!markupResult.success) {
        setSaving(false)
        toast(markupResult.error || 'Could not update markup', 'error')
        return
      }
    }
    setSaving(false)
    toast(`${title} settings saved`, 'success')
  }

  return (
    <div className="admin-card" style={{ marginBottom: 16 }}>
      <div
        className="admin-card-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}
      >
        <div>
          <h2 className="admin-card-title">{title}</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--admin-text-secondary)', fontSize: 12 }}>{description}</p>
        </div>
        <button
          type="button"
          className={`btn ${enabled ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setEnabled((prev) => !prev)}
          disabled={loading}
        >
          {enabled ? 'Enabled · Disable' : 'Disabled · Enable'}
        </button>
      </div>

      <div className="admin-card-body">
        {showMarkup && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <label className="form-label">Markup type</label>
              <select
                className="form-input"
                value={markupType}
                onChange={(e) => setMarkupType(e.target.value as MarkupType)}
              >
                <option value="fixed">Fixed (₦)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>
            <div>
              <label className="form-label">Markup {markupType === 'fixed' ? '(₦)' : '(%)'}</label>
              <input
                className="form-input"
                type="number"
                min={0}
                step="0.01"
                value={markupValue}
                onChange={(e) => setMarkupValue(e.target.value)}
              />
            </div>
          </div>
        )}

        <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || loading}>
          <Save size={14} />
          <span>{saving ? 'Saving...' : 'Save settings'}</span>
        </button>
      </div>
    </div>
  )
}

export default function ApiPricingOtherServices() {
  const [examPlans, setExamPlans] = useState<ProviderPlan[]>([])
  const [socialPlans, setSocialPlans] = useState<ProviderPlan[]>([])
  const [esimCountries, setEsimCountries] = useState<{ name: string; value: string }[]>([])
  const [esimCountry, setEsimCountry] = useState('')
  const [esimPlans, setEsimPlans] = useState<ProviderPlan[]>([])
  const [loadingExam, setLoadingExam] = useState(false)
  const [loadingSocial, setLoadingSocial] = useState(false)
  const [loadingEsim, setLoadingEsim] = useState(false)

  const loadExam = useCallback(async () => {
    setLoadingExam(true)
    setExamPlans(await fetchPlans('service=exam&type=EXAM'))
    setLoadingExam(false)
  }, [])

  const loadSocial = useCallback(async () => {
    setLoadingSocial(true)
    setSocialPlans(await fetchPlans('service=social&type=SOCIAL'))
    setLoadingSocial(false)
  }, [])

  const loadEsimCountries = useCallback(async () => {
    try {
      const response = await fetch('/api/provider/plans?service=esim&type=ESIM_COUNTRIES')
      const data = await response.json()
      const countries = Array.isArray(data.countries) ? data.countries : []
      setEsimCountries(countries)
      if (countries.length > 0) setEsimCountry((prev) => prev || countries[0].value)
    } catch {
      setEsimCountries([])
    }
  }, [])

  const loadEsimPlans = useCallback(async (country: string) => {
    if (!country) {
      setEsimPlans([])
      return
    }
    setLoadingEsim(true)
    setEsimPlans(await fetchPlans(`service=esim&type=ESIM&country=${encodeURIComponent(country)}`))
    setLoadingEsim(false)
  }, [])

  useEffect(() => {
    loadExam()
    loadSocial()
    loadEsimCountries()
  }, [loadExam, loadSocial, loadEsimCountries])

  useEffect(() => {
    loadEsimPlans(esimCountry)
  }, [esimCountry, loadEsimPlans])

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--admin-text)' }}>
          Other API services
        </h2>
        <p style={{ margin: '4px 0 0', color: 'var(--admin-text-secondary)', fontSize: 13 }}>
          API prices for exam pins, eSIM, social media, bulk SMS and recharge pins. These are separate from your
          regular user prices and only apply to Connect Key holders.
        </p>
      </div>

      <PlanPricingSection
        title="Exam Pins"
        description="WAEC, NECO and NABTEB result-checker pins."
        serviceId="waec"
        plans={examPlans}
        loading={loadingExam}
        onReload={loadExam}
        resolveServiceId={examServiceId}
      />

      <PlanPricingSection
        title="eSIM"
        description="Pick a country, then set the API price for each package."
        serviceId="esim"
        plans={esimPlans}
        loading={loadingEsim}
        onReload={() => loadEsimPlans(esimCountry)}
        searchable
        headerExtra={
          <div>
            <label className="form-label">Country</label>
            <select
              className="form-input"
              value={esimCountry}
              onChange={(e) => setEsimCountry(e.target.value)}
              style={{ minWidth: 200 }}
            >
              {esimCountries.length === 0 && <option value="">No countries available</option>}
              {esimCountries.map((country) => (
                <option key={country.value} value={country.value}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <PlanPricingSection
        title="Social Media"
        description="API prices per unit for social media services."
        serviceId="social"
        plans={socialPlans}
        loading={loadingSocial}
        onReload={loadSocial}
        searchable
      />

      <ServiceAccessSection
        title="Bulk SMS"
        description="Enable or disable bulk SMS for API users. The markup is applied per page per recipient on top of the provider rate (₦5/page) and is completely separate from your regular user pricing."
        serviceId="bulk-sms"
        showMarkup
      />

      <ServiceAccessSection
        title="Recharge Pins"
        description="Enable or disable recharge pins for API users and set the markup applied to each pin."
        serviceId="recharge-pins"
        showMarkup
      />
    </section>
  )
}
