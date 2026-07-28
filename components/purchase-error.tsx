'use client'

import { AlertCircle, X } from 'lucide-react'

interface PurchaseErrorProps {
  /** Customer-safe message, typically the `message` returned by a purchase action. */
  message: string | null
  /** Optional dismiss handler. When omitted the close button is hidden. */
  onDismiss?: () => void
}

/**
 * Shared failure banner for the purchase flows (data, airtime, cable, electricity).
 *
 * Replaces the previous bare red <div> that rendered whatever raw string the
 * provider happened to return. Uses the destructive token at low opacity so it
 * stays legible in both light and dark themes, and announces itself to screen
 * readers via role="alert".
 */
export function PurchaseError({ message, onDismiss }: PurchaseErrorProps) {
  if (!message) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3"
    >
      <AlertCircle
        className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-1)]">Transaction failed</p>
        <p className="mt-0.5 text-sm leading-relaxed text-[var(--text-2)] text-pretty break-words">
          {message}
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 text-[var(--text-3)] transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Dismiss error</span>
        </button>
      )}
    </div>
  )
}
