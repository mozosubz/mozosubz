'use client'

import { useEffect, useState } from 'react'
import { PRIVACY_STORAGE_KEY } from './privacy-toggle'

const PRIVACY_EVENT = 'admin-privacy-change'

/**
 * Masks a value while privacy mode is on. The real value is removed from the
 * DOM rather than merely blurred, so it can't be recovered by inspecting the
 * page or by taking a screenshot mid-transition.
 */
export function Sensitive({
  children,
  length = 5,
}: {
  children: React.ReactNode
  length?: number
}) {
  const [hidden, setHidden] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setHidden(document.documentElement.dataset.adminPrivacy === 'on')
    setReady(true)

    const onLocal = (e: Event) => setHidden((e as CustomEvent<boolean>).detail)
    const onStorage = (e: StorageEvent) => {
      if (e.key === PRIVACY_STORAGE_KEY) setHidden(e.newValue === 'true')
    }

    window.addEventListener(PRIVACY_EVENT, onLocal)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(PRIVACY_EVENT, onLocal)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  // Before hydration the server-rendered value is visible, so the CSS rule
  // keyed off data-admin-privacy covers that gap to prevent a flash.
  if (ready && hidden) {
    return (
      <span aria-label="Hidden for privacy">{'•'.repeat(length)}</span>
    )
  }

  return <>{children}</>
}
