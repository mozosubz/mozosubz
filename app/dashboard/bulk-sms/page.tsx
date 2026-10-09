'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, Check, MessageSquare, Info } from 'lucide-react'
import { sendBulkSms, getBulkSmsRate } from '@/lib/actions/bulk-sms'
import { getWalletBalance } from '@/lib/actions/wallet'
import { countSmsPages } from '@/lib/utils/sms'
import { ConfirmSheet } from '@/components/confirm-sheet'
import { ProcessingOverlay } from '@/components/processing-overlay'

// Fallbacks used only until the server rate loads.
const DEFAULT_UNIT_PRICE = 5
const DEFAULT_PAGE_CHARS = 160
const DEFAULT_MAX_MESSAGE_CHARS = 905

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((v) => v.trim())
    .filter(Boolean)
}

export default function BulkSmsPage() {
  const [sender, setSender] = useState('')
  const [recipients, setRecipients] = useState('')
  const [message, setMessage] = useState('')
  const [balance, setBalance] = useState<number | null>(null)
  const [unitPrice, setUnitPrice] = useState(DEFAULT_UNIT_PRICE)
  const [pageChars, setPageChars] = useState(DEFAULT_PAGE_CHARS)
  const [maxMessageChars, setMaxMessageChars] = useState(DEFAULT_MAX_MESSAGE_CHARS)

  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    recipients: number
    pages: number
    amount: number
    transactionId: string
    sent?: number
    failed?: number
    refund?: number
  } | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [wallet, rate] = await Promise.all([getWalletBalance(), getBulkSmsRate()])
        if (!active) return
        setBalance(wallet?.balance ?? 0)
        setUnitPrice(rate.unitPrice)
        setPageChars(rate.pageChars)
        setMaxMessageChars(rate.maxMessageChars)
      } catch {
        if (active) setError('Failed to load the current rate. Please refresh.')
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const recipientList = parseRecipients(recipients)
  const pages = countSmsPages(message)
  const total = Math.round(recipientList.length * pages * unitPrice * 100) / 100

  const senderValid = /^[A-Za-z]{3,11}$/.test(sender)
  const canSubmit =
    senderValid &&
    recipientList.length > 0 &&
    message.trim().length > 0 &&
    message.length <= maxMessageChars &&
    balance !== null &&
    balance >= total &&
    total > 0 &&
    !submitting

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set('from', sender)
      formData.set('to', recipients)
      formData.set('msg', message)

      const res = await sendBulkSms(formData)
      setShowConfirm(false)

      if (!res.success) {
        setError(res.message)
        return
      }

      setResult({
        recipients: recipientList.length,
        pages,
        amount: Number(res.transaction?.amount ?? total),
        transactionId: String(res.transaction?.id ?? ''),
        sent: typeof res.transaction?.sent === 'number' ? res.transaction.sent : undefined,
        failed: typeof res.transaction?.failed === 'number' ? res.transaction.failed : undefined,
        refund: typeof res.transaction?.refund === 'number' ? res.transaction.refund : undefined,
      })
      setRecipients('')
      setMessage('')

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
          <span className="topbar-title">Bulk SMS</span>
        </Link>
      </div>

      <div className="flex-1 px-4 sm:px-6 pb-32 max-w-2xl w-full mx-auto">
        <div className="mb-5">
          <h1 className="text-lg font-bold text-[var(--text-1)]">Message many at once</h1>
          <p className="text-xs text-[var(--text-3)] mt-1">
            Send one message to up to 5,000 numbers. Billed at ₦{unitPrice} per {pageChars}-character page.
          </p>
        </div>

        <div className="form-group mb-4">
          <label className="form-label text-xs" htmlFor="sms-sender">
            Sender name
          </label>
          <input
            id="sms-sender"
            type="text"
            className="form-input h-11 text-sm"
            placeholder="e.g. MOZOSUBZ"
            value={sender}
            maxLength={11}
            onChange={(e) => {
              setSender(e.target.value.replace(/[^A-Za-z]/g, ''))
              setError(null)
            }}
          />
          <p className="text-[11px] text-[var(--text-3)] mt-1">
            3–11 letters, no spaces, numbers or symbols. Bank, payment, telecom and government names are not allowed.
          </p>
        </div>

        <div className="form-group mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="form-label text-xs mb-0" htmlFor="sms-recipients">
              Recipients
            </label>
            <span className="text-[11px] text-[var(--text-3)]">{recipientList.length} number(s)</span>
          </div>
          <textarea
            id="sms-recipients"
            className="form-input text-sm py-3 h-28 resize-none"
            placeholder="08031234567, 08031234568&#10;Or one per line"
            value={recipients}
            onChange={(e) => {
              setRecipients(e.target.value)
              setError(null)
            }}
          />
          <p className="text-[11px] text-[var(--text-3)] mt-1">
            Separate numbers with commas or new lines. 080…, 234… and +234… formats all work. Invalid or repeated
            numbers are skipped and not charged.
          </p>
        </div>

        <div className="form-group mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="form-label text-xs mb-0" htmlFor="sms-message">
              Message
            </label>
            <span className={`text-[11px] ${message.length > maxMessageChars ? 'text-[#dc2626]' : 'text-[var(--text-3)]'}`}>
              {message.length}/{maxMessageChars}
            </span>
          </div>
          <textarea
            id="sms-message"
            className="form-input text-sm py-3 h-28 resize-none"
            placeholder="Type your message"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              setError(null)
            }}
          />
        </div>

        <div className="flex gap-2.5 p-3 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] text-[11px] mb-4">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Networks block messages mentioning banks, payment companies, international brands like WhatsApp or
            Facebook, OTP wording, and runs of 4 or more digits — write amounts like 5,000 rather than 5000. Numbers
            on the DND list are not delivered and are not refunded.
          </span>
        </div>

        {recipientList.length > 0 && message.trim() && (
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 mb-4 text-sm space-y-2.5">
            <div className="flex justify-between">
              <span className="text-[var(--text-3)]">Recipients</span>
              <span className="font-semibold text-[var(--text-1)]">{recipientList.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-3)]">Pages per message</span>
              <span className="font-semibold text-[var(--text-1)]">{pages}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-3)]">Rate</span>
              <span className="font-semibold text-[var(--text-1)]">₦{unitPrice} / page</span>
            </div>
            <div className="border-t border-[var(--border)] pt-2.5 flex justify-between">
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
        )}

        {error && (
          <div className="flex gap-2.5 p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button onClick={() => setShowConfirm(true)} disabled={!canSubmit} className="btn-primary h-11 text-sm">
          {submitting ? 'Sending...' : 'Continue'}
        </button>
      </div>

      <ConfirmSheet
        show={showConfirm}
        title="Confirm Bulk SMS"
        details={[
          { label: 'Sender', value: sender },
          { label: 'Recipients', value: `${recipientList.length}` },
          { label: 'Pages', value: `${pages}` },
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
                <h2 className="text-base font-bold text-[var(--text-1)]">Messages queued</h2>
                <p className="text-xs text-[var(--text-3)]">Delivery is handled by the network.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-[var(--primary)]" />
              <div className="text-sm">
                <p className="font-semibold text-[var(--text-1)]">
                  {result.recipients} recipient{result.recipients === 1 ? '' : 's'} · {result.pages} page
                  {result.pages === 1 ? '' : 's'}
                </p>
                <p className="text-[11px] text-[var(--text-3)]">Charged ₦{result.amount.toLocaleString()}</p>
              </div>
            </div>

            {typeof result.failed === 'number' && result.failed > 0 && (
              <div className="flex gap-2.5 p-3 rounded-xl bg-[#fffbeb] border border-[#fde68a] text-[#92400e] text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  {result.failed} of {result.recipients} number{result.failed === 1 ? '' : 's'} could not be
                  delivered{result.refund ? ` — ₦${result.refund.toLocaleString()} refunded to your wallet` : ''}.
                </span>
              </div>
            )}

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

      <ProcessingOverlay isVisible={submitting} message="Sending messages..." />
    </div>
  )
}
