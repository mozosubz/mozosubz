"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { AlertTriangle, CheckCircle2, HelpCircle, Info, X } from "lucide-react"
import styles from "./app-dialog.module.css"

/**
 * Replaces window.confirm() / window.alert(), which render unstyled browser
 * chrome ("The page at ... says:") that leaks the raw domain to the user and
 * cannot be themed.
 *
 * confirm() is synchronous, so call sites used `if (!confirm(...)) return`.
 * The replacement is promise-based so those sites only need `await`:
 *
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title: 'Delete rule?' }))) return
 */

type ConfirmTone = "default" | "danger"

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
}

type ToastTone = "info" | "success" | "error"

interface Toast {
  id: number
  message: string
  tone: ToastTone
}

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  toast: (message: string, tone?: ToastTone) => void
}

const DialogContext = createContext<DialogContextValue | null>(null)

const TOAST_DURATION: Record<ToastTone, number> = {
  info: 4000,
  success: 4000,
  // Errors linger: they usually carry detail the user needs to read or report.
  error: 7000,
}

let toastId = 0

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<{
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [mounted, setMounted] = useState(false)

  // The dialog is portalled to <body>, outside the admin markup, so it can't
  // inherit the admin panel's dark styling contextually — it's keyed off the route.
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith("/admin") ?? false

  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  // Kept in a ref so the unmount cleanup can settle a still-open promise
  // without re-running on every open/close.
  const pendingRef = useRef<typeof pending>(null)
  pendingRef.current = pending

  // Portals need a DOM target, which doesn't exist during SSR.
  useEffect(() => setMounted(true), [])

  // A caller awaiting confirm() would hang forever if the provider unmounted
  // mid-decision (e.g. route change). Settle as "cancelled".
  useEffect(() => {
    return () => pendingRef.current?.resolve(false)
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending((current) => {
        // Two overlapping confirms would strand the first promise. Cancel it.
        current?.resolve(false)
        return { options, resolve }
      })
    })
  }, [])

  const settle = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value)
      return null
    })
  }, [])

  const toast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = ++toastId
    setToasts((current) => [...current, { id, message, tone }])
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id))
    }, TOAST_DURATION[tone])
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  // Escape cancels, and background scroll is locked while open — matching the
  // dismissal affordances users expect from the native dialog.
  useEffect(() => {
    if (!pending) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        settle(false)
      }
    }

    document.addEventListener("keydown", onKeyDown, true)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    confirmButtonRef.current?.focus()

    return () => {
      document.removeEventListener("keydown", onKeyDown, true)
      document.body.style.overflow = previousOverflow
    }
  }, [pending, settle])

  const value = useMemo(() => ({ confirm, toast }), [confirm, toast])

  return (
    <DialogContext.Provider value={value}>
      {children}

      {mounted &&
        pending &&
        createPortal(
          <div className={isAdmin ? styles.admin : undefined}>
            <ConfirmDialog
              options={pending.options}
              onSettle={settle}
              confirmButtonRef={confirmButtonRef}
            />
          </div>,
          document.body,
        )}

      {mounted &&
        toasts.length > 0 &&
        createPortal(
          <div className={isAdmin ? styles.admin : undefined}>
            <div className={styles.toastWrap} role="region" aria-label="Notifications">
              {toasts.map((item) => (
                <ToastItem key={item.id} toast={item} onDismiss={dismissToast} />
              ))}
            </div>
          </div>,
          document.body,
        )}
    </DialogContext.Provider>
  )
}

function ConfirmDialog({
  options,
  onSettle,
  confirmButtonRef,
}: {
  options: ConfirmOptions
  onSettle: (value: boolean) => void
  confirmButtonRef: React.RefObject<HTMLButtonElement | null>
}) {
  const isDanger = options.tone === "danger"

  return (
    <div
      className={styles.overlay}
      onClick={() => onSettle(false)}
      role="presentation"
    >
      <div
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby={options.message ? "app-dialog-message" : undefined}
      >
        <div className={styles.iconRow}>
          <div
            className={`${styles.icon} ${isDanger ? styles.iconDanger : styles.iconDefault}`}
            aria-hidden="true"
          >
            {isDanger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
          </div>
          <h2 id="app-dialog-title" className={styles.title}>
            {options.title}
          </h2>
        </div>

        {options.message && (
          <p id="app-dialog-message" className={styles.message}>
            {options.message}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnCancel}`}
            onClick={() => onSettle(false)}
          >
            {options.cancelLabel || "Cancel"}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className={`${styles.btn} ${isDanger ? styles.btnConfirmDanger : styles.btnConfirm}`}
            onClick={() => onSettle(true)}
          >
            {options.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  )
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: number) => void
}) {
  const toneClass =
    toast.tone === "error"
      ? styles.toastError
      : toast.tone === "success"
        ? styles.toastSuccess
        : ""

  const Icon =
    toast.tone === "error"
      ? AlertTriangle
      : toast.tone === "success"
        ? CheckCircle2
        : Info

  const iconClass =
    toast.tone === "error"
      ? styles.toastErrorIcon
      : toast.tone === "success"
        ? styles.toastSuccessIcon
        : ""

  return (
    <div
      className={`${styles.toast} ${toneClass}`}
      // Errors are announced assertively; routine confirmations politely.
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
    >
      <Icon size={17} className={`${styles.toastIcon} ${iconClass}`} aria-hidden="true" />
      <span className={styles.toastText}>{toast.message}</span>
      <button
        type="button"
        className={styles.toastClose}
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  )
}

function useDialogContext(hookName: string) {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error(`${hookName} must be used inside <AppDialogProvider>`)
  }
  return context
}

/** Returns an async confirm(). Resolves true only if the user confirms. */
export function useConfirm() {
  return useDialogContext("useConfirm").confirm
}

/** Returns toast(message, tone) for non-blocking feedback. */
export function useToast() {
  return useDialogContext("useToast").toast
}
