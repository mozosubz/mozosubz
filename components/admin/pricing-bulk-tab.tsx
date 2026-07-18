'use client'

import { useState } from 'react'
import { createPricingRule, updatePricingRule, deletePricingRule } from '@/lib/actions/pricing'
import { Plus, Trash2 } from 'lucide-react'

interface PricingRule {
  id: string
  plan_name: string
  base_price: number
  markup_type: 'fixed' | 'percentage'
  markup_value: number
}

interface GsubzPlan {
  value: string
  displayName: string
  price: string
}

interface PricingBulkTabProps {
  rules: PricingRule[]
  gsubzPlans: GsubzPlan[]
  serviceId: string
  calculateFinalPrice: (rule: any) => number
  onSuccess: () => void
}

export function PricingBulkTab({
  rules,
  gsubzPlans,
  serviceId,
  calculateFinalPrice,
  onSuccess,
}: PricingBulkTabProps) {
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set())
  const [bulkFormData, setBulkFormData] = useState({
    markupType: 'fixed' as 'fixed' | 'percentage',
    markupValue: '',
    operationType: 'set' as 'set' | 'add' | 'subtract',
  })
  const [submitting, setSubmitting] = useState(false)

  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set())
  const [bulkEditMarkupType, setBulkEditMarkupType] = useState<'fixed' | 'percentage'>('fixed')
  const [bulkEditMarkupValue, setBulkEditMarkupValue] = useState('')
  const [bulkEditOperationType, setBulkEditOperationType] = useState<'set' | 'add' | 'subtract'>('set')

  const togglePlanSelect = (planValue: string) => {
    const next = new Set(selectedPlans)
    next.has(planValue) ? next.delete(planValue) : next.add(planValue)
    setSelectedPlans(next)
  }

  const toggleSelectAllPlans = () => {
    setSelectedPlans(
      selectedPlans.size === gsubzPlans.length ? new Set() : new Set(gsubzPlans.map((p) => p.value))
    )
  }

  const toggleRuleSelect = (ruleId: string) => {
    const next = new Set(selectedRules)
    next.has(ruleId) ? next.delete(ruleId) : next.add(ruleId)
    setSelectedRules(next)
  }

  const toggleSelectAllRules = () => {
    setSelectedRules(
      selectedRules.size === rules.length ? new Set() : new Set(rules.map((r) => r.id))
    )
  }

  const handleBulkCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedPlans.size === 0) return alert('Please select at least one plan')
    if (!bulkFormData.markupValue) return alert('Please enter a markup value')
    if (!confirm(`Create ${selectedPlans.size} pricing rule(s)?`)) return

    setSubmitting(true)
    const plansToCreate = Array.from(selectedPlans)
      .map((value) => gsubzPlans.find((p) => p.value === value))
      .filter(Boolean) as GsubzPlan[]

    try {
      const results = await Promise.all(
        plansToCreate.map((plan) =>
          createPricingRule(
            serviceId,
            plan.displayName,
            parseFloat(plan.price),
            bulkFormData.markupType,
            parseFloat(bulkFormData.markupValue)
          )
        )
      )
      const successful = results.filter((r) => r.success).length
      alert(`Created ${successful}/${plansToCreate.length} rules`)
      if (successful === plansToCreate.length) {
        setSelectedPlans(new Set())
        setBulkFormData({ markupType: 'fixed', markupValue: '' })
        onSuccess()
      }
    } catch (error) {
      alert('Error creating rules: ' + String(error))
    }
    setSubmitting(false)
  }

  const handleBulkUpdate = async () => {
    if (selectedRules.size === 0) return alert('Please select at least one rule')
    if (!bulkEditMarkupValue) return alert('Please enter a markup value')
    if (!confirm(`Update markup for ${selectedRules.size} rule(s)?`)) return

    setSubmitting(true)
    try {
      const results = await Promise.all(
        Array.from(selectedRules).map((ruleId) => {
          const rule = rules.find((r) => r.id === ruleId)
          if (!rule) return Promise.resolve({ success: false })
          return updatePricingRule(ruleId, {
            markupType: bulkEditMarkupType,
            markupValue: parseFloat(bulkEditMarkupValue),
          })
        })
      )
      const successful = results.filter((r) => r.success).length
      alert(`Updated ${successful}/${selectedRules.size} rules`)
      if (successful === selectedRules.size) {
        setSelectedRules(new Set())
        setBulkEditMarkupValue('')
        onSuccess()
      }
    } catch (error) {
      alert('Error updating rules: ' + String(error))
    }
    setSubmitting(false)
  }

  const handleBulkDelete = async () => {
    if (selectedRules.size === 0) return alert('Please select at least one rule')
    if (!confirm(`Delete ${selectedRules.size} rule(s)? This cannot be undone.`)) return

    setSubmitting(true)
    try {
      const results = await Promise.all(
        Array.from(selectedRules).map((ruleId) => deletePricingRule(ruleId))
      )
      const successful = results.filter((r) => r.success).length
      alert(`Deleted ${successful}/${selectedRules.size} rules`)
      if (successful === selectedRules.size) {
        setSelectedRules(new Set())
        onSuccess()
      }
    } catch (error) {
      alert('Error deleting rules: ' + String(error))
    }
    setSubmitting(false)
  }

  return (
    <div>
      {/* CREATE RULES — Plan selector */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3>Bulk Create Markup Rules</h3>
            <p className="admin-card-subtitle">{selectedPlans.size} plan(s) selected out of {gsubzPlans.length}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={toggleSelectAllPlans}
              className="btn btn-secondary btn-sm"
              disabled={gsubzPlans.length === 0}
            >
              {selectedPlans.size === gsubzPlans.length && gsubzPlans.length > 0
                ? 'Deselect All'
                : selectedPlans.size > 0
                  ? 'Select Remaining'
                  : 'Select All'}
            </button>
          </div>
        </div>

        {/* Plans list */}
        <div
          style={{
            border: '1px solid var(--admin-border)',
            borderRadius: 'var(--radius-md)',
            maxHeight: 280,
            overflowY: 'auto',
            marginBottom: 14,
            background: 'var(--admin-bg)',
          }}
        >
          {gsubzPlans.length === 0 ? (
            <p style={{ padding: 16, textAlign: 'center', color: 'var(--admin-text-tertiary)', fontSize: 13 }}>
              No plans available
            </p>
          ) : (
            gsubzPlans.map((plan) => (
              <label
                key={plan.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--admin-border)',
                  cursor: 'pointer',
                  background: selectedPlans.has(plan.value) ? 'rgba(14, 165, 233, 0.08)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedPlans.has(plan.value)}
                  onChange={() => togglePlanSelect(plan.value)}
                  style={{ flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--admin-text)' }}>
                    {plan.displayName}
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'var(--admin-text-tertiary)' }}>
                    ₦{Number(plan.price).toLocaleString()}
                  </p>
                </div>
              </label>
            ))
          )}
        </div>

        <form onSubmit={handleBulkCreate}>
          <div className="form-row">
            <div className="form-group">
              <label>Markup Type</label>
              <select
                value={bulkFormData.markupType}
                onChange={(e) =>
                  setBulkFormData({ ...bulkFormData, markupType: e.target.value as 'fixed' | 'percentage' })
                }
                disabled={submitting}
              >
                <option value="fixed">Fixed Amount (₦)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Markup Value (use - for discount)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={bulkFormData.markupValue}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, markupValue: e.target.value })}
                  disabled={submitting}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const current = parseFloat(bulkFormData.markupValue) || 0
                    const step = bulkFormData.markupType === 'percentage' ? 1 : 50
                    setBulkFormData({ ...bulkFormData, markupValue: String(current - step) })
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
                    const current = parseFloat(bulkFormData.markupValue) || 0
                    const step = bulkFormData.markupType === 'percentage' ? 1 : 50
                    setBulkFormData({ ...bulkFormData, markupValue: String(current + step) })
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
              <p style={{ margin: '4px 0 0 0', fontSize: 11, color: 'var(--admin-text-tertiary)' }}>
                Negative value = discount (e.g. -50 or -10%). Use − / + buttons to adjust quickly.
              </p>
            </div>
          </div>

          {/* Operation type selector */}
          <div style={{ marginTop: 12, marginBottom: 14 }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 600, color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>
              Operation
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['set', 'add', 'subtract'] as const).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setBulkFormData({ ...bulkFormData, operationType: op })}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    border: '1px solid var(--admin-border)',
                    borderRadius: 'var(--radius-sm)',
                    background: bulkFormData.operationType === op ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                    color: bulkFormData.operationType === op ? 'var(--admin-secondary)' : 'var(--admin-text)',
                    cursor: 'pointer',
                  }}
                >
                  {op === 'set' ? 'Set to' : op === 'add' ? 'Add +' : 'Subtract −'}
                </button>
              ))}
            </div>
          </div>

          {/* Quick preset buttons */}
          <div style={{ marginTop: 12, marginBottom: 14 }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 600, color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>
              Quick presets
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {bulkFormData.markupType === 'percentage' ? (
                <>
                  {[5, 10, 15, 20, 25, 30].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBulkFormData({ ...bulkFormData, markupValue: String(val) })}
                      style={{
                        padding: '6px 10px',
                        fontSize: 12,
                        fontWeight: 500,
                        border: '1px solid var(--admin-border)',
                        borderRadius: 'var(--radius-sm)',
                        background: bulkFormData.markupValue === String(val) ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                        color: bulkFormData.markupValue === String(val) ? 'var(--admin-secondary)' : 'var(--admin-text)',
                        cursor: 'pointer',
                      }}
                    >
                      {bulkFormData.operationType === 'set' ? '' : bulkFormData.operationType === 'add' ? '+' : '−'}{val}%
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {[50, 100, 200, 500, 1000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBulkFormData({ ...bulkFormData, markupValue: String(val) })}
                      style={{
                        padding: '6px 10px',
                        fontSize: 12,
                        fontWeight: 500,
                        border: '1px solid var(--admin-border)',
                        borderRadius: 'var(--radius-sm)',
                        background: bulkFormData.markupValue === String(val) ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                        color: bulkFormData.markupValue === String(val) ? 'var(--admin-secondary)' : 'var(--admin-text)',
                        cursor: 'pointer',
                      }}
                    >
                      {bulkFormData.operationType === 'set' ? '+₦' : bulkFormData.operationType === 'add' ? '+₦' : '−₦'}{val}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Preview of what will be created */}
          {bulkFormData.markupValue && selectedPlans.size > 0 && (
            <div
              style={{
                padding: 12,
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 12,
              }}
            >
              <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: 'var(--admin-success)' }}>
                Preview of {selectedPlans.size} rule(s) to be created
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto', paddingRight: 8 }}>
                {Array.from(selectedPlans)
                  .map((value) => gsubzPlans.find((p) => p.value === value))
                  .filter(Boolean)
                  .map((plan) => {
                    if (!plan) return null
                    const basePrice = parseFloat(plan.price)
                    const markupVal = parseFloat(bulkFormData.markupValue)
                    let finalPrice = basePrice
                    if (bulkFormData.markupType === 'fixed') {
                      if (bulkFormData.operationType === 'set') finalPrice = basePrice + markupVal
                      else if (bulkFormData.operationType === 'add') finalPrice = basePrice + markupVal
                      else finalPrice = basePrice - markupVal
                    } else {
                      if (bulkFormData.operationType === 'set') finalPrice = basePrice * (1 + markupVal / 100)
                      else if (bulkFormData.operationType === 'add') finalPrice = basePrice * (1 + markupVal / 100)
                      else finalPrice = basePrice * (1 - markupVal / 100)
                    }
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
                        <p style={{ margin: '6px 0 0 0', color: 'var(--admin-text-secondary)', fontSize: 10 }}>
                          Base: <span style={{ fontWeight: 600 }}>₦{basePrice.toLocaleString()}</span>
                        </p>
                        <p style={{ margin: '2px 0 0 0', color: 'var(--admin-success)', fontSize: 10 }}>
                          Final: <span style={{ fontWeight: 600 }}>₦{Math.round(finalPrice).toLocaleString()}</span>
                        </p>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || selectedPlans.size === 0}
            className="btn btn-block"
          >
            {submitting ? (
              <>
                <div className="loading-spinner" />
                <span>Creating {selectedPlans.size}...</span>
              </>
            ) : (
              <>
                <Plus size={16} />
                <span>Create {selectedPlans.size} Rules</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* EDIT/DELETE RULES SECTION */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3>Bulk Edit / Delete</h3>
            <p className="admin-card-subtitle">{selectedRules.size} rule(s) selected out of {rules.length}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={toggleSelectAllRules}
              className="btn btn-secondary btn-sm"
              disabled={rules.length === 0}
            >
              {selectedRules.size === rules.length && rules.length > 0
                ? 'Deselect All'
                : selectedRules.size > 0
                  ? 'Select Remaining'
                  : 'Select All'}
            </button>
            {selectedRules.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleBulkUpdate}
                  disabled={submitting || !bulkEditMarkupValue}
                  className="btn btn-success btn-sm"
                >
                  Update {selectedRules.size}
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={submitting}
                  className="btn btn-danger btn-sm"
                >
                  Delete {selectedRules.size}
                </button>
              </>
            )}
          </div>
        </div>

        {selectedRules.size > 0 && (
          <div
            style={{
              padding: 14,
              background: 'var(--admin-info-bg)',
              border: '1px solid var(--admin-info-border)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 14,
            }}
          >
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Markup Type</label>
                <select
                  value={bulkEditMarkupType}
                  onChange={(e) => setBulkEditMarkupType(e.target.value as 'fixed' | 'percentage')}
                  disabled={submitting}
                >
                  <option value="fixed">Fixed Amount (₦)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Operation</label>
                <select
                  value={bulkEditOperationType}
                  onChange={(e) => setBulkEditOperationType(e.target.value as 'set' | 'add' | 'subtract')}
                  disabled={submitting}
                >
                  <option value="set">Set to value</option>
                  <option value="add">Add to current</option>
                  <option value="subtract">Subtract from current</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Value</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    value={bulkEditMarkupValue}
                    onChange={(e) => setBulkEditMarkupValue(e.target.value)}
                    disabled={submitting}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseFloat(bulkEditMarkupValue) || 0
                      const step = bulkEditMarkupType === 'percentage' ? 1 : 50
                      setBulkEditMarkupValue(String(current - step))
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
                      const current = parseFloat(bulkEditMarkupValue) || 0
                      const step = bulkEditMarkupType === 'percentage' ? 1 : 50
                      setBulkEditMarkupValue(String(current + step))
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

            {/* Quick presets for bulk edit */}
            <div style={{ marginTop: 12, marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 600, color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>
                Quick presets
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {bulkEditMarkupType === 'percentage' ? (
                  <>
                    {[5, 10, 15, 20, 25, 30].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setBulkEditMarkupValue(String(val))}
                        style={{
                          padding: '6px 10px',
                          fontSize: 12,
                          fontWeight: 500,
                          border: '1px solid var(--admin-border)',
                          borderRadius: 'var(--radius-sm)',
                          background: bulkEditMarkupValue === String(val) ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                          color: bulkEditMarkupValue === String(val) ? 'var(--admin-secondary)' : 'var(--admin-text)',
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
                        onClick={() => setBulkEditMarkupValue(String(val))}
                        style={{
                          padding: '6px 10px',
                          fontSize: 12,
                          fontWeight: 500,
                          border: '1px solid var(--admin-border)',
                          borderRadius: 'var(--radius-sm)',
                          background: bulkEditMarkupValue === String(val) ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                          color: bulkEditMarkupValue === String(val) ? 'var(--admin-secondary)' : 'var(--admin-text)',
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

            {/* Preview of changes */}
            {bulkEditMarkupValue && selectedRules.size > 0 && (
              <div
                style={{
                  padding: 12,
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 12,
                }}
              >
                <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: 'var(--admin-success)' }}>
                  Preview of changes ({bulkEditOperationType} mode)
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
                  {Array.from(selectedRules)
                    .map((ruleId) => rules.find((r) => r.id === ruleId))
                    .filter(Boolean)
                    .map((rule) => {
                      if (!rule) return null
                      const markupVal = parseFloat(bulkEditMarkupValue)
                      const oldPrice = rule.base_price + (rule.markup_type === 'fixed' ? rule.markup_value : rule.base_price * (rule.markup_value / 100))
                      let newFinalPrice = oldPrice
                      if (bulkEditMarkupType === 'fixed') {
                        if (bulkEditOperationType === 'set') newFinalPrice = rule.base_price + markupVal
                        else if (bulkEditOperationType === 'add') newFinalPrice = oldPrice + markupVal
                        else newFinalPrice = oldPrice - markupVal
                      } else {
                        if (bulkEditOperationType === 'set') newFinalPrice = rule.base_price * (1 + markupVal / 100)
                        else if (bulkEditOperationType === 'add') newFinalPrice = oldPrice * (1 + markupVal / 100)
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
        )}

        {/* Rules list */}
        {rules.length === 0 ? (
          <div className="empty-state">
            <h3>No rules yet</h3>
            <p>Create some pricing rules to manage them in bulk</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rules.map((rule) => {
                const checked = selectedRules.has(rule.id)
                const finalPrice = calculateFinalPrice(rule)
                return (
                  <label
                    key={rule.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      background: checked ? 'rgba(14, 165, 233, 0.08)' : 'var(--admin-bg-tertiary)',
                      border: `1px solid ${checked ? 'var(--admin-secondary)' : 'var(--admin-border)'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRuleSelect(rule.id)}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--admin-text)' }}>
                        {rule.plan_name}
                      </p>
                      <p
                        style={{
                          margin: '4px 0 0 0',
                          fontSize: 12,
                          color: 'var(--admin-text-tertiary)',
                          display: 'flex',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>Base: ₦{rule.base_price.toLocaleString()}</span>
                        <span>·</span>
                        <span>
                          Markup: {rule.markup_type === 'fixed' ? '+₦' : '+'}
                          {rule.markup_value}
                          {rule.markup_type === 'percentage' ? '%' : ''}
                        </span>
                      </p>
                    </div>
                    <div
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontWeight: 700,
                        color: 'var(--admin-success)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ₦{finalPrice.toLocaleString()}
                    </div>
                  </label>
                )
              })}
            </div>
        )}
      </div>
    </div>
  )
}
