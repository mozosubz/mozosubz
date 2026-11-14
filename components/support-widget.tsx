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
    <>
      <div
        className="fixed inset-0 z-[59] bg-black/40 sm:bg-black/20"
        onClick={close}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Support"
        className="fixed inset-x-3 bottom-3 z-[60] sm:inset-x-auto sm:right-3 sm:bottom-[202px] sm:w-[360px] rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-4.5 h-4.5 text-black" style={{ width: 18, height: 18 }} />
            <h2 className="text-sm font-semibold text-gray-900">Support</h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close support"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {state === 'sent' ? (
          <div className="px-4 py-6 text-center">
            <div className="mx-auto w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Check style={{ width: 20, height: 20 }} className="text-black" />
            </div>
            <p className="text-sm font-medium text-gray-900">Message sent</p>
            <p className="text-xs text-gray-500 mt-1">
              {email ? `We'll reply to ${email}.` : "We'll reply to your email."}
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-4 w-full h-10 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 transition"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-4">
            <textarea
              ref={textareaRef}
              value={message}
              maxLength={MAX_LENGTH}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Describe the issue…"
              rows={5}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 focus:bg-white transition"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-gray-400 truncate pr-2">
                {email ? `We'll reply to ${email}` : 'Sent from your account'}
              </span>
              <span className="text-[11px] text-gray-300 flex-shrink-0">
                {message.length}/{MAX_LENGTH}
              </span>
            </div>

            {state === 'error' && errorMsg && (
              <p className="text-xs text-red-500 mt-2">{errorMsg}</p>
            )}

            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={close}
                disabled={state === 'sending'}
                className="h-10 flex-1 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={send}
                disabled={state === 'sending' || message.trim().length < 2}
                className="h-10 flex-1 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                {state === 'sending' && <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />}
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  ) : null

  return (
    <>
      {panel && createPortal(panel, document.body)}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Open support"
        title="Support"
        className="fixed right-3 bottom-[142px] z-50 w-12 h-12 rounded-full bg-black text-white shadow-lg shadow-black/20 flex items-center justify-center hover:bg-gray-800 active:scale-95 transition"
      >
        <LifeBuoy style={{ width: 21, height: 21 }} />
      </button>
    </>
  )
}
