"use client"

import { useEffect } from "react"
import { Loader2, X } from "lucide-react"
import { NetworkLogo } from "@/lib/utils/network-logo"

interface ConfirmSheetProps {
  show: boolean
  title: string
  network?: string
  /** Only affects logo styling, and only when `network` is provided. */
  page?: 'data' | 'airtime' | 'cable' | 'electricity' | 'recharge-pins'
  details: { label: string; value: string }[]
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

/**
 * Purchase confirmation. Mobile (<=768px) keeps the bottom-sheet treatment;
 * from 769px it renders as the admin modal does — a fixed, centred 540px card
 * over a dimmed, blurred backdrop (see the confirm-sheet block in
 * app/globals.css). Same geometry and z-index feel as the admin transaction
 * modal, just with this page's tokens.
 */
export function ConfirmSheet({ show, title, network, page = 'airtime', details, onConfirm, onCancel, loading }: ConfirmSheetProps) {
  // Lock body scroll and hide nav when sheet is open
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden'
      document.body.classList.add('modal-open')
    } else {
      document.body.style.overflow = ''
      document.body.classList.remove('modal-open')
    }
    return () => {
      document.body.style.overflow = ''
      document.body.classList.remove('modal-open')
    }
  }, [show])

  // Escape closes the sheet (not while the purchase is in flight).
  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show, loading, onCancel])

  if (!show) return null

  return (
    <>
      <div className="sheet-overlay open" onClick={loading ? undefined : onCancel} />
      <div className="bottom-sheet open" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <button
            type="button"
            className="sheet-close"
            onClick={onCancel}
            disabled={loading}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="sheet-body">
          {network && (
            <div className="flex flex-col items-center gap-0 mb-3 pb-3 border-b border-[var(--border)]">
              <NetworkLogo network={network} size="confirm" page={page} />
              <span className="text-[11px] text-[var(--text-3)] mt-1">{network}</span>
            </div>
          )}
          <div className="bg-[var(--bg)] rounded-[16px] mb-3">
            {details.map((item, idx) => (
              <div key={idx} className="confirm-row" style={idx === details.length - 1 ? { borderBottom: "none" } : {}}>
                <span className="confirm-label">{item.label}</span>
                {item.label === "Amount" ? (
                  <span className="confirm-amount">{item.value}</span>
                ) : (
                  <span className="confirm-value">{item.value}</span>
                )}
              </div>
            ))}
          </div>
          <button onClick={onConfirm} disabled={loading} className="btn-accent flex items-center justify-center gap-2 w-full mb-2" style={{ height: '44px' }}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Confirm & Pay"
            )}
          </button>
          <button onClick={onCancel} disabled={loading} className="btn-ghost w-full" style={{ height: '40px' }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
