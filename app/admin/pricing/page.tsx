'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { createPricingRule, deletePricingRule, updatePricingRule } from '@/lib/actions/pricing'
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react'
import { PricingBulkTab } from '@/components/admin/pricing-bulk-tab'
import { PricingTemplatesTab } from '@/components/admin/pricing-templates-tab'
import { useConfirm, useToast } from '@/components/app-dialog'

interface GsubzPlan {
  displayName: string
  value: string
  price: string
}

interface PricingRule {
  id: string
  service_id: string
  plan_name: string
  base_price: number
  markup_type: 'fixed' | 'percentage'
  markup_value: number
  is_active: boolean
}

interface EditingRule {
  id: string
  planName: string
  basePrice: number
  markupType: 'fixed' | 'percentage'
  markupValue: number
}

type CategoryId =
  | 'data'
  | 'cable'
  | 'exam'
  | 'esim'
  | 'sms'
  | 'social'

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'data', label: 'Data' },
  { id: 'cable', label: 'Cable' },
  { id: 'exam', label: 'Exam Pins' },
  { id: 'esim', label: 'eSIM' },
  { id: 'sms', label: 'Bulk SMS' },
  { id: 'social', label: 'Social' },
]

/**
 * service_id stored on pricing_rules for categories that are not keyed by a
 * network/provider sub-selection. Data and cable resolve theirs from the
 * selected network/provider instead.
 */
const CATEGORY_SERVICE_ID: Record<CategoryId, string> = {
  data: 'mtn',
  cable: 'dstv',
  exam: 'exam-pins',
  esim: 'esim',
  sms: 'bulk-sms',
  social: 'social',
}

/**
 * Categories whose "plans" are fixed rows rather than a live provider list.
 * Bulk SMS is priced per transaction, so its base price is 0 and only the
 * markup matters.
 */
const STATIC_PLANS: Partial<Record<CategoryId, GsubzPlan[]>> = {
  sms: [{ displayName: 'Bulk SMS', value: 'bulk-sms', price: '0' }],
}

const NETWORKS = [
  {
    name: 'MTN',
    types: [
      { value: 'mtn_sme', label: 'SME' },
      { value: 'mtn_datashare', label: 'Share' },
      { value: 'mtn_gifting', label: 'Gifting' },
      { value: 'mtn_awoof', label: 'AWOOF' },
      { value: 'mtn_awoof2', label: 'AWOOF 2' },
    ],
  },
  {
    name: 'Glo',
    types: [
      { value: 'glo_data', label: 'Data' },
      { value: 'glo_sme', label: 'SME' },
    ],
  },
  {
    name: 'Airtel',
    types: [
      { value: 'airtel_sme', label: 'SME' },
      { value: 'airtel_gifting', label: 'Gifting' },
    ],
  },
  {
    name: '9mobile',
    types: [{ value: 'etisalat_data', label: '9mobile Data' }],
  },
]

const CABLE_SERVICES = [
  { id: 'dstv', name: 'DSTV' },
  { id: 'gotv', name: 'GOTV' },
  { id: 'startimes', name: 'Startimes' },
]

export default function PricingPage() {
  const confirm = useConfirm()
  const toast = useToast()
  const [activeService, setActiveService] = useState<CategoryId>('data')
  const [activeNetwork, setActiveNetwork] = useState('MTN')
  const [activePlanType, setActivePlanType] = useState('mtn_sme')
  const [activeCableService, setActiveCableService] = useState('dstv')
  const [esimCountries, setEsimCountries] = useState<{ code: string; name: string }[]>([])
  const [activeEsimCountry, setActiveEsimCountry] = useState('')

  const [gsubzPlans, setGsubzPlans] = useState<GsubzPlan[]>([])
  const [rules, setRules] = useState<PricingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingGsubz, setLoadingGsubz] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingRule, setEditingRule] = useState<EditingRule | null>(null)
  const [formData, setFormData] = useState({
    planName: '',
    basePrice: '',
    markupType: 'fixed' as 'fixed' | 'percentage',
    markupValue: '',
  })
  const [activeTab, setActiveTab] = useState<'individual' | 'bulk' | 'templates'>('individual')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const currentNetwork = NETWORKS.find((n) => n.name === activeNetwork)
  const currentCableService = CABLE_SERVICES.find((s) => s.id === activeCableService)

  const getPricingServiceId = useCallback((planTypeOrService: string) => {
    const serviceMap: Record<string, string> = {
      mtn_sme: 'mtn',
      mtn_datashare: 'mtn',
      mtn_gifting: 'mtn',
      mtn_awoof: 'mtn',
      mtn_awoof2: 'mtn',
      glo_data: 'glo',
      glo_sme: 'glo',
      airtel_sme: 'airtel',
      airtel_gifting: 'airtel',
      etisalat_data: 'etisalat',
      dstv: 'dstv',
      gotv: 'gotv',
      startimes: 'startimes',
    }
    return serviceMap[planTypeOrService] || planTypeOrService
  }, [])

  const resolveServiceId = useCallback(
    (category: CategoryId) => {
      if (category === 'data') return getPricingServiceId(activePlanType)
      if (category === 'cable') return getPricingServiceId(activeCableService)
      return CATEGORY_SERVICE_ID[category]
    },
    [activePlanType, activeCableService, getPricingServiceId]
  )

  const fetchPlans = useCallback(async () => {
    const staticPlans = STATIC_PLANS[activeService]
    if (staticPlans) {
      setGsubzPlans(staticPlans)
      return
    }

    setLoadingGsubz(true)
    try {
      let url = ''
      if (activeService === 'data') {
        url = `/api/provider/plans?service=${activePlanType}&type=DATA`
      } else if (activeService === 'cable') {
        url = `/api/provider/plans?service=${activeCableService}&type=CABLE`
      } else if (activeService === 'esim') {
        if (!activeEsimCountry) {
          setGsubzPlans([])
          return
        }
        url = `/api/admin/pricing-plans?category=esim&country=${encodeURIComponent(activeEsimCountry)}`
      } else {
        url = `/api/admin/pricing-plans?category=${activeService}`
      }

      const response = await fetch(url)
      const data = await response.json()
      setGsubzPlans(data.plans || [])
    } catch (error) {
      console.error('[v0] Error fetching plans:', error)
      setGsubzPlans([])
    } finally {
      setLoadingGsubz(false)
    }
  }, [activeService, activePlanType, activeCableService, activeEsimCountry])

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const serviceId = resolveServiceId(activeService)
      const { data } = await supabase
        .from('pricing_rules')
        .select('*')
        .eq('service_id', serviceId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      setRules(data || [])
    } catch (error) {
      console.error('Error fetching rules:', error)
    } finally {
      setLoading(false)
    }
  }, [activeService, resolveServiceId, supabase])

  useEffect(() => {
    fetchPlans()
    fetchRules()
  }, [fetchPlans, fetchRules])

  useEffect(() => {
    if (currentNetwork && currentNetwork.types.length > 0) {
      setActivePlanType(currentNetwork.types[0].value)
    }
  }, [activeNetwork, currentNetwork])

  // eSIM packages are nested under a country, so load the country list once
  // the eSIM tab is opened and default to the first one.
  useEffect(() => {
    if (activeService !== 'esim' || esimCountries.length > 0) return
    let cancelled = false
    fetch('/api/admin/pricing-plans?category=esim-countries')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        const list: { code: string; name: string }[] = d.countries || []
        setEsimCountries(list)
        if (list[0]) setActiveEsimCountry(list[0].code)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [activeService, esimCountries.length])

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.planName || formData.basePrice === '' || formData.markupValue === '') {
      toast('Please fill in all fields', 'error')
      return
    }

    setSubmitting(true)
    const serviceId = resolveServiceId(activeService)

    const result = await createPricingRule(
      serviceId,
      formData.planName,
      parseFloat(formData.basePrice),
      formData.markupType,
      parseFloat(formData.markupValue)
    )

    if (result.success) {
      setFormData({ planName: '', basePrice: '', markupType: 'fixed', markupValue: '' })
      fetchRules()
      toast('Pricing rule created', 'success')
    } else {
      toast(result.error || 'Could not create rule', 'error')
    }
    setSubmitting(false)
  }

  const handleUpdateRule = async () => {
    if (!editingRule) return
    setSubmitting(true)
    const result = await updatePricingRule(editingRule.id, {
      basePrice: editingRule.basePrice,
      markupType: editingRule.markupType,
      markupValue: editingRule.markupValue,
    })
    if (result.success) {
      setEditingRule(null)
      fetchRules()
      toast('Rule updated', 'success')
    } else {
      toast(result.error || 'Could not update rule', 'error')
    }
    setSubmitting(false)
  }

  const handleDeleteRule = async (ruleId: string) => {
    const ok = await confirm({
      title: 'Delete this pricing rule?',
      message: 'This plan will fall back to default pricing for customers.',
      confirmLabel: 'Delete rule',
      tone: 'danger',
    })
    if (!ok) return

    const result = await deletePricingRule(ruleId)
    if (result.success) {
      fetchRules()
      toast('Pricing rule deleted', 'success')
    } else {
      toast(result.error || 'Could not delete rule', 'error')
    }
  }

  const calculateFinalPrice = (rule: PricingRule) => {
    return rule.markup_type === 'fixed'
      ? rule.base_price + rule.markup_value
      : rule.base_price * (1 + rule.markup_value / 100)
  }

  const handleSelectGsubzPlan = (plan: GsubzPlan) => {
    setFormData({
      planName: plan.displayName,
      basePrice: plan.price,
      markupType: 'fixed',
      markupValue: '0',
    })
  }

  const getServiceLabel = () => {
    if (activeService === 'data') {
      const planTypeLabel = currentNetwork?.types.find((t) => t.value === activePlanType)?.label || ''
      return `${activeNetwork} ${planTypeLabel}`
    }
    if (activeService === 'cable') return currentCableService?.name || ''
    if (activeService === 'esim') {
      const country = esimCountries.find((c) => c.code === activeEsimCountry)
      return country ? `eSIM · ${country.name}` : 'eSIM'
    }
    return CATEGORIES.find((c) => c.id === activeService)?.label || ''
  }

  const handleApplyTemplate = (markupType: 'fixed' | 'percentage', markupValue: number) => {
    setFormData((prev) => ({ ...prev, markupType, markupValue: String(markupValue) }))
    setActiveTab('individual')
  }

  const serviceId = resolveServiceId(activeService)

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-row">
          <div>
            <h1>Pricing Management</h1>
            <p>Manage markup rules for every service. Plans are fetched live from the provider.</p>
          </div>
        </div>
      </div>

      {/* Category selector */}
      <div className="admin-tabs">
        {CATEGORIES.map((category) => (
          <button
            type="button"
            key={category.id}
            className={`admin-tab ${activeService === category.id ? 'active' : ''}`}
            onClick={() => setActiveService(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Network or cable service selector */}
      {activeService === 'data' && (
        <>
          <div className="filter-chips">
            {NETWORKS.map((network) => (
              <button
                type="button"
                key={network.name}
                className={`filter-chip ${activeNetwork === network.name ? 'active' : ''}`}
                onClick={() => setActiveNetwork(network.name)}
              >
                {network.name}
              </button>
            ))}
          </div>

          {currentNetwork && currentNetwork.types.length > 1 && (
            <div className="filter-chips">
              {currentNetwork.types.map((type) => (
                <button
                  type="button"
                  key={type.value}
                  className={`filter-chip ${activePlanType === type.value ? 'active' : ''}`}
                  onClick={() => setActivePlanType(type.value)}
                >
                  {type.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {activeService === 'cable' && (
        <div className="filter-chips">
          {CABLE_SERVICES.map((service) => (
            <button
              type="button"
              key={service.id}
              className={`filter-chip ${activeCableService === service.id ? 'active' : ''}`}
              onClick={() => setActiveCableService(service.id)}
            >
              {service.name}
            </button>
          ))}
        </div>
      )}

      {activeService === 'esim' && (
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="esim-country" className="sr-only">
            eSIM country
          </label>
          <select
            id="esim-country"
            className="admin-select"
            value={activeEsimCountry}
            onChange={(e) => setActiveEsimCountry(e.target.value)}
            style={{ maxWidth: 320 }}
          >
            {esimCountries.length === 0 && <option value="">Loading countries…</option>}
            {esimCountries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Service label */}
      <div
        style={{
          background: 'var(--admin-bg-secondary)',
          border: '1px solid var(--admin-border)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--admin-text-secondary)' }}>
          Editing: <strong style={{ color: 'var(--admin-text)' }}>{getServiceLabel()}</strong>
        </span>
        <span style={{ fontSize: 12, color: 'var(--admin-text-tertiary)' }}>
          {rules.length} rule{rules.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Action tabs */}
      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${activeTab === 'individual' ? 'active' : ''}`}
          onClick={() => setActiveTab('individual')}
        >
          Individual
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'bulk' ? 'active' : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          Bulk
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          Templates
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'individual' && (
        <>
          {/* Available Plans (collapsed/drawer style on mobile) */}
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3>Available Plans</h3>
                <p className="admin-card-subtitle">Tap to auto-fill the form</p>
              </div>
            </div>

            {loadingGsubz ? (
              <div className="loading-container" style={{ padding: 30 }}>
                <div className="loading-spinner" />
                <span>Loading plans...</span>
              </div>
            ) : gsubzPlans.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--admin-text-tertiary)', fontSize: 13, padding: 16 }}>
                No plans available for {getServiceLabel()}
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 8,
                  maxHeight: 280,
                  overflowY: 'auto',
                }}
              >
                {gsubzPlans.map((plan) => (
                  <button
                    type="button"
                    key={plan.value}
                    onClick={() => handleSelectGsubzPlan(plan)}
                    style={{
                      padding: 10,
                      background: 'var(--admin-bg-tertiary)',
                      border: '1px solid var(--admin-border)',
                      borderRadius: 'var(--radius-md)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'var(--admin-text)',
                      transition: 'all 150ms',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--admin-secondary)'
                      e.currentTarget.style.background = 'var(--admin-bg-elevated)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--admin-border)'
                      e.currentTarget.style.background = 'var(--admin-bg-tertiary)'
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>{plan.displayName}</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'var(--admin-success)', fontWeight: 600 }}>
                      {Number(plan.price) > 0 ? `₦${Number(plan.price).toLocaleString()}` : 'Variable amount'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add new rule form */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3>Add Markup Rule</h3>
            </div>
            <form onSubmit={handleAddRule}>
              <div className="form-row">
                <div className="form-group">
                  <label>Plan Name</label>
                  <input
                    type="text"
                    placeholder="e.g., 1GB Daily"
                    value={formData.planName}
                    onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label>Base Price (₦)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label>Markup Type</label>
                  <select
                    value={formData.markupType}
                    onChange={(e) => setFormData({ ...formData, markupType: e.target.value as 'fixed' | 'percentage' })}
                    disabled={submitting}
                  >
                    <option value="fixed">Fixed (₦)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Markup Value</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      value={formData.markupValue}
                      onChange={(e) => setFormData({ ...formData, markupValue: e.target.value })}
                      disabled={submitting}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const current = parseFloat(formData.markupValue) || 0
                        const step = formData.markupType === 'percentage' ? 1 : 50
                        setFormData({ ...formData, markupValue: String(current - step) })
                      }}
                      disabled={submitting}
                      style={{
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        border: '1px solid var(--admin-border)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--admin-bg)',
                        color: 'var(--admin-danger)',
                        cursor: 'pointer',
                      }}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const current = parseFloat(formData.markupValue) || 0
                        const step = formData.markupType === 'percentage' ? 1 : 50
                        setFormData({ ...formData, markupValue: String(current + step) })
                      }}
                      disabled={submitting}
                      style={{
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        border: '1px solid var(--admin-border)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--admin-success)',
                        color: 'white',
                        cursor: 'pointer',
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick presets for individual create */}
              <div style={{ marginTop: 14, marginBottom: 14 }}>
                <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 600, color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>
                  Quick presets
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {formData.markupType === 'percentage' ? (
                    <>
                      {[5, 10, 15, 20, 25, 30].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormData({ ...formData, markupValue: String(val) })}
                          style={{
                            padding: '6px 10px',
                            fontSize: 12,
                            fontWeight: 500,
                            border: '1px solid var(--admin-border)',
                            borderRadius: 'var(--radius-sm)',
                            background: formData.markupValue === String(val) ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                            color: formData.markupValue === String(val) ? 'var(--admin-secondary)' : 'var(--admin-text)',
                            cursor: 'pointer',
                          }}
                        >
                          +{val}%
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      {[50, 100, 200, 500, 1000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFormData({ ...formData, markupValue: String(val) })}
                          style={{
                            padding: '6px 10px',
                            fontSize: 12,
                            fontWeight: 500,
                            border: '1px solid var(--admin-border)',
                            borderRadius: 'var(--radius-sm)',
                            background: formData.markupValue === String(val) ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                            color: formData.markupValue === String(val) ? 'var(--admin-secondary)' : 'var(--admin-text)',
                            cursor: 'pointer',
                          }}
                        >
                          +₦{val}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Live preview for individual */}
              {formData.markupValue && (
                <div
                  style={{
                    padding: 12,
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: 14,
                  }}
                >
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--admin-success)' }}>
                    Live Preview
                  </p>
                  {formData.planName && formData.basePrice !== '' && (
                    <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--admin-text-tertiary)' }}>Plan</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: 12, fontWeight: 600, color: 'var(--admin-text)' }}>
                          {formData.planName}
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--admin-text-tertiary)' }}>Final Price</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: 12, fontWeight: 600, color: 'var(--admin-success)' }}>
                          ₦{Math.round(
                            parseFloat(formData.basePrice) +
                              (formData.markupType === 'fixed'
                                ? parseFloat(formData.markupValue) || 0
                                : parseFloat(formData.basePrice) * ((parseFloat(formData.markupValue) || 0) / 100))
                          ).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" disabled={submitting} className="btn btn-block">
                {submitting ? (
                  <>
                    <div className="loading-spinner" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span>Add Rule</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Existing rules */}
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3>{getServiceLabel()} Rules</h3>
                <p className="admin-card-subtitle">{rules.length} active rules</p>
              </div>
            </div>

            {loading ? (
              <div className="loading-container" style={{ padding: 30 }}>
                <div className="loading-spinner" />
                <span>Loading rules...</span>
              </div>
            ) : rules.length === 0 ? (
              <div className="empty-state">
                <h3>No rules yet</h3>
                <p>Create one above to get started</p>
              </div>
            ) : (
              <div className="table-container">
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Plan</th>
                        <th>Base Price</th>
                        <th>Markup</th>
                        <th>Final Price</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((rule) => (
                        <tr key={rule.id}>
                          <td style={{ fontWeight: 600 }}>{rule.plan_name}</td>
                          <td className="text-mono">₦{rule.base_price.toLocaleString()}</td>
                          <td>
                            {!editingRule || editingRule.id !== rule.id ? (
                              <span style={{ color: 'var(--admin-text-secondary)' }}>
                                {rule.markup_type === 'fixed' ? '+₦' : '+'}
                                {rule.markup_value}
                                {rule.markup_type === 'percentage' ? '%' : ''}
                              </span>
                            ) : (
                              <input
                                type="number"
                                step="0.01"
                                value={editingRule.markupValue}
                                onChange={(e) =>
                                  setEditingRule({
                                    ...editingRule,
                                    markupValue: parseFloat(e.target.value) || 0,
                                  })
                                }
                                style={{
                                  width: 100,
                                  height: 32,
                                  padding: '0 8px',
                                  background: 'var(--admin-bg)',
                                  border: '1px solid var(--admin-secondary)',
                                  borderRadius: 'var(--radius-sm)',
                                  color: 'var(--admin-text)',
                                  fontSize: 13,
                                }}
                              />
                            )}
                          </td>
                          <td className="text-mono" style={{ fontWeight: 700, color: 'var(--admin-success)' }}>
                            ₦{calculateFinalPrice(rule).toLocaleString()}
                          </td>
                          <td>
                            <div className="action-buttons">
                              {!editingRule || editingRule.id !== rule.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingRule({
                                        id: rule.id,
                                        planName: rule.plan_name,
                                        basePrice: rule.base_price,
                                        markupType: rule.markup_type,
                                        markupValue: rule.markup_value,
                                      })
                                    }
                                    className="btn btn-ghost btn-icon"
                                    title="Edit"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRule(rule.id)}
                                    className="btn btn-ghost btn-icon"
                                    style={{ color: 'var(--admin-danger)' }}
                                    title="Delete"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={handleUpdateRule}
                                    disabled={submitting}
                                    className="btn btn-success btn-sm btn-icon"
                                    title="Save"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingRule(null)}
                                    disabled={submitting}
                                    className="btn btn-ghost btn-icon"
                                    title="Cancel"
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="data-list" style={{ padding: 12 }}>
                  {rules.map((rule) => {
                    const isEditing = editingRule && editingRule.id === rule.id
                    return (
                      <div key={rule.id} className="data-card">
                        <div className="data-card-header">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 className="data-card-title">{rule.plan_name}</h3>
                            <p className="data-card-subtitle">Base: ₦{rule.base_price.toLocaleString()}</p>
                          </div>
                          <span
                            className="data-card-amount"
                            style={{ color: 'var(--admin-success)', fontSize: 16 }}
                          >
                            ₦{calculateFinalPrice(rule).toLocaleString()}
                          </span>
                        </div>

                        <div className="data-card-grid">
                          <div className="data-card-field">
                            <span className="data-card-label">Markup</span>
                            {!isEditing ? (
                              <span className="data-card-value">
                                {rule.markup_type === 'fixed' ? '+₦' : '+'}
                                {rule.markup_value}
                                {rule.markup_type === 'percentage' ? '%' : ''}
                              </span>
                            ) : (
                              <input
                                type="number"
                                step="0.01"
                                value={editingRule.markupValue}
                                onChange={(e) =>
                                  setEditingRule({
                                    ...editingRule,
                                    markupValue: parseFloat(e.target.value) || 0,
                                  })
                                }
                                style={{
                                  height: 32,
                                  padding: '0 8px',
                                  background: 'var(--admin-bg)',
                                  border: '1px solid var(--admin-secondary)',
                                  borderRadius: 'var(--radius-sm)',
                                  color: 'var(--admin-text)',
                                  fontSize: 13,
                                  width: '100%',
                                }}
                              />
                            )}
                          </div>
                          <div className="data-card-field">
                            <span className="data-card-label">Type</span>
                            <span className="data-card-value">{rule.markup_type}</span>
                          </div>
                        </div>

                        <div className="data-card-actions">
                          {!isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingRule({
                                    id: rule.id,
                                    planName: rule.plan_name,
                                    basePrice: rule.base_price,
                                    markupType: rule.markup_type,
                                    markupValue: rule.markup_value,
                                  })
                                }
                                className="btn btn-secondary btn-sm"
                                style={{ flex: 1 }}
                              >
                                <Edit2 size={14} />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRule(rule.id)}
                                className="btn btn-danger btn-sm btn-icon"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={handleUpdateRule}
                                disabled={submitting}
                                className="btn btn-success btn-sm"
                                style={{ flex: 1 }}
                              >
                                <Save size={14} />
                                <span>Save</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingRule(null)}
                                disabled={submitting}
                                className="btn btn-secondary btn-sm btn-icon"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'bulk' && (
        <PricingBulkTab
          rules={rules}
          gsubzPlans={gsubzPlans}
          serviceId={serviceId}
          calculateFinalPrice={calculateFinalPrice}
          onSuccess={fetchRules}
        />
      )}

      {activeTab === 'templates' && <PricingTemplatesTab onApplyTemplate={handleApplyTemplate} />}
    </div>
  )
}
