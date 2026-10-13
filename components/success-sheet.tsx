"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { Check, X } from "lucide-react"
import { NetworkLogo } from "@/lib/utils/network-logo"

export interface SuccessDetailRow {
  label: string
  value: string
  /** Render with the larger amount treatment (the key figure of the sale). */
  amount?: boolean
}

interface SuccessSheetProps {
  show: boolean
  title: string
  subtitle?: string
  /** Network/provider logo (data, airtime, cable, electricity, recharge pins). */
  network?: string
  page?: "data" | "airtime" | "cable" | "electricity" | "recharge-pins"
  /** Label/value rows under the logo. */
  details?: SuccessDetailRow[]
  /** Rich, service-specific content: tokens, pins, QR codes, warnings. */
  children?: React.ReactNode
  doneLabel?: string
  onDone: () => void
  /** Show a "View history" shortcut in the actions row. */
  viewHistory?: boolean
}

/**
 * The one success modal every service uses.
 *
 * Same anatomy as the admin transaction modal and the confirm sheet
 * (app/globals.css .bottom-sheet block): dimmed + blurred backdrop, bottom
 * sheet on mobile, centred 540px card on desktop, header with a close button,
 * wrap-safe rows, and an actions row. Rendered into <body> so no page wrapper
 * can capture the fixed positioning.
 */
export function SuccessSheet({
  show,
  title,
  subtitle,
  network,
  page = "airtime",
  details,
  children,
  doneLabel = "Done",
  onDone,
  viewHistory = false,
}: SuccessSheetProps) {
  useEffect(() => {
    if (show) {
      document.body.style.overflow = "hidden"
      document.body.classList.add("modal-open")
    } else {
      document.body.style.overflow = ""
      document.body.classList.remove("modal-open")
    }
    return () => {
      document.body.style.overflow = ""
      document.body.classList.remove("modal-open")
    }
  }, [show])

  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [show, onDone])

  if (!show) return null
  if (typeof document === "undefined") return null

  return createPortal(
    <>
      <div className="sheet-overlay open" onClick={onDone} />
      <div className="bottom-sheet open" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <button type="button" className="sheet-close" onClick={onDone} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="sheet-body">
          <div className="flex items-start gap-3 mb-4">
            <span className="w-10 h-10 rounded-full bg-[#f0fdf4] text-[#16a34a] flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5" strokeWidth={2.5} />
            </span>
            {subtitle && (
              <p className="text-xs text-[var(--text-3)] leading-relaxed pt-1.5">{subtitle}</p>
            )}
          </div>

          {network && (
            <div className="flex flex-col items-center gap-0 mb-3 pb-3 border-b border-[var(--border)]">
              <NetworkLogo network={network} size="receipt" page={page} />
              <span className="text-[11px] text-[var(--text-3)] mt-1">{network}</span>
            </div>
          )}

          {details && details.length > 0 && (
            <div className="bg-[var(--bg)] rounded-[16px] mb-3">
              {details.map((item, idx) => (
                <div key={idx} className="confirm-row">
                  <span className="confirm-label">{item.label}</span>
                  {item.amount ? (
                    <span className="confirm-amount">{item.value}</span>
                  ) : (
                    <span className="confirm-value">{item.value}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {children}
        </div>
        <div className="sheet-actions">
          {viewHistory && (
            <Link href="/dashboard/transactions" className="btn-ghost" onClick={onDone}>
              View history
            </Link>
          )}
          <button onClick={onDone} className="btn-accent">
            {doneLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
