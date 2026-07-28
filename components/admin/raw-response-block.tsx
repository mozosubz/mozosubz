'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { maskProviderName } from '@/lib/utils/sanitize-provider'

/**
 * Copies text to the clipboard.
 *
 * `navigator.clipboard` is only available in secure contexts, so admin pages
 * served over plain HTTP (or an older in-app webview) would silently do
 * nothing. The hidden-textarea path keeps copy working there.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path below.
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

/** Copy button that confirms the result inline instead of failing silently. */
export function CopyButton({
  value,
  label = 'Copy',
  size = 12,
  className = 'btn btn-ghost btn-icon btn-sm',
}: {
  value: string
  label?: string
  size?: number
  className?: string
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const handleCopy = async () => {
    const ok = await copyText(value)
    setState(ok ? 'copied' : 'failed')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1600)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={className}
      title={state === 'failed' ? 'Copy failed' : label}
      aria-label={label}
    >
      {state === 'copied' ? (
        <Check size={size} style={{ color: 'var(--admin-success)' }} />
      ) : (
        <Copy size={size} />
      )}
      <span className="sr-only" aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : ''}
      </span>
    </button>
  )
}

/**
 * Pretty-printed JSON payload with a copy button.
 *
 * Values arrive from the DB as either parsed JSON or a JSON string, so this
 * normalises both before printing.
 */
export function RawResponseBlock({ title, value }: { title: string; value: unknown }) {
  const text = (() => {
    const raw = (() => {
      if (typeof value === 'string') {
        try {
          return JSON.stringify(JSON.parse(value), null, 2)
        } catch {
          return value
        }
      }
      try {
        return JSON.stringify(value, null, 2)
      } catch {
        return String(value)
      }
    })()

    // Masked on read as well as on write: rows saved before sanitizing was
    // added still hold the provider's brand name. Applied to the printed text
    // so the copy button cannot leak what the screen hides.
    return maskProviderName(raw)
  })()

  return (
    <div className="raw-block">
      <div className="raw-block-header">
        <span className="raw-block-title">{title}</span>
        <CopyButton value={text} label={`Copy ${title}`} />
      </div>
      <pre className="raw-block-pre">{text}</pre>
    </div>
  )
}
