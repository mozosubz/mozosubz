'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalPortalProps {
  children: ReactNode
  /** When provided, Escape closes the modal. */
  onClose?: () => void
}

/**
 * Renders modal markup into `document.body`.
 *
 * `.modal-overlay` is `position: fixed`, which resolves against the nearest
 * ancestor that establishes a containing block — any ancestor with `transform`,
 * `filter`, or `contain: layout/paint`. The admin shell previously matched a
 * blanket `contain` rule, so overlays sized themselves to the full scroll height
 * of `main.admin-main` and landed at the bottom of the page.
 *
 * Portalling to <body> means the overlay can never be captured by a wrapper
 * again, no matter what styles get added to the shell later. It also locks
 * background scroll and wires up Escape-to-close.
 */
/**
 * Tracks nesting order so Escape only closes the top-most modal.
 *
 * Every portal listens on `document`, so without this a nested modal (e.g. a
 * transaction opened from inside a user's details) would close itself *and*
 * its parent on a single Escape press.
 */
const modalStack: symbol[] = []

export function ModalPortal({ children, onClose }: ModalPortalProps) {
  const [mounted, setMounted] = useState(false)
  const idRef = useRef<symbol>(Symbol('modal'))

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const id = idRef.current
    modalStack.push(id)
    return () => {
      const index = modalStack.indexOf(id)
      if (index !== -1) modalStack.splice(index, 1)
    }
  }, [])

  useEffect(() => {
    if (!onClose) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Ignore unless this is the top-most modal.
      if (modalStack[modalStack.length - 1] !== idRef.current) return
      onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Lock background scroll while the modal is open. The scrollbar width is
  // replaced with padding so the page behind doesn't visibly shift.
  useEffect(() => {
    const { body } = document
    const previousOverflow = body.style.overflow
    const previousPaddingRight = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - body.clientWidth

    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPaddingRight
    }
  }, [])

  if (!mounted) return null

  return createPortal(children, document.body)
}
