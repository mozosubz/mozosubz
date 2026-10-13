'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, AlertCircle, Check, X } from 'lucide-react'
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

/** How many services the dropdown will list at once before asking the user
 *  to narrow the search. */
const MAX_OPTIONS = 300

function cleanCategory(name: string): string {
  return name.replace(/^[^\p{L}\p{N}]+/u, '').trim() || name
}

export default function SocialPage() {
  const [services, setServices] = useState<SocialService[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('')
  const [serviceValue, setServiceValue] = useState<string>('')
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

  const selected = useMemo(
    () => services.find((s) => String(s.value) === serviceValue) ?? null,
    [services, serviceValue],
  )

  const quantityNum = Number.parseInt(quantity, 10) || 0
  const unitPrice = selected ? Number(selected.price) : 0
  // GSUBZ social prices are per 1,000 units; quantity is in units.
  const total = selected ? Math.round(unitPrice * (quantityNum / 1000) * 100) / 100 : 0

  const quantityValid =
    !!selected && Number.isInteger(quantityNum) && quantityNum >= selected.min && quantityNum <= selected.max
  const linkValid = /^https?:\/\/.+/i.test(link)
  const canSubmit =
    !!selected && quantityValid && linkValid && balance !== null && balance >= total && total > 0 && !submitting

  const handleSelectService = (value: string) => {
    setServiceValue(value)
    setError(null)
    const svc = services.find((s) => String(s.value) === value)
    if (svc) setQuantity(String(svc.min))
  }

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
      setServiceValue('')
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

        {/* Order form — one card, dropdowns for category and service */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 space-y-4 mb-4">
          <div>
            <label className="form-label text-xs" htmlFor="social-category">
              Category
            </label>
            <select
              id="social-category"
              className="form-input h-11 text-sm"
              value={category}
              disabled={loading}
              onChange={(e) => {
                setCategory(e.target.value)
                setServiceValue('')
                setError(null)
              }}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label text-xs" htmlFor="social-search">
              Find a service
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-3)]" />
              <input
                id="social-search"
                type="text"
                className="form-input h-11 text-sm pl-9"
                placeholder="Search e.g. Instagram Followers"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setServiceValue('')
                }}
              />
            </div>

            <label className="form-label text-xs" htmlFor="social-service">
              Service
            </label>
            <select
              id="social-service"
              className="form-input h-11 text-sm"
              value={serviceValue}
              disabled={loading || filtered.length === 0}
              onChange={(e) => handleSelectService(e.target.value)}
            >
              <option value="">
                {loading
                  ? 'Loading services…'
                  : filtered.length === 0
                    ? 'No services match — try another search'
                    : `Select a service (${filtered.length.toLocaleString()} available)`}
              </option>
              {filtered.slice(0, MAX_OPTIONS).map((s) => (
                <option key={String(s.value)} value={String(s.value)}>
                  {s.display_name} — ₦{Number(s.price).toLocaleString()}/1,000
                </option>
              ))}
            </select>
            {filtered.length > MAX_OPTIONS && (
              <p className="text-[11px] text-[var(--text-3)] mt-1">
                Showing the first {MAX_OPTIONS} matches — type more of the name to narrow the list.
              </p>
            )}
          </div>

          {selected && (
            <>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
                <p className="text-sm font-semibold text-[var(--text-1)] leading-snug">{selected.display_name}</p>
                <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                  Min {selected.min.toLocaleString()} · Max {selected.max.toLocaleString()}
                  {selected.description ? ` · ${selected.description.split('\n')[0]}` : ''}
                </p>
              </div>

              <div>
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

              <div>
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
                  <span className="text-[var(--text-3)]">Price per 1,000</span>
                  <span className="font-semibold text-[var(--text-1)]">₦{unitPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-3)]">
                    Total for {quantityNum ? quantityNum.toLocaleString() : 0}
                  </span>
                  <span className="font-bold text-[var(--primary)]">₦{total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-3)]">Wallet balance</span>
                  <span className={`font-semibold ${balance !== null && balance < total ? 'text-[#dc2626]' : 'text-[var(--text-1)]'}`}>
                    ₦{(balance ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex gap-2.5 p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button onClick={() => setShowConfirm(true)} disabled={!canSubmit} className="btn-primary h-11 text-sm">
            {submitting ? 'Processing...' : 'Continue'}
          </button>
        </div>
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

      {/* Order placed — same anatomy as the admin transaction modal */}
      {result && (
        <>
          <div className="sheet-overlay open" onClick={() => setResult(null)} />
          <div className="bottom-sheet open" role="dialog" aria-modal="true" aria-label="Order placed">
            <div className="sheet-handle" />
            <div className="sheet-head">
              <div className="sheet-title">Order placed</div>
              <button type="button" className="sheet-close" onClick={() => setResult(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="sheet-body">
              <div className="flex items-start gap-3 mb-4">
                <span className="w-10 h-10 rounded-full bg-[#f0fdf4] text-[#16a34a] flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5" strokeWidth={2.5} />
                </span>
                <p className="text-xs text-[var(--text-3)] leading-relaxed">
                  Order received by the provider. Delivery is handled by them and starts shortly.
                </p>
              </div>

              <div className="bg-[var(--bg)] rounded-[16px] mb-3">
                <div className="confirm-row">
                  <span className="confirm-label">Service</span>
                  <span className="confirm-value">{result.service}</span>
                </div>
                <div className="confirm-row">
                  <span className="confirm-label">Quantity</span>
                  <span className="confirm-value">{result.quantity.toLocaleString()}</span>
                </div>
                <div className="confirm-row">
                  <span className="confirm-label">Charged</span>
                  <span className="confirm-amount">₦{result.amount.toLocaleString()}</span>
                </div>
                <div className="confirm-row">
                  <span className="confirm-label">Transaction ID</span>
                  <span className="confirm-value">{result.transactionId}</span>
                </div>
              </div>
            </div>
            <div className="sheet-actions">
              <button onClick={() => setResult(null)} className="btn-accent">
                Done
              </button>
            </div>
          </div>
        </>
      )}

      <ProcessingOverlay isVisible={submitting} />
    </div>
  )
}
