'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, AlertCircle, Check, Loader2, Globe, X, QrCode } from 'lucide-react'
import type { EsimCountry, EsimPackage, EsimOrder } from 'gsubz-sdk'
import { listEsimCountries, listEsimPackages, purchaseEsim, getEsimOrder } from '@/lib/actions/esim'
import { getWalletBalance } from '@/lib/actions/wallet'
import { ConfirmSheet } from '@/components/confirm-sheet'
import { ProcessingOverlay } from '@/components/processing-overlay'

function formatData(gb: number): string {
  if (gb >= 1) return `${gb % 1 === 0 ? gb : gb.toFixed(2)}GB`
  return `${Math.round(gb * 1000)}MB`
}

export default function EsimPage() {
  const [countries, setCountries] = useState<EsimCountry[]>([])
  const [countryQuery, setCountryQuery] = useState('')
  const [country, setCountry] = useState<EsimCountry | null>(null)
  const [packages, setPackages] = useState<EsimPackage[]>([])
  const [selected, setSelected] = useState<EsimPackage | null>(null)
  const [balance, setBalance] = useState<number | null>(null)

  const [loadingCountries, setLoadingCountries] = useState(true)
  const [loadingPackages, setLoadingPackages] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [order, setOrder] = useState<EsimOrder | null>(null)
  const [requestID, setRequestID] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [list, wallet] = await Promise.all([listEsimCountries(), getWalletBalance()])
        if (!active) return
        setCountries(list)
        setBalance(wallet?.balance ?? 0)
      } catch {
        if (active) setError('Failed to load eSIM countries. Please refresh.')
      } finally {
        if (active) setLoadingCountries(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  // Poll the order while the provider provisions the eSIM.
  useEffect(() => {
    if (!requestID) return
    let active = true
    let attempts = 0
    const tick = async () => {
      if (!active) return
      attempts += 1
      const fresh = await getEsimOrder(requestID)
      if (!active) return
      if (fresh) {
        setOrder(fresh)
        if (fresh.esimStatus !== 'provisioning') {
          setPolling(false)
          return
        }
      }
      if (attempts >= 12) {
        setPolling(false)
        return
      }
      setTimeout(tick, 5000)
    }
    setPolling(true)
    const id = setTimeout(tick, 3000)
    return () => {
      active = false
      clearTimeout(id)
    }
  }, [requestID])

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase()
    if (!q) return countries
    return countries.filter((c) => c.country.toLowerCase().includes(q))
  }, [countries, countryQuery])

  const selectCountry = async (c: EsimCountry) => {
    setCountry(c)
    setSelected(null)
    setPackages([])
    setError(null)
    setLoadingPackages(true)
    try {
      setPackages(await listEsimPackages(c.locationCodes))
    } catch {
      setError('Failed to load packages for this country.')
    } finally {
      setLoadingPackages(false)
    }
  }

  const price = selected?.price ?? 0
  const canSubmit = !!selected && price > 0 && balance !== null && balance >= price && !submitting

  const handleConfirm = async () => {
    if (!country || !selected) return
    setSubmitting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set('packageCode', selected.packageCode)
      formData.set('locationCode', country.locationCodes)

      const res = await purchaseEsim(formData)
      setShowConfirm(false)

      if (!res.success) {
        setError(res.message)
        return
      }

      setRequestID(String(res.transaction?.requestID ?? ''))
      setOrder({
        orderID: 0,
        packageCode: selected.packageCode,
        packageName: selected.name,
        country: selected.country,
        amountPaid: price,
        amountRefunded: 0,
        esimStatus: 'provisioning',
      })

      const wallet = await getWalletBalance()
      setBalance(wallet?.balance ?? 0)
    } catch {
      setShowConfirm(false)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const closeResult = () => {
    setOrder(null)
    setRequestID(null)
    setPolling(false)
    setSelected(null)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] overflow-y-auto flex flex-col">
      <div className="topbar">
        <Link href="/dashboard" className="flex items-center gap-2">
          <ArrowLeft style={{ width: 18, height: 18, color: 'var(--text-1)' }} />
          <span className="topbar-title">eSIM</span>
        </Link>
      </div>

      <div className="flex-1 px-4 sm:px-6 pb-32 max-w-2xl w-full mx-auto">
        <div className="mb-5">
          <h1 className="text-lg font-bold text-[var(--text-1)]">Travel data, no roaming</h1>
          <p className="text-xs text-[var(--text-3)] mt-1">
            Pick a country and a data package. Your QR code is issued right after payment.
          </p>
        </div>

        {!country ? (
          <>
            {error && (
              <div className="flex gap-2.5 p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] text-sm mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-3)]" />
              <input
                type="text"
                className="form-input h-11 text-sm pl-9"
                placeholder="Search a country"
                value={countryQuery}
                onChange={(e) => setCountryQuery(e.target.value)}
              />
            </div>

            {loadingCountries ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden divide-y divide-[var(--border)]">
                {filteredCountries.length === 0 ? (
                  <p className="p-4 text-sm text-[var(--text-3)]">No countries match that search.</p>
                ) : (
                  filteredCountries.map((c) => (
                    <button
                      key={`${c.country}-${c.locationCodes}`}
                      onClick={() => selectCountry(c)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--bg)] transition"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center flex-shrink-0">
                          <Globe className="w-4 h-4" />
                        </span>
                        <span className="text-sm font-semibold text-[var(--text-1)] truncate">{c.country}</span>
                      </span>
                      <span className="text-[11px] text-[var(--text-3)] flex-shrink-0">{c.plans} plans</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </span>
                <span className="text-sm font-bold text-[var(--text-1)]">{country.country}</span>
              </div>
              <button
                onClick={() => {
                  setCountry(null)
                  setSelected(null)
                  setPackages([])
                }}
                className="text-xs font-semibold text-[var(--primary)] flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Change
              </button>
            </div>

            {loadingPackages ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
                ))}
              </div>
            ) : packages.length === 0 ? (
              <p className="text-sm text-[var(--text-3)]">No packages available for this country right now.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {packages.map((p) => {
                  const active = selected?.packageCode === p.packageCode
                  return (
                    <button
                      key={p.packageCode}
                      onClick={() => setSelected(p)}
                      className={`w-full flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition ${
                        active
                          ? 'border-[var(--primary)] bg-[var(--primary-light)]'
                          : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--text-1)]">
                          {formatData(p.dataGB)} · {p.duration} {p.durationUnit.toLowerCase()}
                          {p.duration > 1 ? 's' : ''}
                        </p>
                        <p className="text-[11px] text-[var(--text-3)] mt-0.5 truncate">{p.name}</p>
                      </div>
                      <span className="text-sm font-bold text-[var(--primary)] flex-shrink-0">
                        ₦{Number(p.price).toLocaleString()}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {selected && (
              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 mb-4 text-sm space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-[var(--text-3)]">Package</span>
                  <span className="font-semibold text-[var(--text-1)] text-right">{selected.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-3)]">Price</span>
                  <span className="font-semibold text-[var(--text-1)]">₦{price.toLocaleString()}</span>
                </div>
                <div className="border-t border-[var(--border)] pt-2.5 flex justify-between">
                  <span className="text-[var(--text-3)]">Wallet balance</span>
                  <span className={`font-semibold ${balance !== null && balance < price ? 'text-[#dc2626]' : 'text-[var(--text-1)]'}`}>
                    ₦{(balance ?? 0).toLocaleString()}
                  </span>
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
          </>
        )}
      </div>

      <ConfirmSheet
        show={showConfirm}
        title="Confirm eSIM Purchase"
        details={[
          { label: 'Country', value: country?.country ?? '' },
          { label: 'Package', value: selected?.name ?? '' },
          { label: 'Amount', value: `₦${price.toLocaleString()}` },
          { label: 'Balance After', value: `₦${((balance ?? 0) - price).toLocaleString()}` },
        ]}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
        loading={submitting}
      />

      {order && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-[var(--surface)] rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-[#f0fdf4] text-[#16a34a] flex items-center justify-center">
                <Check className="w-5 h-5" strokeWidth={2.5} />
              </span>
              <div>
                <h2 className="text-base font-bold text-[var(--text-1)]">eSIM purchased</h2>
                <p className="text-xs text-[var(--text-3)]">{order.packageName}</p>
              </div>
            </div>

            {order.esimStatus === 'provisioning' ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-5 flex flex-col items-center gap-2 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
                <p className="text-sm font-semibold text-[var(--text-1)]">Preparing your eSIM</p>
                <p className="text-[11px] text-[var(--text-3)]">
                  {polling
                    ? 'This usually takes under a minute. Keep this open — the QR code appears automatically.'
                    : 'Still provisioning. Check your transaction history shortly for the QR code.'}
                </p>
              </div>
            ) : order.qrCodeUrl ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={order.qrCodeUrl}
                  alt="eSIM activation QR code"
                  className="w-44 h-44 rounded-xl bg-white p-2"
                  crossOrigin="anonymous"
                />
                <p className="text-[11px] text-[var(--text-3)] text-center">
                  Scan this in your phone settings to install the eSIM.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 flex items-center gap-3">
                <QrCode className="w-5 h-5 text-[var(--text-3)]" />
                <p className="text-xs text-[var(--text-3)]">
                  Your QR code is not ready yet. It will appear in your transaction history shortly.
                </p>
              </div>
            )}

            {(order.iccid || order.activationCode) && (
              <div className="text-xs space-y-2">
                {order.iccid && (
                  <div className="flex justify-between gap-3">
                    <span className="text-[var(--text-3)]">ICCID</span>
                    <span className="font-mono font-semibold text-[var(--text-1)] break-all text-right">{order.iccid}</span>
                  </div>
                )}
                {order.activationCode && (
                  <div className="flex justify-between gap-3">
                    <span className="text-[var(--text-3)]">Activation code</span>
                    <span className="font-mono font-semibold text-[var(--text-1)] break-all text-right">
                      {order.activationCode}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button onClick={closeResult} className="btn-primary h-11 text-sm">
              Done
            </button>
          </div>
        </div>
      )}

      <ProcessingOverlay isVisible={submitting} />
    </div>
  )
}
