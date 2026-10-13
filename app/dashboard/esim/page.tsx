'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, AlertCircle, Loader2, Globe, QrCode } from 'lucide-react'
import type { EsimCountry, EsimPackage, EsimOrder } from 'gsubz-sdk'
import { listEsimCountries, listEsimPackages, purchaseEsim, getEsimOrder } from '@/lib/actions/esim'
import { getWalletBalance } from '@/lib/actions/wallet'
import { ConfirmSheet } from '@/components/confirm-sheet'
import { SuccessSheet } from "@/components/success-sheet"
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
            Pick a country and a data package — no phone number needed. The QR code arrives as soon as the eSIM is
            issued, usually instantly.
          </p>
        </div>

        {/* Order form — one card, dropdowns for country and package (same layout as Social Media) */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 space-y-4 mb-4">
          <div>
            <label className="form-label text-xs" htmlFor="esim-search">
              Find a country
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-3)]" />
              <input
                id="esim-search"
                type="text"
                className="form-input h-11 text-sm pl-9"
                placeholder="Search e.g. United States"
                value={countryQuery}
                onChange={(e) => {
                  setCountryQuery(e.target.value)
                  setCountry(null)
                  setSelected(null)
                  setPackages([])
                }}
              />
            </div>

            <label className="form-label text-xs" htmlFor="esim-country">
              Country
            </label>
            <select
              id="esim-country"
              className="form-input h-11 text-sm"
              value={country?.locationCodes ?? ''}
              disabled={loadingCountries || filteredCountries.length === 0}
              onChange={(e) => {
                const c = countries.find((x) => x.locationCodes === e.target.value)
                if (c) void selectCountry(c)
              }}
            >
              <option value="">
                {loadingCountries
                  ? 'Loading countries…'
                  : filteredCountries.length === 0
                    ? 'No countries match — try another search'
                    : `Select a country (${filteredCountries.length.toLocaleString()} available)`}
              </option>
              {filteredCountries.map((c) => (
                <option key={`${c.country}-${c.locationCodes}`} value={c.locationCodes}>
                  {c.country} — {c.plans} plans
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label text-xs" htmlFor="esim-package">
              Package
            </label>
            <select
              id="esim-package"
              className="form-input h-11 text-sm"
              value={selected?.packageCode ?? ''}
              disabled={!country || loadingPackages || packages.length === 0}
              onChange={(e) => {
                const pk = packages.find((x) => x.packageCode === e.target.value)
                setSelected(pk ?? null)
                setError(null)
              }}
            >
              <option value="">
                {!country
                  ? 'Pick a country first'
                  : loadingPackages
                    ? 'Loading packages…'
                    : packages.length === 0
                      ? 'No packages available right now'
                      : `Select a package (${packages.length} available)`}
              </option>
              {packages.map((pk) => (
                <option key={pk.packageCode} value={pk.packageCode}>
                  {pk.name} — ₦{pk.price.toLocaleString()}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--text-3)] mt-1">
              The final price is confirmed at purchase and may differ slightly from the listed price.
            </p>
          </div>

          {selected && (
            <>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
                <div className="flex items-start gap-2">
                  <Globe className="w-4 h-4 text-[var(--primary)] flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-1)] leading-snug">{selected.name}</p>
                    <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                      {selected.country} · {formatData(selected.dataGB)} · {selected.duration} {selected.durationUnit}
                      {selected.refundable ? ' · Refundable' : ''}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-3 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--text-3)]">Price</span>
                  <span className="font-semibold text-[var(--text-1)]">₦{price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-3)]">Wallet balance</span>
                  <span className={`font-semibold ${balance !== null && balance < price ? 'text-[#dc2626]' : 'text-[var(--text-1)]'}`}>
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

      <SuccessSheet
        show={!!order}
        title="eSIM purchased"
        subtitle={order?.packageName ? `${order.packageName} — scan or enter the details below on your phone.` : undefined}
        viewHistory
        details={
          order
            ? [
                ...(order.iccid ? [{ label: 'ICCID', value: order.iccid }] : []),
                ...(order.activationCode ? [{ label: 'Activation code', value: order.activationCode }] : []),
              ]
            : []
        }
        onDone={closeResult}
      >
        {order && (
          <>
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
          </>
        )}
      </SuccessSheet>

      <ProcessingOverlay isVisible={submitting} />
    </div>
  )
}
