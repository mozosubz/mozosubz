'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  createApiPricingRule,
  deleteApiPricingRule,
  updateApiPricingRule,
  bulkUpdateApiPricingRules,
} from '@/lib/actions/api-pricing'
import { Plus, Trash2, Edit2, Save, X, Zap } from 'lucide-react'

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

const SERVICE_MAP: Record<string, string> = {
  mtn_sme: 'mtn',
  mtn_datashare: 'mtn',
  mtn_gifting: 'mtn',
  mtn_awoof: 'mtn',
  glo_data: 'glo',
  glo_sme: 'glo',
  airtel_sme: 'airtel',
  airtel_gifting: 'airtel',
  etisalat_data: 'etisalat',
}

export default function ApiPricingPage() {
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
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([])
  const [formData, setFormData] = useState({
    planName: '',
    basePrice: '',
    markupType: 'fixed' as 'fixed' | 'percentage',
    markupValue: '',
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

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
    try {
      const { data } = await supabase
        .from('api_pricing_rules')
        .select('*')
        .eq('service_id', serviceId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      setRules(data || [])
    } catch {
      setRules([])
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId])

  useEffect(() => {
    fetchGsubzPlans(activePlanType)
    fetchRules()
  }, [activePlanType, fetchGsubzPlans, fetchRules])

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
      alert('Please fill in all fields')
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
    } else {
      alert('Error: ' + result.error)
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
    } else {
      alert('Error: ' + result.error)
    }
    setSubmitting(false)
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Delete this API pricing rule?')) return
    const result = await deleteApiPricingRule(ruleId)
    if (result.success) fetchRules()
    else alert('Error: ' + result.error)
  }

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bulkMarkupValue || selectedRuleIds.length === 0) {
      alert('Select rules and enter a markup value')
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
      alert(`Updated ${result.updated} rules`)
    } else {
      alert('Error: ' + result.error)
    }
    setSubmitting(false)
  }

  const toggleSelectRule = (id: string) => {
    setSelectedRuleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const planTypeLabel = currentNetwork?.types.find((t) => t.value === activePlanType)?.label || ''

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
        </div>
      </div>

      {/* Network selector */}
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

      {/* Plan type selector */}
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
        <span style={{ fontSize: 12, color: 'var(--admin-text-tertiary)' }}>
          {rules.length} rule{rules.length !== 1 ? 's' : ''}
        </span>
      </div>

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
          Bulk Update
        </button>
      </div>

      {activeTab === 'individual' && (
        <>
          {/* Gsubz live plans */}
          <div className="admin-card" style={{ marginBottom: 16 }}>
            <div className="admin-card-header">
              <h2 className="admin-card-title">Live Plans from Gsubz</h2>
              <span style={{ fontSize: 12, color: 'var(--admin-text-tertiary)' }}>
                Click a plan to auto-fill the form below
              </span>
            </div>
            <div className="admin-card-body">
              {loadingGsubz ? (
                <p style={{ color: 'var(--admin-text-tertiary)', fontSize: 13 }}>Loading plans...</p>
              ) : gsubzPlans.length === 0 ? (
                <p style={{ color: 'var(--admin-text-tertiary)', fontSize: 13 }}>No plans available</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {gsubzPlans.map((plan) => (
                    <button
                      key={plan.value}
                      type="button"
                      onClick={() => handleSelectGsubzPlan(plan)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 12 }}
                    >
                      {plan.displayName} — ₦{plan.price}
                    </button>
                  ))}
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
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={formData.markupValue}
                    onChange={(e) => setFormData({ ...formData, markupValue: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                    <Plus size={14} />
                    <span>{submitting ? 'Adding...' : 'Add Rule'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Rules table */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title">API Pricing Rules</h2>
            </div>
            {loading ? (
              <div className="admin-card-body">
                <p style={{ color: 'var(--admin-text-tertiary)', fontSize: 13 }}>Loading...</p>
              </div>
            ) : rules.length === 0 ? (
              <div className="admin-card-body">
                <p style={{ color: 'var(--admin-text-tertiary)', fontSize: 13 }}>
                  No API pricing rules yet for this service. Add one above.
                </p>
              </div>
            ) : (
              <div>
                {/* Desktop table */}
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Plan Name</th>
                        <th>Base Price</th>
                        <th>Markup</th>
                        <th>API Price</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((rule) => (
                        <tr key={rule.id}>
                          <td style={{ fontWeight: 500 }}>{rule.plan_name}</td>
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
                          <span className="data-card-amount" style={{ color: 'var(--admin-success)', fontSize: 16 }}>
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
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">Bulk Update API Prices</h2>
            <span style={{ fontSize: 12, color: 'var(--admin-text-tertiary)' }}>
              Select rules below then apply a markup to all at once
            </span>
          </div>
          <div className="admin-card-body">
            <form onSubmit={handleBulkUpdate} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
              <div style={{ flex: '1 1 120px' }}>
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
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={bulkMarkupValue}
                  onChange={(e) => setBulkMarkupValue(e.target.value)}
                  required
                />
              </div>
              <div>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={submitting || selectedRuleIds.length === 0}
                >
                  {submitting ? 'Updating...' : `Apply to ${selectedRuleIds.length} selected`}
                </button>
              </div>
            </form>

            {loading ? (
              <p style={{ color: 'var(--admin-text-tertiary)', fontSize: 13 }}>Loading...</p>
            ) : rules.length === 0 ? (
              <p style={{ color: 'var(--admin-text-tertiary)', fontSize: 13 }}>No rules yet. Switch to Individual tab to add rules.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setSelectedRuleIds(
                        selectedRuleIds.length === rules.length ? [] : rules.map((r) => r.id)
                      )
                    }
                  >
                    {selectedRuleIds.length === rules.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--admin-text-tertiary)' }}>
                    {selectedRuleIds.length} of {rules.length} selected
                  </span>
                </div>
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    onClick={() => toggleSelectRule(rule.id)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      background: selectedRuleIds.includes(rule.id)
                        ? 'var(--admin-primary-muted)'
                        : 'var(--admin-bg-secondary)',
                      border: `1px solid ${selectedRuleIds.includes(rule.id) ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--admin-text)' }}>
                        {rule.plan_name}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--admin-text-tertiary)', marginLeft: 8 }}>
                        Base: ₦{rule.base_price.toLocaleString()}
                      </span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-success)' }}>
                      ₦{calculateFinalPrice(rule).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
