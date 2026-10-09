'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, Copy, Check, GraduationCap, ShieldCheck } from 'lucide-react'
import { ConfirmSheet } from '@/components/confirm-sheet'
import { ProcessingOverlay } from '@/components/processing-overlay'
import { purchaseExamPin, getExamPinPrices, type ExamBoardOption } from '@/lib/actions/exam-pins'
import { getWalletBalance } from '@/lib/actions/wallet'

interface ExamResult {
  pin: string
  board: string
  amount: number
  transactionId: string
}

export default function ExamPinsPage() {
  const [boards, setBoards] = useState<ExamBoardOption[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [balance, setBalance] = useState<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExamResult | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [prices, wallet] = await Promise.all([getExamPinPrices(), getWalletBalance()])
        if (!active) return
        setBoards(prices)
        setBalance(wallet?.balance ?? 0)
      } catch {
        if (active) setError('Failed to load exam pin prices. Please refresh.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const board = boards.find((b) => b.id === selected) ?? null
  const price = board?.price ?? 0
  const phoneValid = /^0\d{10}$/.test(phone)
  const canSubmit = !!board && price > 0 && phoneValid && balance !== null && balance >= price && !submitting

  const handleConfirm = async () => {
    if (!board) return
    setSubmitting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set('board', board.id)
      formData.set('phone', phone)

      const res = await purchaseExamPin(formData)
      setShowConfirm(false)

      if (!res.success) {
        setError(res.message)
        return
      }

      setResult({
        pin: String(res.transaction?.pin ?? ''),
        board: board.label,
        amount: price,
        transactionId: String(res.transaction?.id ?? ''),
      })
      setSelected(null)
      setPhone('')

      const wallet = await getWalletBalance()
      setBalance(wallet?.balance ?? 0)
    } catch {
      setShowConfirm(false)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopy = () => {
    if (!result?.pin) return
    navigator.clipboard.writeText(result.pin)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] overflow-y-auto flex flex-col">
      <div className="topbar">
        <Link href="/dashboard" className="flex items-center gap-2">
          <ArrowLeft style={{ width: 18, height: 18, color: 'var(--text-1)' }} />
          <span className="topbar-title">Exam Pins</span>
        </Link>
      </div>

      <div className="flex-1 px-4 sm:px-6 pb-32 max-w-2xl w-full mx-auto">
        <div className="mb-5">
          <h1 className="text-lg font-bold text-[var(--text-1)]">Result checker pins</h1>
          <p className="text-xs text-[var(--text-3)] mt-1">
            Buy WAEC, NECO or NABTEB scratch cards instantly. The pin is shown right after payment.
          </p>
        </div>

        <p className="form-label text-xs mb-2">Select exam board</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-5">
          {loading
            ? [0, 1, 2].map((i) => (
                <div key={i} className="h-[86px] rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
              ))
            : boards.map((b) => {
                const active = selected === b.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelected(b.id)
                      setError(null)
                    }}
                    className={`text-left rounded-2xl border p-3.5 transition ${
                      active
                        ? 'border-[var(--primary)] bg-[var(--primary-light)] shadow-sm'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          active ? 'bg-[var(--primary)] text-white' : 'bg-[var(--primary-light)] text-[var(--primary)]'
                        }`}
                      >
                        <GraduationCap className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                      </span>
                      <span
                        className={`w-4 h-4 rounded-full border-2 ${
                          active ? 'border-[var(--primary)] bg-[var(--primary)]' : 'border-[var(--border)]'
                        }`}
                      />
                    </div>
                    <p className="text-sm font-bold text-[var(--text-1)]">{b.short}</p>
                    <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                      {b.price > 0 ? `₦${b.price.toLocaleString()}` : 'Unavailable'}
                    </p>
                  </button>
                )
              })}
        </div>

        <div className="form-group mb-4">
          <label className="form-label text-xs" htmlFor="exam-phone">
            Phone number
          </label>
          <input
            id="exam-phone"
            type="tel"
            inputMode="numeric"
            className="form-input h-11 text-sm"
            placeholder="08031234567"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))
              setError(null)
            }}
          />
          {phone && !phoneValid && <p className="text-[11px] text-[#dc2626] mt-1">Enter a valid 11-digit number</p>}
        </div>

        {board && (
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 mb-4 text-sm space-y-2.5">
            <div className="flex justify-between">
              <span className="text-[var(--text-3)]">Board</span>
              <span className="font-semibold text-[var(--text-1)]">{board.label}</span>
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
          {loading ? 'Loading...' : submitting ? 'Processing...' : 'Continue'}
        </button>

        <div className="flex items-center justify-center gap-1.5 mt-4 text-[11px] text-[var(--text-3)]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Pins are delivered instantly and stored in your transaction history.</span>
        </div>
      </div>

      <ConfirmSheet
        show={showConfirm}
        title="Confirm Exam Pin"
        details={[
          { label: 'Board', value: board?.label ?? '' },
          { label: 'Phone', value: phone },
          { label: 'Amount', value: `₦${price.toLocaleString()}` },
          { label: 'Balance After', value: `₦${((balance ?? 0) - price).toLocaleString()}` },
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
                <h2 className="text-base font-bold text-[var(--text-1)]">Pin generated</h2>
                <p className="text-xs text-[var(--text-3)]">{result.board}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
              <p className="text-[11px] font-semibold text-[var(--text-3)] mb-1.5">YOUR PIN</p>
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-lg font-bold text-[var(--text-1)] break-all">{result.pin || '—'}</span>
                <button
                  onClick={handleCopy}
                  className={`flex-shrink-0 p-2 rounded-lg transition ${
                    copied ? 'bg-[#f0fdf4] text-[#16a34a]' : 'bg-[var(--primary-light)] text-[var(--primary)]'
                  }`}
                  aria-label="Copy pin"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[var(--text-3)]">Amount charged</span>
                <span className="font-semibold text-[var(--text-1)]">₦{result.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-3)]">Transaction ID</span>
                <span className="font-mono font-semibold text-[var(--text-1)] break-all text-right">{result.transactionId}</span>
              </div>
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
