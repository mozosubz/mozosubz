'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export const PRIVACY_STORAGE_KEY = 'adminPrivacyMode'
const PRIVACY_EVENT = 'admin-privacy-change'

function apply(on: boolean) {
  document.documentElement.dataset.adminPrivacy = on ? 'on' : 'off'
}

export function PrivacyToggle() {
  // The inline script in the admin layout sets this attribute before paint, so
  // reading it here keeps the button in sync without a flash of visible values.
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    setHidden(document.documentElement.dataset.adminPrivacy === 'on')

    // Keep every mounted toggle (and other tabs) in sync.
    const onLocal = (e: Event) => setHidden((e as CustomEvent<boolean>).detail)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== PRIVACY_STORAGE_KEY) return
      const next = e.newValue === 'true'
      apply(next)
      setHidden(next)
    }

    window.addEventListener(PRIVACY_EVENT, onLocal)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(PRIVACY_EVENT, onLocal)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const toggle = () => {
    const next = !hidden
    apply(next)
    try {
      localStorage.setItem(PRIVACY_STORAGE_KEY, String(next))
    } catch {
      // Private browsing / storage disabled: the toggle still works for this session.
    }
    setHidden(next)
    window.dispatchEvent(new CustomEvent(PRIVACY_EVENT, { detail: next }))
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn"
      aria-pressed={hidden}
      title={hidden ? 'Show amounts' : 'Hide amounts'}
    >
      {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
      <span>{hidden ? 'Show amounts' : 'Hide amounts'}</span>
    </button>
  )
}
