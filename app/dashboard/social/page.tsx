'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, AlertCircle, Check, TrendingUp } from 'lucide-react'
import { listSocialServices, purchaseSocial } from '@/lib/actions/social'
import { getWalletBalance } from '@/lib/actions/wallet'
import { ConfirmSheet } from '@/components/confirm-sheet'
import { ProcessingOverlay } from '@/components/processing-overlay'

interface SocialService {
  value: number | string
  category: string
  min: number
  max: number
  price: string
  display_name: string
  description?: string
}

const MAX_VISIBLE = 120

function cleanCategory(name: string): string {
  return name.replace(/^[^\p{L}\p{N}]+/u, '').trim() || name
}

export default function SocialPage() {
  const [services, setServices] = useState<SocialService[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [selected, setSelected] = useState<SocialService | null>(null)
  const [quantity, setQuantity] = useState('')
  const [link, setLink] = useState('')
  const [balance, setBalance] = useState<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ service: string; quantity: number; amount: number; transactionId: string } | null>(
    null,
  )

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [list, wallet] = await Promise.all([listSocialServices(), getWalletBalance()])
        if (!active) return
        setServices(list)
        setBalance(wallet?.balance ?? 0)
      } catch {
        if (active) setError('Failed to load services. Please refresh.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const categories = useMemo(() => {
    const seen = new Set<string>()
    for (const s of services) seen.add(cleanCategory(s.category))
    return Array.from(seen)
  }, [services])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return services.filter((s) => {
      if (category && cleanCategory(s.category) !== category) return false
      if (!q) return true
      return s.display_name.toLowerCase().includes(q) || cleanCategory(s.category).toLowerCase().includes(q)
    })
  }, [services, query, category])

  const quantityNum = Number.parseInt(quantity, 10) || 0
  const unitPrice = selected ? Number(selected.price) : 0
  const total = selected ? Math.round(unitPrice * quantityNum * 100) / 100 : 0

  const quantityValid =
    !!selected && Number.isInteger(quantityNum) && quantityNum >= selected.min && quantityNum <= selected.max
  const linkValid = /^https?:\/\/.+/i.test(link)
  const canSubmit =
    !!selected && quantityValid && linkValid && balance !== null && balance >= total && total > 0 && !submitting

  const handleConfirm = async () => {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set('service', String(selected.value))
      formData.set('link', link)
      formData.set('quantity', String(quantityNum))

      const res = await purchaseSocial(formData)
      setShowConfirm(false)

      if (!res.success) {
        setError(res.message)
        return
      }

      setResult({
        service: selected.display_name,
        quantity: quantityNum,
        amount: total,
        transactionId: String(res.transaction?.id ?? ''),
      })
      setSelected(null)
      setQuantity('')
      setLink('')

      const wallet = await getWalletBalance()
      setBalance(wallet?.balance ?? 0)
    } catch {
      setShowConfirm(false)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] overflow-y-auto flex flex-col">
      <div className="topbar">
        <Link href="/dashboard" className="flex items-center gap-2">
          <ArrowLeft style={{ width: 18, height: 18, color: 'var(--text-1)' }} />
          <span className="topbar-title">Social Media</span>
        </Link>
      </div>

      <div className="flex-1 px-4 sm:px-6 pb-32 max-w-2xl w-full mx-auto">
        <div className="mb-5">
          <h1 className="text-lg font-bold text-[var(--text-1)]">Grow your socials</h1>
          <p className="text-xs text-[var(--text-3)] mt-1">
            Followers, likes, views and more for Instagram, TikTok, X and YouTube.
          </p>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-3)]" />
          <input
            type="text"
            className="form-input h-11 text-sm pl-9"
            placeholder="Search a service"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setCategory(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                category === null
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--surface)] text-[var(--text-2)] border border-[var(--border)]'
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  category === c
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--surface)] text-[var(--text-2)] border border-[var(--border)]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--text-3)]">No services match that search.</p>
        ) : (
          <div className="space-y-2 mb-4 max-h-[420px] overflow-y-auto pr-1">
            {filtered.slice(0, MAX_VISIBLE).map((s) => {
              const active = selected?.value === s.value
              return (
                <button
                  key={String(s.value)}
                  onClick={() => {
                    setSelected(s)
                    setQuantity(String(s.min))
                    setError(null)
                  }}
                  className={`w-full flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition ${
                    active
                      ? 'border-[var(--primary)] bg-[var(--primary-light)]'
                      : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/40'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-1)] leading-snug">{s.display_name}</p>
                    <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                      Min {s.min.toLocaleString()} · Max {s.max.toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[var(--primary)] flex-shrink-0">
                    ₦{Number(s.price).toLocaleString()}
                    <span className="block text-[10px] font-medium text-[var(--text-3)] text-right">per unit</span>
                  </span>
                </button>
              )
            })}
            {filtered.length > MAX_VISIBLE && (
              <p className="text-[11px] text-[var(--text-3)] text-center py-2">
                Showing {MAX_VISIBLE} of {filtered.length}. Refine your search to see more.
              </p>
            )}
          </div>
        )}

        {selected && (
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 mb-4 space-y-3">
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--primary)] flex-shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-[var(--text-1)] leading-snug">{selected.display_name}</p>
            </div>

            <div className="form-group mb-0">
              <div className="flex items-center justify-between mb-1.5">
                <label className="form-label text-xs mb-0" htmlFor="social-qty">
                  Quantity
                </label>
                <span className="text-[11px] text-[var(--text-3)]">
                  {selected.min.toLocaleString()} – {selected.max.toLocaleString()}
                </span>
              </div>
              <input
                id="social-qty"
                type="number"
                inputMode="numeric"
                className="form-input h-11 text-sm"
                value={quantity}
                min={selected.min}
                max={selected.max}
                onChange={(e) => {
                  setQuantity(e.target.value)
                  setError(null)
                }}
              />
              {quantity && !quantityValid && (
                <p className="text-[11px] text-[#dc2626] mt-1">
                  Enter a quantity between {selected.min.toLocaleString()} and {selected.max.toLocaleString()}
                </p>
              )}
            </div>

            <div className="form-group mb-0">
              <label className="form-label text-xs" htmlFor="social-link">
                Link
              </label>
              <input
                id="social-link"
                type="url"
                className="form-input h-11 text-sm"
                placeholder="https://instagram.com/yourhandle"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value)
                  setError(null)
                }}
              />
              <p className="text-[11px] text-[var(--text-3)] mt-1">
                The profile or post URL the order should be delivered to.
              </p>
              {link && !linkValid && <p className="text-[11px] text-[#dc2626] mt-1">Enter a valid link</p>}
            </div>

            <div className="border-t border-[var(--border)] pt-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-[var(--text-3)]">Unit price</span>
                <span className="font-semibold text-[var(--text-1)]">₦{unitPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-3)]">Total</span>
                <span className="font-bold text-[var(--primary)]">₦{total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-3)]">Wallet balance</span>
                <span className={`font-semibold ${balance !== null && balance < total ? 'text-[#dc2626]' : 'text-[var(--text-1)]'}`}>
                  ₦{(balance ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex gap-2.5 p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button onClick={() => setShowConfirm(true)} disabled={!canSubmit} className="btn-primary h-11 text-sm">
          {submitting ? 'Processing...' : 'Continue'}
        </button>
      </div>

      <ConfirmSheet
        show={showConfirm}
        title="Confirm Social Order"
        details={[
          { label: 'Service', value: selected?.display_name ?? '' },
          { label: 'Quantity', value: quantityNum.toLocaleString() },
          { label: 'Link', value: link },
          { label: 'Amount', value: `₦${total.toLocaleString()}` },
          { label: 'Balance After', value: `₦${((balance ?? 0) - total).toLocaleString()}` },
        ]}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
        loading={submitting}
      />

      {result && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-[var(--surface)] rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-[#f0fdf4] text-[#16a34a] flex items-center justify-center">
                <Check className="w-5 h-5" strokeWidth={2.5} />
              </span>
              <div>
                <h2 className="text-base font-bold text-[var(--text-1)]">Order placed</h2>
                <p className="text-xs text-[var(--text-3)]">
                  Order received by the provider. Delivery is handled by them and starts shortly.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 text-sm space-y-2">
              <div className="flex justify-between gap-3">
                <span className="text-[var(--text-3)]">Service</span>
                <span className="font-semibold text-[var(--text-1)] text-right">{result.service}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-3)]">Quantity</span>
                <span className="font-semibold text-[var(--text-1)]">{result.quantity.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-3)]">Charged</span>
                <span className="font-bold text-[var(--primary)]">₦{result.amount.toLocaleString()}</span>
              </div>
            </div>

            <div className="text-xs flex justify-between gap-3">
              <span className="text-[var(--text-3)]">Transaction ID</span>
              <span className="font-mono font-semibold text-[var(--text-1)] break-all text-right">{result.transactionId}</span>
            </div>

            <button onClick={() => setResult(null)} className="btn-primary h-11 text-sm">
              Done
            </button>
          </div>
        </div>
      )}

      <ProcessingOverlay isVisible={submitting} />
    </div>
  )
}
