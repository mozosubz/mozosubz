'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LifeBuoy, X, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const AUTO_OPEN_KEY = 'mozosubz:support:auto-open'
const MAX_LENGTH = 2000

type PanelState = 'idle' | 'sending' | 'sent' | 'error'

/**
 * Support widget. Floats above every dashboard page (mounted in AppShell,
 * stacked with the WhatsApp button). Opens on its own once per login session
 * so the user always sees it when they enter the dashboard, and can be
 * reopened from the floating button at any time.
 *
 * Panel anatomy mirrors the admin modal: dimmed + blurred backdrop, a
 * centered card on desktop and a bottom sheet on mobile (styles/support.css).
 */
export function SupportWidget() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [state, setState] = useState<PanelState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => setMounted(true), [])

  // Auto-open once per browser session: the user sees it on login / first
  // dashboard entry. Cancelling keeps it closed until the next session or
  // until they tap the floating button.
  useEffect(() => {
    try {
      if (!window.sessionStorage.getItem(AUTO_OPEN_KEY)) {
        window.sessionStorage.setItem(AUTO_OPEN_KEY, '1')
        const timer = window.setTimeout(() => setOpen(true), 700)
        return () => window.clearTimeout(timer)
      }
    } catch {
      /* private mode — skip auto-open */
    }
  }, [])

  useEffect(() => {
    if (!open) return
    let active = true
    ;(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        if (active && data.user?.email) setEmail(data.user.email)
      } catch {
        /* the message still sends with the server-side identity */
      }
    })()
    return () => {
      active = false
    }
  }, [open])

  useEffect(() => {
    if (open && state === 'idle') textareaRef.current?.focus()
  }, [open, state])

  const close = useCallback(() => {
    setOpen(false)
    setState('idle')
    setErrorMsg(null)
    setMessage('')
  }, [])

  const send = useCallback(async () => {
    const trimmed = message.trim()
    if (trimmed.length < 2 || state === 'sending') return
    setState('sending')
    setErrorMsg(null)
    try {
      const response = await fetch('/api/support/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, page: window.location.pathname }),
      })
      const data = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!response.ok || !data?.success) {
        setErrorMsg(data?.error || 'Message could not be sent. Please try again.')
        setState('error')
        return
      }
      setState('sent')
    } catch {
      setErrorMsg('Message could not be sent. Please try again.')
      setState('error')
    }
  }, [message, state])

  if (!mounted) return null

  const panel = open ? (
    <div
      className="support-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className="support-card" role="dialog" aria-modal="true" aria-label="Support">
        <div className="support-header">
          <div className="support-header-title">
            <span className="support-header-icon" aria-hidden="true">
              <LifeBuoy style={{ width: 17, height: 17 }} />
            </span>
            <div>
              <h2>Support</h2>
              <p>Tell us what went wrong.</p>
            </div>
          </div>
          <button type="button" className="support-close" onClick={close} aria-label="Close support">
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {state === 'sent' ? (
          <div className="support-done">
            <div className="support-done-icon" aria-hidden="true">
              <Check style={{ width: 22, height: 22 }} />
            </div>
            <h3>Message sent</h3>
            <p>{email ? `We'll reply to ${email}.` : "We'll reply to your email."}</p>
            <button type="button" className="support-btn support-btn-primary" onClick={close}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="support-body">
              <label className="support-label" htmlFor="support-message">
                Message
              </label>
              <textarea
                id="support-message"
                ref={textareaRef}
                value={message}
                maxLength={MAX_LENGTH}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Describe the issue, e.g. a failed purchase or deposit…"
                className="support-textarea"
              />
              <div className="support-meta">
                <span className="support-reply-to">
                  {email ? `Reply goes to ${email}` : 'Sent from your account'}
                </span>
                <span className="support-counter">
                  {message.length}/{MAX_LENGTH}
                </span>
              </div>
              {state === 'error' && errorMsg && <p className="support-error">{errorMsg}</p>}
            </div>

            <div className="support-footer">
              <button
                type="button"
                className="support-btn support-btn-ghost"
                onClick={close}
                disabled={state === 'sending'}
              >
                Cancel
              </button>
              <button
                type="button"
                className="support-btn support-btn-primary"
                onClick={send}
                disabled={state === 'sending' || message.trim().length < 2}
              >
                {state === 'sending' && <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />}
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  ) : null

  return (
    <>
      {panel && createPortal(panel, document.body)}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="support-fab"
        aria-label="Open support"
        title="Support"
      >
        <LifeBuoy style={{ width: 21, height: 21 }} />
      </button>
    </>
  )
}
