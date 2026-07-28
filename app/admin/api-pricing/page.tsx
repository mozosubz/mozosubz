'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getApiPricingRules,
  getApiPricingOverview,
  dedupeApiPricingRules,
  bulkDeleteApiPricingRules,
  createApiPricingRule,
  deleteApiPricingRule,
  updateApiPricingRule,
  bulkUpdateApiPricingRules,
  bulkCreateApiPricingRules,
} from '@/lib/actions/api-pricing'
import { useConfirm, useToast } from '@/components/app-dialog'
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Zap,
  AlertTriangle,
  Check,
  Search,
  RefreshCw,
  Copy,
  TrendingUp,
} from 'lucide-react'

interface GsubzPlan {
  displayName: string
  value: string
  price: string
}

interface ApiPricingRule {
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

const NETWORKS = [
  {
    name: 'MTN',
    types: [
      { value: 'mtn_sme', label: 'SME' },
      { value: 'mtn_datashare', label: 'Share' },
      { value: 'mtn_gifting', label: 'Gifting' },
      { value: 'mtn_awoof', label: 'AWOOF' },
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

// Store the full plan type as service_id so MTN SME, MTN Gifting etc.
// are kept separate in the DB and matched correctly in the v1 API route.
const SERVICE_MAP: Record<string, string> = {
  mtn_sme: 'mtn_sme',
  mtn_datashare: 'mtn_datashare',
  mtn_gifting: 'mtn_gifting',
  mtn_awoof: 'mtn_awoof',
  glo_data: 'glo_data',
  glo_sme: 'glo_sme',
  airtel_sme: 'airtel_sme',
  airtel_gifting: 'airtel_gifting',
  etisalat_data: 'etisalat_data',
}

export default function ApiPricingPage() {
  const confirm = useConfirm()
  const toast = useToast()
  const [activeNetwork, setActiveNetwork] = useState('MTN')
  const [activePlanType, setActivePlanType] = useState('mtn_sme')

  const [gsubzPlans, setGsubzPlans] = useState<GsubzPlan[]>([])
  const [rules, setRules] = useState<ApiPricingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingGsubz, setLoadingGsubz] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingRule, setEditingRule] = useState<EditingRule | null>(null)
  const [activeTab, setActiveTab] = useState<'individual' | 'bulk'>('individual')
  const [bulkMarkupType, setBulkMarkupType] = useState<'fixed' | 'percentage'>('fixed')
  const [bulkMarkupValue, setBulkMarkupValue] = useState('')
  const [bulkOperationType, setBulkOperationType] = useState<'set' | 'add' | 'subtract'>('set')
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([])
  const [selectedPlanValues, setSelectedPlanValues] = useState<string[]>([])
  const [planSearch, setPlanSearch] = useState('')
  const [hidePricedPlans, setHidePricedPlans] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [overview, setOverview] = useState<
    Record<string, { total: number; active: number; duplicates: number }>
  >({})
  const [ruleSearch, setRuleSearch] = useState('')
  const [dedupeBusy, setDedupeBusy] = useState(false)
  const [formData, setFormData] = useState({
    planName: '',
    basePrice: '',
    markupType: 'fixed' as 'fixed' | 'percentage',
    markupValue: '',
  })

  const currentNetwork = NETWORKS.find((n) => n.name === activeNetwork)
  const serviceId = SERVICE_MAP[activePlanType] || activePlanType

  const fetchGsubzPlans = useCallback(async (planType: string) => {
    setLoadingGsubz(true)
    try {
      const response = await fetch(`/api/gsubz/plans?service=${planType}&type=DATA`)
      const data = await response.json()
      setGsubzPlans(data.plans || [])
    } catch {
      setGsubzPlans([])
    } finally {
      setLoadingGsubz(false)
    }
  }, [])

  const fetchRules = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      // Read through a server action with the admin client. Reading directly from
      // the browser with the anon key hit RLS and silently returned zero rows.
      const result = await getApiPricingRules(serviceId)
      if (result.success) {
        setRules(result.rules || [])
      } else {
        setRules([])
        setLoadError(result.error || 'Failed to load pricing rules')
      }
    } catch (err) {
      setRules([])
      setLoadError(String(err))
    } finally {
      setLoading(false)
    }
  }, [serviceId])

  const fetchOverview = useCallback(async () => {
    const result = await getApiPricingOverview()
    if (result.success) setOverview(result.counts || {})
  }, [])

  useEffect(() => {
    fetchGsubzPlans(activePlanType)
    fetchRules()
    // Selections are per-service, so reset them when the service changes
    setSelectedPlanValues([])
    setSelectedRuleIds([])
    setEditingRule(null)
    setPlanSearch('')
    setRuleSearch('')
  }, [activePlanType, fetchGsubzPlans, fetchRules])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  const handleDedupe = async () => {
    const ok = await confirm({
      title: 'Remove duplicate rules?',
      message: 'The most recent price for each plan is kept; older duplicates are deleted.',
      confirmLabel: 'Remove duplicates',
      tone: 'danger',
    })
    if (!ok) return

    setDedupeBusy(true)
    const result = await dedupeApiPricingRules(serviceId)
    setDedupeBusy(false)
    if (result.success) {
      await Promise.all([fetchRules(), fetchOverview()])
      toast(`Removed ${result.removed} duplicate rule${result.removed === 1 ? '' : 's'}`, 'success')
    } else {
      toast(result.error || 'Could not remove duplicates', 'error')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedRuleIds.length === 0) return
    const count = selectedRuleIds.length
    const ok = await confirm({
      title: `Delete ${count} rule${count === 1 ? '' : 's'}?`,
      message: 'API users will lose access to these plans immediately.',
      confirmLabel: 'Delete rules',
      tone: 'danger',
    })
    if (!ok) return

    const result = await bulkDeleteApiPricingRules(selectedRuleIds)
    if (result.success) {
      setSelectedRuleIds([])
      await Promise.all([fetchRules(), fetchOverview()])
      toast(`Deleted ${count} rule${count === 1 ? '' : 's'}`, 'success')
    } else {
      toast(result.error || 'Could not delete rules', 'error')
    }
  }

  useEffect(() => {
    if (currentNetwork && currentNetwork.types.length > 0) {
      setActivePlanType(currentNetwork.types[0].value)
    }
  }, [activeNetwork, currentNetwork])

  const calculateFinalPrice = (rule: ApiPricingRule) =>
    rule.markup_type === 'fixed'
      ? rule.base_price + rule.markup_value
      : rule.base_price * (1 + rule.markup_value / 100)

  const handleSelectGsubzPlan = (plan: GsubzPlan) => {
    setFormData({ planName: plan.displayName, basePrice: plan.price, markupType: 'fixed', markupValue: '0' })
  }

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.planName || !formData.basePrice || formData.markupValue === '') {
      toast('Please fill in all fields', 'error')
      return
    }

    // A plan can only have one API price per service
    const duplicate = rules.find((r) => r.plan_name === formData.planName)
    if (duplicate) {
      const overwrite = await confirm({
        title: 'Plan already priced',
        message: `"${formData.planName}" already has an API price of ₦${Math.round(
          calculateFinalPrice(duplicate)
        ).toLocaleString()}. Update it instead?`,
        confirmLabel: 'Update price',
      })
      if (!overwrite) return

      setSubmitting(true)
      const updateResult = await updateApiPricingRule(duplicate.id, {
        basePrice: parseFloat(formData.basePrice),
        markupType: formData.markupType,
        markupValue: parseFloat(formData.markupValue),
      })
      if (updateResult.success) {
        setFormData({ planName: '', basePrice: '', markupType: 'fixed', markupValue: '' })
        fetchRules()
        toast('API price updated', 'success')
      } else {
        toast(updateResult.error || 'Could not update price', 'error')
      }
      setSubmitting(false)
      return
    }

    setSubmitting(true)
    const result = await createApiPricingRule(
      serviceId,
      formData.planName,
      parseFloat(formData.basePrice),
      formData.markupType,
      parseFloat(formData.markupValue)
    )
    if (result.success) {
      setFormData({ planName: '', basePrice: '', markupType: 'fixed', markupValue: '' })
      fetchRules()
      toast('API pricing rule created', 'success')
    } else {
      toast(result.error || 'Could not create rule', 'error')
    }
    setSubmitting(false)
  }

  const handleUpdateRule = async () => {
    if (!editingRule) return
    setSubmitting(true)
    const result = await updateApiPricingRule(editingRule.id, {
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
      title: 'Delete this API pricing rule?',
      message: 'API users will lose access to this plan immediately.',
      confirmLabel: 'Delete rule',
      tone: 'danger',
    })
    if (!ok) return

    const result = await deleteApiPricingRule(ruleId)
    if (result.success) {
      fetchRules()
      toast('Rule deleted', 'success')
    } else {
      toast(result.error || 'Could not delete rule', 'error')
    }
  }

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bulkMarkupValue || selectedRuleIds.length === 0) {
      toast('Select rules and enter a markup value', 'error')
      return
    }
    setSubmitting(true)
    const result = await bulkUpdateApiPricingRules(
      selectedRuleIds,
      bulkMarkupType,
      parseFloat(bulkMarkupValue)
    )
    if (result.success) {
      setSelectedRuleIds([])
      setBulkMarkupValue('')
      fetchRules()
      toast(`Updated ${result.updated} rule${result.updated === 1 ? '' : 's'}`, 'success')
    } else {
      toast(result.error || 'Could not update rules', 'error')
    }
    setSubmitting(false)
  }

  const handleBulkCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bulkMarkupValue || selectedPlanValues.length === 0) {
      toast('Select plans and enter a markup value', 'error')
      return
    }
    setSubmitting(true)
    const plansToCreate = gsubzPlans
      .filter((p) => selectedPlanValues.includes(p.value))
      .map((p) => ({
        planName: p.displayName,
        basePrice: parseFloat(p.price),
      }))

    const result = await bulkCreateApiPricingRules(
      activePlanType,
      plansToCreate,
      bulkMarkupType,
      parseFloat(bulkMarkupValue)
    )
    if (result.success) {
      setSelectedPlanValues([])
      setBulkMarkupValue('')
      fetchRules()
      const parts: string[] = []
      if (result.created) parts.push(`${result.created} created`)
      if (result.updated) parts.push(`${result.updated} updated`)
      toast(`API pricing saved: ${parts.join(', ') || 'no changes'}`, 'success')
    } else {
      toast(result.error || 'Could not save API pricing', 'error')
    }
    setSubmitting(false)
  }

  const toggleSelectRule = (id: string) => {
    setSelectedRuleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleSelectPlan = (value: string) => {
    setSelectedPlanValues((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
    )
  }

  const planTypeLabel = currentNetwork?.types.find((t) => t.value === activePlanType)?.label || ''

  // Which live plans already have an API pricing rule for this service
  const ruleByPlanName = new Map(rules.map((r) => [r.plan_name, r]))
  const pricedCount = gsubzPlans.filter((p) => ruleByPlanName.has(p.displayName)).length
  const unpricedPlans = gsubzPlans.filter((p) => !ruleByPlanName.has(p.displayName))

  // Rules that exist in the DB but no longer match a live provider plan
  const orphanRules = rules.filter(
    (r) => !gsubzPlans.some((p) => p.displayName === r.plan_name)
  )

  // Rules whose stored base price drifted from the live provider price
  const staleRules = rules.filter((r) => {
    const live = gsubzPlans.find((p) => p.displayName === r.plan_name)
    return live && Math.abs(parseFloat(live.price) - r.base_price) > 0.009
  })

  const visibleBulkPlans = gsubzPlans.filter((plan) => {
    if (hidePricedPlans && ruleByPlanName.has(plan.displayName)) return false
    if (!planSearch.trim()) return true
    return plan.displayName.toLowerCase().includes(planSearch.trim().toLowerCase())
  })

  const allVisibleSelected =
    visibleBulkPlans.length > 0 &&
    visibleBulkPlans.every((p) => selectedPlanValues.includes(p.value))

  const toggleSelectAllVisiblePlans = () => {
    if (allVisibleSelected) {
      const visible = new Set(visibleBulkPlans.map((p) => p.value))
      setSelectedPlanValues((prev) => prev.filter((v) => !visible.has(v)))
    } else {
      setSelectedPlanValues((prev) =>
        Array.from(new Set([...prev, ...visibleBulkPlans.map((p) => p.value)]))
      )
    }
  }

  const selectUnpricedPlans = () => {
    setSelectedPlanValues(unpricedPlans.map((p) => p.value))
  }

  // Duplicate plan names for this service (the table has no unique constraint)
  const duplicatePlanNames = (() => {
    const seen = new Set<string>()
    const dupes = new Set<string>()
    for (const r of rules) {
      if (seen.has(r.plan_name)) dupes.add(r.plan_name)
      else seen.add(r.plan_name)
    }
    return dupes
  })()

  const filteredRules = ruleSearch.trim()
    ? rules.filter((r) => r.plan_name.toLowerCase().includes(ruleSearch.trim().toLowerCase()))
    : rules

  const allRulesSelected =
    filteredRules.length > 0 && filteredRules.every((r) => selectedRuleIds.includes(r.id))

  const toggleSelectAllRules = () => {
    if (allRulesSelected) {
      const visible = new Set(filteredRules.map((r) => r.id))
      setSelectedRuleIds((prev) => prev.filter((id) => !visible.has(id)))
    } else {
      setSelectedRuleIds((prev) =>
        Array.from(new Set([...prev, ...filteredRules.map((r) => r.id)]))
      )
    }
  }

  // Totals across every service, for the overview strip
  const totalRules = Object.values(overview).reduce((sum, c) => sum + c.total, 0)
  const totalDuplicates = Object.values(overview).reduce((sum, c) => sum + c.duplicates, 0)
  const servicesWithPricing = Object.values(overview).filter((c) => c.active > 0).length

  const avgMargin =
    rules.length > 0
      ? rules.reduce((sum, r) => {
          const final = calculateFinalPrice(r)
          return sum + (r.base_price > 0 ? ((final - r.base_price) / r.base_price) * 100 : 0)
        }, 0) / rules.length
      : 0

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-row">
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={20} />
              API Pricing Management
            </h1>
            <p>
              Set prices that API users (Connect Key holders) see when they purchase data.
              These are separate from your regular user prices.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              fetchRules()
              fetchOverview()
              fetchGsubzPlans(activePlanType)
            }}
            disabled={loading}
          >
            <RefreshCw size={14} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Account-wide overview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          { label: 'Total API rules', value: totalRules.toLocaleString(), icon: <Zap size={14} /> },
          {
            label: 'Services priced',
            value: `${servicesWithPricing}/${Object.keys(SERVICE_MAP).length}`,
            icon: <Check size={14} />,
          },
          {
            label: 'Avg margin (this service)',
            value: `${avgMargin >= 0 ? '+' : ''}${avgMargin.toFixed(1)}%`,
            icon: <TrendingUp size={14} />,
            tone: avgMargin < 0 ? 'danger' : 'success',
          },
          {
            label: 'Duplicate rules',
            value: totalDuplicates.toLocaleString(),
            icon: <Copy size={14} />,
            tone: totalDuplicates > 0 ? 'warning' : undefined,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'var(--admin-bg-secondary)',
              border: '1px solid var(--admin-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: 'var(--admin-text-tertiary)',
              }}
            >
              {stat.icon}
              <span>{stat.label}</span>
            </div>
            <p
              style={{
                margin: '6px 0 0 0',
                fontSize: 20,
                fontWeight: 700,
                color:
                  stat.tone === 'danger'
                    ? 'var(--admin-danger)'
                    : stat.tone === 'warning'
                      ? 'var(--admin-warning)'
                      : stat.tone === 'success'
                        ? 'var(--admin-success)'
                        : 'var(--admin-text)',
              }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {loadError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            color: 'var(--admin-danger)',
            marginBottom: 16,
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span>Could not load pricing rules: {loadError}</span>
        </div>
      )}

      {/* Network selector */}
      <div className="filter-chips">
        {NETWORKS.map((network) => {
          const networkTotal = network.types.reduce(
            (sum, t) => sum + (overview[SERVICE_MAP[t.value] || t.value]?.active || 0),
            0
          )
          return (
            <button
              type="button"
              key={network.name}
              className={`filter-chip ${activeNetwork === network.name ? 'active' : ''}`}
              onClick={() => setActiveNetwork(network.name)}
            >
              {network.name}
              {networkTotal > 0 && (
                <span style={{ marginLeft: 6, opacity: 0.7, fontSize: 11 }}>{networkTotal}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Plan type selector */}
      {currentNetwork && currentNetwork.types.length > 1 && (
        <div className="filter-chips">
          {currentNetwork.types.map((type) => {
            const count = overview[SERVICE_MAP[type.value] || type.value]?.active || 0
            return (
              <button
                type="button"
                key={type.value}
                className={`filter-chip ${activePlanType === type.value ? 'active' : ''}`}
                onClick={() => setActivePlanType(type.value)}
              >
                {type.label}
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    opacity: 0.7,
                    color: count === 0 ? 'var(--admin-warning)' : undefined,
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
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
          Editing API prices for:{' '}
          <strong style={{ color: 'var(--admin-text)' }}>
            {activeNetwork} {planTypeLabel}
          </strong>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 999,
              background:
                gsubzPlans.length === 0
                  ? 'var(--admin-bg)'
                  : pricedCount === gsubzPlans.length
                    ? 'rgba(34, 197, 94, 0.15)'
                    : pricedCount === 0
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(245, 158, 11, 0.15)',
              color:
                gsubzPlans.length === 0
                  ? 'var(--admin-text-tertiary)'
                  : pricedCount === gsubzPlans.length
                    ? 'var(--admin-success)'
                    : pricedCount === 0
                      ? 'var(--admin-danger)'
                      : 'var(--admin-warning)',
            }}
          >
            {loadingGsubz
              ? 'Checking API coverage...'
              : gsubzPlans.length === 0
                ? 'No live plans'
                : pricedCount === gsubzPlans.length
                  ? `All ${gsubzPlans.length} plans live on API`
                  : `${pricedCount}/${gsubzPlans.length} plans live on API`}
          </span>
          <span style={{ fontSize: 12, color: 'var(--admin-text-tertiary)' }}>
            {rules.length} rule{rules.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Warnings the admin needs to know about */}
      {!loadingGsubz && !loading && (staleRules.length > 0 || orphanRules.length > 0 || unpricedPlans.length > 0 || duplicatePlanNames.size > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {duplicatePlanNames.size > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                color: 'var(--admin-danger)',
                flexWrap: 'wrap',
              }}
            >
              <Copy size={14} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 180 }}>
                {duplicatePlanNames.size} plan{duplicatePlanNames.size !== 1 ? 's have' : ' has'}{' '}
                more than one pricing rule. API buyers may get an unpredictable price.
              </span>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDedupe}
                disabled={dedupeBusy}
                style={{ fontSize: 11 }}
              >
                {dedupeBusy ? 'Cleaning...' : 'Keep newest, remove rest'}
              </button>
            </div>
          )}
          {unpricedPlans.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                color: 'var(--admin-warning)',
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>
                {unpricedPlans.length} plan{unpricedPlans.length !== 1 ? 's' : ''} not available to API
                users yet.
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setActiveTab('bulk')
                  selectUnpricedPlans()
                }}
                style={{ fontSize: 11 }}
              >
                Price them
              </button>
            </div>
          )}
          {staleRules.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                color: 'var(--admin-danger)',
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span>
                {staleRules.length} rule{staleRules.length !== 1 ? 's have' : ' has'} a base price
                that no longer matches the live provider price. Re-run bulk create on those plans to
                resync.
              </span>
            </div>
          )}
          {orphanRules.length > 0 && (
            <div
              style={{
                padding: '10px 12px',
                background: 'var(--admin-bg-secondary)',
                border: '1px solid var(--admin-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                color: 'var(--admin-text-secondary)',
              }}
            >
              {orphanRules.length} rule{orphanRules.length !== 1 ? 's' : ''} no longer match any live
              plan ({orphanRules.map((r) => r.plan_name).join(', ')}). They are still sold on the API
              — delete them if the plan is retired.
            </div>
          )}
        </div>
      )}

      {/* Action tabs */}
      <div className="admin-tabs" style={{ marginBottom: 16 }}>
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
          Bulk Create
        </button>
      </div>

      {activeTab === 'individual' && (
        <>
          {/* Gsubz live plans */}
          <div className="admin-card" style={{ marginBottom: 16 }}>
            <div className="admin-card-header">
              <h2 className="admin-card-title">Live Plans from Gsubz</h2>
              <span style={{ fontSize: 12, color: 'var(--admin-text-tertiary)' }}>
                Green = already available to API users. Click a plan to auto-fill the form below.
              </span>
            </div>
            <div className="admin-card-body">
              {loadingGsubz ? (
                <p style={{ color: 'var(--admin-text-tertiary)', fontSize: 13 }}>Loading plans...</p>
              ) : gsubzPlans.length === 0 ? (
                <p style={{ color: 'var(--admin-text-tertiary)', fontSize: 13 }}>No plans available</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {gsubzPlans.map((plan) => {
                    const existing = ruleByPlanName.get(plan.displayName)
                    return (
                      <button
                        key={plan.value}
                        type="button"
                        onClick={() => handleSelectGsubzPlan(plan)}
                        className="btn btn-secondary btn-sm"
                        style={{
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          borderColor: existing ? 'rgba(34, 197, 94, 0.5)' : undefined,
                          background: existing ? 'rgba(34, 197, 94, 0.1)' : undefined,
                        }}
                        title={
                          existing
                            ? `Already on API at ₦${Math.round(calculateFinalPrice(existing)).toLocaleString()}`
                            : 'Not available to API users yet'
                        }
                      >
                        {existing && <Check size={12} style={{ color: 'var(--admin-success)' }} />}
                        <span>
                          {plan.displayName} — ₦{plan.price}
                        </span>
                        {existing && (
                          <span style={{ color: 'var(--admin-success)', fontWeight: 700 }}>
                            → ₦{Math.round(calculateFinalPrice(existing)).toLocaleString()}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Add rule form */}
          <div className="admin-card" style={{ marginBottom: 16 }}>
            <div className="admin-card-header">
              <h2 className="admin-card-title">Add API Pricing Rule</h2>
            </div>
            <div className="admin-card-body">
              <form onSubmit={handleAddRule} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <label className="form-label">Plan Name</label>
                  <input
                    className="form-input"
                    placeholder="e.g. 1GB - 7 Days"
                    value={formData.planName}
                    onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                    required
                  />
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <label className="form-label">Base Price (₦)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 300"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    required
                  />
                </div>
                <div style={{ flex: '1 1 110px' }}>
                  <label className="form-label">Markup Type</label>
                  <select
                    className="form-input"
                    value={formData.markupType}
                    onChange={(e) => setFormData({ ...formData, markupType: e.target.value as 'fixed' | 'percentage' })}
                  >
                    <option value="fixed">Fixed (₦)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 110px' }}>
                  <label className="form-label">
                    Markup {formData.markupType === 'fixed' ? '(₦)' : '(%)'}
                  </label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={formData.markupValue}
                      onChange={(e) => setFormData({ ...formData, markupValue: e.target.value })}
                      style={{ flex: 1 }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const current = parseFloat(formData.markupValue) || 0
                        const step = formData.markupType === 'percentage' ? 1 : 50
                        setFormData({ ...formData, markupValue: String(current - step) })
                      }}
                      style={{
                        padding: '6px 8px',
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
                      style={{
                        padding: '6px 8px',
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
                <div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                    <Plus size={14} />
                    <span>{submitting ? 'Adding...' : 'Add Rule'}</span>
                  </button>
                </div>
              </form>

              {/* Quick presets */}
              {formData.markupValue !== '' && (
                <div style={{ marginTop: 14 }}>
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
              )}

              {/* Live preview */}
              {formData.markupValue && formData.planName && formData.basePrice && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--admin-success)' }}>
                    API Price Preview
                  </p>
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--admin-text-tertiary)' }}>Plan</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: 12, fontWeight: 600 }}>{formData.planName}</p>
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
                </div>
              )}
            </div>
          </div>

          {/* Rules table */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title">
                API Pricing Rules
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: 'var(--admin-bg)',
                    color: 'var(--admin-text-secondary)',
                  }}
                >
                  {rules.length}
                </span>
              </h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 150 }}>
                  <Search
                    size={13}
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--admin-text-tertiary)',
                    }}
                  />
                  <input
                    className="form-input"
                    placeholder="Search rules..."
                    value={ruleSearch}
                    onChange={(e) => setRuleSearch(e.target.value)}
                    style={{ paddingLeft: 30, fontSize: 12 }}
                  />
                </div>
                {rules.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={toggleSelectAllRules}
                  >
                    {allRulesSelected ? 'Deselect all' : 'Select all'}
                  </button>
                )}
                {selectedRuleIds.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={handleBulkDelete}
                  >
                    <Trash2 size={13} />
                    <span>Delete {selectedRuleIds.length}</span>
                  </button>
                )}
              </div>
            </div>
            {loading ? (
              <div className="admin-card-body">
                <p style={{ color: 'var(--admin-text-tertiary)', fontSize: 13 }}>Loading...</p>
              </div>
            ) : rules.length === 0 ? (
              <div className="admin-card-body" style={{ textAlign: 'center', padding: '32px 16px' }}>
                <Zap size={28} style={{ color: 'var(--admin-text-tertiary)', marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                  No API pricing for {activeNetwork} {planTypeLabel}
                </p>
                <p style={{ margin: '6px 0 12px 0', color: 'var(--admin-text-tertiary)', fontSize: 12 }}>
                  API users cannot buy these plans until you set a price.
                </p>
                {unpricedPlans.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setActiveTab('bulk')
                      selectUnpricedPlans()
                    }}
                  >
                    <Zap size={14} />
                    <span>Price all {unpricedPlans.length} plans</span>
                  </button>
                )}
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="admin-card-body">
                <p style={{ color: 'var(--admin-text-tertiary)', fontSize: 13 }}>
                  No rules match &ldquo;{ruleSearch}&rdquo;.
                </p>
              </div>
            ) : (
              <div>
                {/* Desktop table */}
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 34 }}>
                          <input
                            type="checkbox"
                            checked={allRulesSelected}
                            onChange={toggleSelectAllRules}
                            aria-label="Select all rules"
                          />
                        </th>
                        <th>Plan Name</th>
                        <th>Base Price</th>
                        <th>Markup</th>
                        <th>API Price</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRules.map((rule) => (
                        <tr
                          key={rule.id}
                          style={
                            selectedRuleIds.includes(rule.id)
                              ? { background: 'rgba(14, 165, 233, 0.07)' }
                              : undefined
                          }
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedRuleIds.includes(rule.id)}
                              onChange={() => toggleSelectRule(rule.id)}
                              aria-label={`Select ${rule.plan_name}`}
                            />
                          </td>
                          <td style={{ fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span>{rule.plan_name}</span>
                              {duplicatePlanNames.has(rule.plan_name) && (
                                <span
                                  title="This plan has more than one pricing rule"
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: '2px 5px',
                                    borderRadius: 4,
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    color: 'var(--admin-danger)',
                                  }}
                                >
                                  DUPLICATE
                                </span>
                              )}
                              {!rule.is_active && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: '2px 5px',
                                    borderRadius: 4,
                                    background: 'var(--admin-bg)',
                                    color: 'var(--admin-text-tertiary)',
                                  }}
                                >
                                  INACTIVE
                                </span>
                              )}
                              {staleRules.some((r) => r.id === rule.id) && (
                                <span
                                  title="Provider base price changed — resync this rule"
                                  style={{ display: 'inline-flex', color: 'var(--admin-danger)' }}
                                >
                                  <AlertTriangle size={12} />
                                </span>
                              )}
                              {orphanRules.some((r) => r.id === rule.id) && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: '2px 5px',
                                    borderRadius: 4,
                                    background: 'var(--admin-bg)',
                                    color: 'var(--admin-text-tertiary)',
                                  }}
                                >
                                  RETIRED
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-mono">₦{rule.base_price.toLocaleString()}</td>
                          <td>
                            {editingRule && editingRule.id === rule.id ? (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <select
                                  className="form-input"
                                  style={{ height: 32, padding: '0 8px', fontSize: 13, width: 100 }}
                                  value={editingRule.markupType}
                                  onChange={(e) =>
                                    setEditingRule({ ...editingRule, markupType: e.target.value as 'fixed' | 'percentage' })
                                  }
                                >
                                  <option value="fixed">Fixed</option>
                                  <option value="percentage">%</option>
                                </select>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editingRule.markupValue}
                                  onChange={(e) =>
                                    setEditingRule({ ...editingRule, markupValue: parseFloat(e.target.value) || 0 })
                                  }
                                  style={{
                                    height: 32,
                                    padding: '0 8px',
                                    background: 'var(--admin-bg)',
                                    border: '1px solid var(--admin-secondary)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--admin-text)',
                                    fontSize: 13,
                                    width: 80,
                                  }}
                                />
                              </div>
                            ) : (
                              <span className="text-mono" style={{ color: 'var(--admin-warning)' }}>
                                {rule.markup_type === 'fixed' ? '+₦' : '+'}
                                {rule.markup_value}
                                {rule.markup_type === 'percentage' ? '%' : ''}
                              </span>
                            )}
                          </td>
                          <td className="text-mono" style={{ fontWeight: 700, color: 'var(--admin-success)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>₦{Math.round(calculateFinalPrice(rule)).toLocaleString()}</span>
                              {(() => {
                                const profit = calculateFinalPrice(rule) - rule.base_price
                                return (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 600,
                                      color:
                                        profit < 0
                                          ? 'var(--admin-danger)'
                                          : 'var(--admin-text-tertiary)',
                                    }}
                                  >
                                    {profit >= 0 ? '+' : '−'}₦
                                    {Math.abs(Math.round(profit)).toLocaleString()} profit
                                  </span>
                                )
                              })()}
                            </div>
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
                  {filteredRules.map((rule) => {
                    const isEditing = editingRule && editingRule.id === rule.id
                    return (
                      <div key={rule.id} className="data-card">
                        <div className="data-card-header">
                          <input
                            type="checkbox"
                            checked={selectedRuleIds.includes(rule.id)}
                            onChange={() => toggleSelectRule(rule.id)}
                            aria-label={`Select ${rule.plan_name}`}
                            style={{ marginRight: 8, marginTop: 4 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 className="data-card-title">
                              {rule.plan_name}
                              {duplicatePlanNames.has(rule.plan_name) && (
                                <span
                                  style={{
                                    marginLeft: 6,
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: '2px 5px',
                                    borderRadius: 4,
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    color: 'var(--admin-danger)',
                                  }}
                                >
                                  DUPLICATE
                                </span>
                              )}
                            </h3>
                            <p className="data-card-subtitle">Base: ₦{rule.base_price.toLocaleString()}</p>
                          </div>
                          <span className="data-card-amount" style={{ color: 'var(--admin-success)', fontSize: 16 }}>
                            ₦{Math.round(calculateFinalPrice(rule)).toLocaleString()}
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
                                  setEditingRule({ ...editingRule, markupValue: parseFloat(e.target.value) || 0 })
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
        <div>
          {/* BULK CREATE SECTION */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title">Bulk Create / Sync API Pricing</h2>
              <span style={{ fontSize: 12, color: 'var(--admin-text-tertiary)' }}>
                Green plans are already on the API. Re-selecting them updates their price instead of
                duplicating.
              </span>
            </div>
          <div className="admin-card-body">
            {/* Plan selector */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginBottom: 10,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Select Plans to Price</h3>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={toggleSelectAllVisiblePlans}
                    disabled={visibleBulkPlans.length === 0}
                  >
                    {allVisibleSelected ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={selectUnpricedPlans}
                    disabled={unpricedPlans.length === 0}
                  >
                    Select Unpriced ({unpricedPlans.length})
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={() => setSelectedPlanValues([])}
                    disabled={selectedPlanValues.length === 0}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Search + filter */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                <div style={{ position: 'relative', flex: '1 1 180px' }}>
                  <Search
                    size={13}
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--admin-text-tertiary)',
                    }}
                  />
                  <input
                    className="form-input"
                    placeholder="Search plans..."
                    value={planSearch}
                    onChange={(e) => setPlanSearch(e.target.value)}
                    style={{ paddingLeft: 30, fontSize: 12 }}
                  />
                </div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: 'var(--admin-text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={hidePricedPlans}
                    onChange={(e) => setHidePricedPlans(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Hide already priced
                </label>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 240, overflowY: 'auto', paddingRight: 8 }}>
                {loadingGsubz ? (
                  <p style={{ color: 'var(--admin-text-tertiary)', fontSize: 12 }}>Loading plans...</p>
                ) : gsubzPlans.length === 0 ? (
                  <p style={{ color: 'var(--admin-text-tertiary)', fontSize: 12 }}>No plans available</p>
                ) : visibleBulkPlans.length === 0 ? (
                  <p style={{ color: 'var(--admin-text-tertiary)', fontSize: 12 }}>
                    No plans match the current search or filter.
                  </p>
                ) : (
                  visibleBulkPlans.map((plan) => {
                    const existing = ruleByPlanName.get(plan.displayName)
                    const checked = selectedPlanValues.includes(plan.value)
                    return (
                      <label
                        key={plan.value}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 10px',
                          border: `1px solid ${
                            checked
                              ? 'var(--admin-secondary)'
                              : existing
                                ? 'rgba(34, 197, 94, 0.4)'
                                : 'var(--admin-border)'
                          }`,
                          borderRadius: 'var(--radius-sm)',
                          background: checked
                            ? 'rgba(14, 165, 233, 0.1)'
                            : existing
                              ? 'rgba(34, 197, 94, 0.07)'
                              : 'transparent',
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectPlan(plan.value)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>{plan.displayName}</span>
                        {existing ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              fontSize: 10,
                              fontWeight: 700,
                              color: 'var(--admin-success)',
                            }}
                          >
                            <Check size={10} />
                            ₦{Math.round(calculateFinalPrice(existing)).toLocaleString()}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--admin-text-tertiary)' }}>new</span>
                        )}
                      </label>
                    )
                  })
                )}
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: 11, color: 'var(--admin-text-tertiary)' }}>
                Selected: {selectedPlanValues.length} plan(s)
                {(() => {
                  const selectedExisting = gsubzPlans.filter(
                    (p) => selectedPlanValues.includes(p.value) && ruleByPlanName.has(p.displayName)
                  ).length
                  if (selectedExisting === 0) return null
                  return ` — ${selectedExisting} already priced and will be updated, ${
                    selectedPlanValues.length - selectedExisting
                  } newly created`
                })()}
              </p>
            </div>

            <form onSubmit={handleBulkCreate} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
              <div style={{ flex: '1 1 110px' }}>
                <label className="form-label">Markup Type</label>
                <select
                  className="form-input"
                  value={bulkMarkupType}
                  onChange={(e) => setBulkMarkupType(e.target.value as 'fixed' | 'percentage')}
                >
                  <option value="fixed">Fixed (₦)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label className="form-label">Markup Value</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={bulkMarkupValue}
                    onChange={(e) => setBulkMarkupValue(e.target.value)}
                    style={{ flex: 1 }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseFloat(bulkMarkupValue) || 0
                      const step = bulkMarkupType === 'percentage' ? 1 : 50
                      setBulkMarkupValue(String(current - step))
                    }}
                    style={{
                      padding: '6px 8px',
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
                      const current = parseFloat(bulkMarkupValue) || 0
                      const step = bulkMarkupType === 'percentage' ? 1 : 50
                      setBulkMarkupValue(String(current + step))
                    }}
                    style={{
                      padding: '6px 8px',
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
              <div>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={submitting || selectedPlanValues.length === 0}
                >
                  {submitting ? 'Saving...' : `Apply to ${selectedPlanValues.length} selected`}
                </button>
              </div>
            </form>

            {/* Quick presets for bulk */}
            {bulkMarkupValue !== '' && (
              <div style={{ marginTop: 14, marginBottom: 14 }}>
                <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 600, color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>
                  Quick presets
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {bulkMarkupType === 'percentage' ? (
                    <>
                      {[5, 10, 15, 20, 25, 30].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setBulkMarkupValue(String(val))}
                          style={{
                            padding: '6px 10px',
                            fontSize: 12,
                            fontWeight: 500,
                            border: '1px solid var(--admin-border)',
                            borderRadius: 'var(--radius-sm)',
                            background: bulkMarkupValue === String(val) ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                            color: bulkMarkupValue === String(val) ? 'var(--admin-secondary)' : 'var(--admin-text)',
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
                          onClick={() => setBulkMarkupValue(String(val))}
                          style={{
                            padding: '6px 10px',
                            fontSize: 12,
                            fontWeight: 500,
                            border: '1px solid var(--admin-border)',
                            borderRadius: 'var(--radius-sm)',
                            background: bulkMarkupValue === String(val) ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                            color: bulkMarkupValue === String(val) ? 'var(--admin-secondary)' : 'var(--admin-text)',
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
            )}

            {/* Preview of bulk create */}
            {bulkMarkupValue && selectedPlanValues.length > 0 && (
              <div
                style={{
                  padding: 12,
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 14,
                }}
              >
                <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: 'var(--admin-success)' }}>
                  Preview — {selectedPlanValues.length} plan(s) will be made available to API users
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto', paddingRight: 8 }}>
                  {gsubzPlans
                    .filter((p) => selectedPlanValues.includes(p.value))
                    .map((plan) => {
                      const basePrice = parseFloat(plan.price)
                      const markupVal = parseFloat(bulkMarkupValue) || 0
                      const finalPrice =
                        bulkMarkupType === 'fixed'
                          ? basePrice + markupVal
                          : basePrice * (1 + markupVal / 100)
                      const existing = ruleByPlanName.get(plan.displayName)
                      return (
                        <div
                          key={plan.value}
                          style={{
                            padding: 10,
                            background: 'var(--admin-bg)',
                            border: '1px solid var(--admin-border)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 11,
                          }}
                        >
                          <p style={{ margin: 0, fontWeight: 600, color: 'var(--admin-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {plan.displayName}
                          </p>
                          <p
                            style={{
                              margin: '4px 0 0 0',
                              fontSize: 9,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              color: existing ? 'var(--admin-warning)' : 'var(--admin-secondary)',
                            }}
                          >
                            {existing ? 'Update existing' : 'New'}
                          </p>
                          <p style={{ margin: '6px 0 0 0', color: 'var(--admin-text-secondary)', fontSize: 10 }}>
                            Base: <span style={{ fontWeight: 600 }}>₦{basePrice.toLocaleString()}</span>
                          </p>
                          {existing && (
                            <p style={{ margin: '2px 0 0 0', color: 'var(--admin-text-tertiary)', fontSize: 10 }}>
                              Current: ₦{Math.round(calculateFinalPrice(existing)).toLocaleString()}
                            </p>
                          )}
                          <p style={{ margin: '2px 0 0 0', color: 'var(--admin-success)', fontSize: 10 }}>
                            {existing ? 'New' : 'Final'}:{' '}
                            <span style={{ fontWeight: 600 }}>₦{Math.round(finalPrice).toLocaleString()}</span>
                          </p>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            </div>
          </div>

          {/* BULK EDIT SECTION */}
          <div className="admin-card" style={{ marginTop: 16 }}>
            <div className="admin-card-header">
              <div>
                <h2 className="admin-card-title">Bulk Edit API Pricing Rules</h2>
                <p style={{ fontSize: 12, color: 'var(--admin-text-tertiary)', margin: '4px 0 0 0' }}>
                  {selectedRuleIds.length} rule(s) selected out of {rules.length}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedRuleIds.length === rules.length && rules.length > 0) {
                      setSelectedRuleIds([])
                    } else {
                      setSelectedRuleIds(rules.map((r) => r.id))
                    }
                  }}
                  className="btn btn-secondary btn-sm"
                  disabled={rules.length === 0}
                >
                  {selectedRuleIds.length === rules.length && rules.length > 0
                    ? 'Deselect All'
                    : selectedRuleIds.length > 0
                      ? 'Select Remaining'
                      : 'Select All'}
                </button>
              </div>
            </div>
            <div className="admin-card-body">
              {/* Rules selector for bulk edit */}
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600 }}>Select Rules to Update</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 200, overflowY: 'auto', paddingRight: 8 }}>
                  {rules.length === 0 ? (
                    <p style={{ color: 'var(--admin-text-tertiary)', fontSize: 12 }}>No existing rules. Create some first.</p>
                  ) : (
                    rules.map((rule) => (
                      <label
                        key={rule.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 10px',
                          border: `1px solid ${selectedRuleIds.includes(rule.id) ? 'var(--admin-secondary)' : 'var(--admin-border)'}`,
                          borderRadius: 'var(--radius-sm)',
                          background: selectedRuleIds.includes(rule.id) ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedRuleIds.includes(rule.id)}
                          onChange={() => toggleSelectRule(rule.id)}
                          style={{ cursor: 'pointer' }}
                        />
                        {rule.plan_name}
                      </label>
                    ))
                  )}
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: 11, color: 'var(--admin-text-tertiary)' }}>
                  Selected: {selectedRuleIds.length} rule(s)
                </p>
              </div>

              <form onSubmit={handleBulkUpdate} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
                <div style={{ flex: '1 1 110px' }}>
                  <label className="form-label">Markup Type</label>
                  <select
                    className="form-input"
                    value={bulkMarkupType}
                    onChange={(e) => setBulkMarkupType(e.target.value as 'fixed' | 'percentage')}
                  >
                    <option value="fixed">Fixed (₦)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label className="form-label">Operation</label>
                  <select
                    className="form-input"
                    value={bulkOperationType}
                    onChange={(e) => setBulkOperationType(e.target.value as 'set' | 'add' | 'subtract')}
                  >
                    <option value="set">Set to value</option>
                    <option value="add">Add to current</option>
                    <option value="subtract">Subtract from current</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <label className="form-label">Value</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={bulkMarkupValue}
                      onChange={(e) => setBulkMarkupValue(e.target.value)}
                      style={{ flex: 1 }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const current = parseFloat(bulkMarkupValue) || 0
                        const step = bulkMarkupType === 'percentage' ? 1 : 50
                        setBulkMarkupValue(String(current - step))
                      }}
                      style={{
                        padding: '6px 8px',
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
                        const current = parseFloat(bulkMarkupValue) || 0
                        const step = bulkMarkupType === 'percentage' ? 1 : 50
                        setBulkMarkupValue(String(current + step))
                      }}
                      style={{
                        padding: '6px 8px',
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
                <div>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={submitting || selectedRuleIds.length === 0}
                  >
                    {submitting ? 'Updating...' : `Update ${selectedRuleIds.length} selected`}
                  </button>
                </div>
              </form>

              {/* Quick presets for bulk edit */}
              {bulkMarkupValue !== '' && (
                <div style={{ marginTop: 14, marginBottom: 14 }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 600, color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>
                    Quick presets
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {bulkMarkupType === 'percentage' ? (
                      <>
                        {[5, 10, 15, 20, 25, 30].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setBulkMarkupValue(String(val))}
                            style={{
                              padding: '6px 10px',
                              fontSize: 12,
                              fontWeight: 500,
                              border: '1px solid var(--admin-border)',
                              borderRadius: 'var(--radius-sm)',
                              background: bulkMarkupValue === String(val) ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                              color: bulkMarkupValue === String(val) ? 'var(--admin-secondary)' : 'var(--admin-text)',
                              cursor: 'pointer',
                            }}
                          >
                            {bulkOperationType === 'set' ? '' : bulkOperationType === 'add' ? '+' : '−'}{val}%
                          </button>
                        ))}
                      </>
                    ) : (
                      <>
                        {[50, 100, 200, 500, 1000].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setBulkMarkupValue(String(val))}
                            style={{
                              padding: '6px 10px',
                              fontSize: 12,
                              fontWeight: 500,
                              border: '1px solid var(--admin-border)',
                              borderRadius: 'var(--radius-sm)',
                              background: bulkMarkupValue === String(val) ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                              color: bulkMarkupValue === String(val) ? 'var(--admin-secondary)' : 'var(--admin-text)',
                              cursor: 'pointer',
                            }}
                          >
                            {bulkOperationType === 'set' ? '+₦' : bulkOperationType === 'add' ? '+₦' : '−₦'}{val}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Preview for bulk edit with ALL rules shown */}
              {bulkMarkupValue && selectedRuleIds.length > 0 && (
                <div
                  style={{
                    padding: 12,
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: 'var(--admin-success)' }}>
                    Preview of changes ({bulkOperationType} mode) - {selectedRuleIds.length} selected rule(s)
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                    {rules
                      .filter((r) => selectedRuleIds.includes(r.id))
                      .map((rule) => {
                        const markupVal = parseFloat(bulkMarkupValue)
                        const oldPrice = calculateFinalPrice(rule)
                        let newFinalPrice = oldPrice
                        if (bulkMarkupType === 'fixed') {
                          if (bulkOperationType === 'set') newFinalPrice = rule.base_price + markupVal
                          else if (bulkOperationType === 'add') newFinalPrice = oldPrice + markupVal
                          else newFinalPrice = oldPrice - markupVal
                        } else {
                          if (bulkOperationType === 'set') newFinalPrice = rule.base_price * (1 + markupVal / 100)
                          else if (bulkOperationType === 'add') newFinalPrice = oldPrice * (1 + markupVal / 100)
                          else newFinalPrice = oldPrice * (1 - markupVal / 100)
                        }
                        return (
                          <div
                            key={rule.id}
                            style={{
                              padding: 10,
                              background: 'var(--admin-bg)',
                              border: '1px solid var(--admin-border)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 11,
                            }}
                          >
                            <p style={{ margin: 0, fontWeight: 600, color: 'var(--admin-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {rule.plan_name}
                            </p>
                            <p style={{ margin: '6px 0 0 0', color: 'var(--admin-text-secondary)', fontSize: 10 }}>
                              Current: <span style={{ fontWeight: 600 }}>₦{Math.round(oldPrice).toLocaleString()}</span>
                            </p>
                            <p style={{ margin: '2px 0 0 0', color: 'var(--admin-success)', fontSize: 10 }}>
                              New: <span style={{ fontWeight: 600 }}>₦{Math.round(newFinalPrice).toLocaleString()}</span>
                            </p>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
