"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { calculateDepositFee, type DepositRules } from "@/lib/utils/deposit-fee"

// The Bachs overlay SDK is loaded on demand from the vendor CDN and exposes a
// single global. It ships no types we can import without adding a dependency,
// so a lone `any` here is deliberate — this is the only one in the file.
declare global {
  interface Window {
    Bachs?: any
  }
}

interface DepositClientProps {
  initialRules: DepositRules | null
}

const MIN = 100
const MAX = 100000
const QUICK_AMOUNTS = [500, 1000, 2000, 5000]

const BACHS_SCRIPT_URL = "https://checkout.bachs.io/bachs.js"
const BACHS_SCRIPT_TIMEOUT_MS = 10_000
// The checkout origin the SDK validates `checkoutUrl` against. Live sessions
// live on https://checkout.bachs.io (the SDK default); sandbox sessions live
// on https://sandbox-checkout.bachs.io, so the sandbox deployment sets
// NEXT_PUBLIC_BACHS_CHECKOUT_ORIGIN to that host. When a session's own origin
// differs (or the var is unset) the SDK is re-initialized with the actual
// session origin at open time — Initialize is idempotent and cheap.
const BACHS_CHECKOUT_ORIGIN = process.env.NEXT_PUBLIC_BACHS_CHECKOUT_ORIGIN || ""
// `checkout.completed` is UI-only — fulfilment is the webhook — so the wallet
// is confirmed by polling /api/payments/verify. The poll starts as soon as the
// overlay opens (the sandbox checkout does not always relay the completion
// event to the page) and accelerates once a completion event does arrive.
// Cadence stays under the endpoint's 8 requests/minute limit: ~6.7/min while
// waiting, then a short 2s burst after checkout.completed.
const VERIFY_MAX_TRIES = 45
const VERIFY_SLOW_INTERVAL_MS = 9_000
const VERIFY_FAST_INTERVAL_MS = 2_000
const VERIFY_FAST_TRIES = 12

type CheckoutStatus =
  | "idle"
  | "opening"
  | "paying"
  | "verifying"
  | "success"
  | "failed"
  | "expired"
  | "pending-review"
  | "error"

type BachsEvent = {
  type?: string
  data?: { reason?: string; message?: string }
}

let bachsScriptPromise: Promise<void> | null = null

/**
 * Idempotent loader for https://checkout.bachs.io/bachs.js.
 *
 * Resolves as soon as `window.Bachs` exists — whether the script was already
 * loaded, is mid-flight, or loads on this call. Rejects on script error or
 * after a 10s timeout. A failed attempt clears the cached promise so a later
 * retry starts a fresh attempt.
 */
function loadScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Bachs script can only be loaded in the browser"))
  }
  if (window.Bachs) return Promise.resolve()
  if (bachsScriptPromise) return bachsScriptPromise

  bachsScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${BACHS_SCRIPT_URL}"]`,
    )
    const script = existing || document.createElement("script")
    let settled = false

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      window.clearInterval(pollId)
      script.removeEventListener("load", handleLoad)
      script.removeEventListener("error", handleError)
      if (error) {
        bachsScriptPromise = null
        reject(error)
      } else {
        resolve()
      }
    }

    const handleLoad = () => {
      if (window.Bachs) finish()
    }
    const handleError = () =>
      finish(new Error("Failed to load the Bachs checkout script"))

    const timeoutId = window.setTimeout(
      () => finish(new Error("Timed out loading the Bachs checkout script")),
      BACHS_SCRIPT_TIMEOUT_MS,
    )
    // The global can appear a beat after the `load` event (or the script may
    // already be in the DOM from an earlier attempt), so poll it as the
    // source of truth. The timeout above is the backstop.
    const pollId = window.setInterval(() => {
      if (window.Bachs) finish()
    }, 50)

    script.addEventListener("load", handleLoad)
    script.addEventListener("error", handleError)

    if (!existing) {
      script.src = BACHS_SCRIPT_URL
      script.async = true
      document.head.appendChild(script)
    }
  })

  return bachsScriptPromise
}

/**
 * Deposit form.
 *
 * The parent server component has already fetched the active deposit_rules
 * row before any HTML left the server, so the "you will receive" line and
 * the "Continue" button are interactive on first paint — no "Loading…"
 * flash.
 *
 * Realtime keeps the rules in sync if an admin updates fees while the user
 * is on the page. A silent polling fallback re-fetches every 20s when the
 * realtime channel isn't connected (and every 60s as a safety net), and it
 * only re-renders when the rules actually changed — so the UI stays
 * perfectly still unless something is genuinely different.
 *
 * Checkout (per docs.bachs.io/guides/checkout/overlay-checkout): bachs.js is
 * loaded and Bachs.Initialize() runs once when this page loads — NOT on the
 * first click — so tapping Continue only waits on the fresh checkout_url
 * roundtrip and the overlay opens immediately. Because `checkout.completed`
 * is UI-only, the wallet is only shown as funded after /api/payments/verify
 * reports it credited (webhook fulfilment). If the SDK cannot load or open,
 * we degrade gracefully to a full-page redirect to the hosted Bachs checkout.
 */
export function DepositClient({ initialRules }: DepositClientProps) {
  const [rules, setRules] = useState<DepositRules | null>(initialRules)
  const [amount, setAmount] = useState("")
  const [error, setError] = useState("")
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState<CheckoutStatus>("idle")
  const [creditedAmount, setCreditedAmount] = useState(0)

  const rulesRef = useRef<DepositRules | null>(initialRules)
  const realtimeConnectedRef = useRef<boolean>(false)

  // Overlay-flow bookkeeping.
  const statusRef = useRef<CheckoutStatus>("idle")
  const pollingRef = useRef(false)
  const completedRef = useRef(false)
  const unmountedRef = useRef(false)
  const bachsInitializedRef = useRef(false)
  const bachsBaseUrlRef = useRef<string | null>(null)
  const watchCleanupRef = useRef<(() => void) | null>(null)

  // Keep state and ref in lockstep — overlay event handlers are plain
  // closures and need the current status without waiting for a re-render.
  const updateStatus = (next: CheckoutStatus) => {
    statusRef.current = next
    setStatus(next)
  }

  useEffect(() => {
    rulesRef.current = rules
  }, [rules])

  /**
   * Initialize the SDK once for the origin we know before any session exists
   * (the configured checkout origin, or the SDK's live default). Re-invoked
   * at open time if a session turns out to live on a different Bachs origin
   * (e.g. sandbox) — Initialize is idempotent.
   */
  const initBachs = (Bachs: any, baseUrl?: string | null) => {
    const next = baseUrl || null
    if (bachsInitializedRef.current && bachsBaseUrlRef.current === next) return
    Bachs.Initialize(next ? { baseUrl: next } : {})
    bachsInitializedRef.current = true
    bachsBaseUrlRef.current = next
  }

  // Warm start (docs: "Initialize once when your app loads, not on every
  // click"): fetch bachs.js and initialize while the user is still typing the
  // amount, so tapping Continue only waits on the checkout-session roundtrip.
  // Failures stay silent — the click path retries and can fall back to the
  // hosted checkout page.
  useEffect(() => {
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled) return
        const Bachs = window.Bachs
        if (Bachs) initBachs(Bachs, BACHS_CHECKOUT_ORIGIN)
      })
      .catch(() => {
        /* silent — retried on click */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Polling must die with the component: a late verify response must never
  // touch state after unmount.
  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      pollingRef.current = false
      if (watchCleanupRef.current) {
        watchCleanupRef.current()
        watchCleanupRef.current = null
      }
    }
  }, [])

  // Realtime + silent polling for deposit_rules. Admins can change fees at
  // any time; we want users to see the new rules without ever showing a
  // loading state.
  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    const fetchRules = async (): Promise<DepositRules | null> => {
      const { data } = await supabase
        .from("deposit_rules")
        .select("*")
        .eq("is_active", true)
        .maybeSingle()
      return data
    }

    const rulesChanged = (next: DepositRules | null, prev: DepositRules | null) => {
      if (!next || !prev) return next !== prev
      return (
        Number(next.base_fee) !== Number(prev.base_fee) ||
        Number(next.percentage_fee) !== Number(prev.percentage_fee) ||
        Number(next.threshold_amount) !== Number(prev.threshold_amount) ||
        (next.max_fee ?? null) !== (prev.max_fee ?? null) ||
        next.is_active !== prev.is_active
      )
    }

    const applyRules = (next: DepositRules | null) => {
      if (!mounted || !next) return
      if (!rulesChanged(next, rulesRef.current)) return
      setRules(next)
    }

    const channel = supabase
      .channel("deposit_rules:active")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deposit_rules" },
        async () => {
          // Any change → re-pull the active row (small, cheap query).
          const fresh = await fetchRules()
          applyRules(fresh)
        },
      )
      .subscribe((status) => {
        realtimeConnectedRef.current = status === "SUBSCRIBED"
      })

    const tick = async () => {
      if (!mounted) return
      if (typeof document !== "undefined" && document.hidden) return
      try {
        const fresh = await fetchRules()
        applyRules(fresh)
      } catch {
        /* silent */
      }
    }

    const fastInterval = setInterval(() => {
      if (!realtimeConnectedRef.current) tick()
    }, 20_000)
    const safetyInterval = setInterval(tick, 60_000)

    const onFocus = () => {
      if (!mounted) return
      if (typeof document !== "undefined" && document.hidden) return
      tick()
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus)
      document.addEventListener("visibilitychange", onFocus)
    }

    return () => {
      mounted = false
      clearInterval(fastInterval)
      clearInterval(safetyInterval)
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onFocus)
        document.removeEventListener("visibilitychange", onFocus)
      }
      supabase.removeChannel(channel)
    }
  }, [])

  const numAmount = amount ? Number.parseFloat(amount) : 0
  const calculation = rules && numAmount > 0 ? calculateDepositFee(numAmount, rules) : null
  const showReceiveBox = numAmount > 0 && !error

  /**
   * The single "wallet funded" path — shared by the realtime watch, the
   * verify poll and the one-shot close check. Stops everything, paints the
   * success state, then hands the buyer to the dashboard with a fresh
   * balance a beat later.
   */
  const markSuccessAndLeave = () => {
    if (unmountedRef.current || statusRef.current === "success") return
    pollingRef.current = false
    updateStatus("success")
    window.setTimeout(() => {
      if (!unmountedRef.current) window.location.href = "/dashboard?deposit=success"
    }, 900)
  }

  /**
   * Instant confirmation: watch THIS deposit row over Supabase Realtime.
   * The webhook credits by flipping `monnify_transactions.status` to
   * SUCCESS (RLS lets the owner read their own row), so the page learns
   * about the credit in milliseconds instead of waiting for the next poll.
   * Polling stays as the safety net if realtime is unavailable.
   */
  const watchDeposit = (paymentReference: string): (() => void) => {
    const supabase = createClient()
    const channel = supabase
      .channel(`deposit-credit:${paymentReference}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "monnify_transactions",
          filter: `payment_reference=eq.${paymentReference}`,
        },
        (payload) => {
          const nextStatus = (payload as { new?: { status?: string } }).new?.status
          if (nextStatus === "SUCCESS") {
            markSuccessAndLeave()
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  // Poll the authoritative status until the wallet is credited (webhook
  // fulfilment) or the attempt budget runs out.
  const pollVerify = async (paymentReference: string) => {
    if (pollingRef.current) return
    pollingRef.current = true
    try {
      for (let attempt = 0; attempt < VERIFY_MAX_TRIES; attempt++) {
        if (!pollingRef.current || unmountedRef.current) return
        try {
          const response = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentReference }),
          })
          const data = await response.json().catch(() => ({}))
          // `credited` is the authoritative signal; `status === 'SUCCESS'`
          // is a belt-and-braces fallback for equivalent payloads.
          if (data?.credited === true || data?.status === "SUCCESS") {
            markSuccessAndLeave()
            return
          }
        } catch {
          // Transient network error — keep polling; the budget absorbs it.
        }
        const delay =
          completedRef.current && attempt < VERIFY_FAST_TRIES
            ? VERIFY_FAST_INTERVAL_MS
            : VERIFY_SLOW_INTERVAL_MS
        await new Promise((resolve) => window.setTimeout(resolve, delay))
      }
      if (unmountedRef.current) return
      updateStatus("pending-review")
      setProcessing(false)
    } finally {
      pollingRef.current = false
    }
  }

  /**
   * One-shot verification used when the customer closes the overlay: if they
   * paid just before closing, this catches it; otherwise the caller resets
   * to idle.
   */
  const verifyOnce = async (paymentReference: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentReference }),
      })
      const data = await response.json().catch(() => ({}))
      return data?.credited === true || data?.status === "SUCCESS"
    } catch {
      return false
    }
  }

  const openBachsOverlay = async (checkoutUrl: string, paymentReference: string) => {
    // One handler per checkout session — it closes over this session's
    // paymentReference so the verify-poll always targets the right row.
    const handleEvent = (event: BachsEvent) => {
      switch (event?.type) {
        case "checkout.ready":
          // Overlay is visible and interactive — nothing left to spin.
          updateStatus("paying")
          break

        case "checkout.completed":
          // UI-only signal — fulfilment happens in the webhook, so verify.
          completedRef.current = true
          updateStatus("verifying")
          void pollVerify(paymentReference)
          break

        case "checkout.failed":
          updateStatus("failed")
          setProcessing(false)
          break

        case "checkout.expired":
          updateStatus("expired")
          setProcessing(false)
          break

        case "checkout.closed":
          // Voluntary close (or auto-close after a terminal event). Only
          // reset when the user backed out of a live session — never clobber
          // a failure/expiry message that is already on screen. One final
          // verify catches a payment that succeeded just before closing.
          if (
            !completedRef.current &&
            (statusRef.current === "opening" || statusRef.current === "paying")
          ) {
            pollingRef.current = false
            void verifyOnce(paymentReference).then((credited) => {
              if (unmountedRef.current) return
              if (credited) {
                markSuccessAndLeave()
                return
              }
              updateStatus("idle")
              setProcessing(false)
            })
          }
          break

        case "checkout.error":
          console.error(
            "[deposit] overlay error",
            event?.data?.message || event?.data?.reason || event,
          )
          updateStatus("error")
          setProcessing(false)
          break
      }
    }

    try {
      const Bachs = window.Bachs
      if (!Bachs || !Bachs.Checkout) throw new Error("Bachs SDK failed to initialize")

      // The SDK validates `checkoutUrl` against the origin it was initialized
      // with ("A checkoutUrl must be on your Bachs checkout origin; the SDK
      // rejects any other host"). Sandbox sessions live on
      // sandbox-checkout.bachs.io, live sessions on checkout.bachs.io — so
      // initialize with THIS session's origin before opening.
      let sessionOrigin: string | null = null
      try {
        sessionOrigin = new URL(checkoutUrl).origin
      } catch {
        sessionOrigin = null
      }
      initBachs(Bachs, sessionOrigin ?? BACHS_CHECKOUT_ORIGIN)

      await Bachs.Checkout.open({
        checkoutUrl,
        // Per-checkout handler, on top of the global one (docs: pass onEvent
        // to open for "this checkout only").
        onEvent: handleEvent,
        options: { autoCloseOnComplete: true },
      })

      // Instant confirmation + safety net: the realtime watch flips the UI the
      // moment the webhook credits the row; the verify poll covers the case
      // where realtime is unavailable, and an initial poll run also catches a
      // credit that landed before the channel subscribed.
      if (watchCleanupRef.current) watchCleanupRef.current()
      watchCleanupRef.current = watchDeposit(paymentReference)
      void pollVerify(paymentReference)
    } catch (overlayError) {
      // SDK blocked or misbehaving — the hosted checkout page still works,
      // so degrade to a full-page redirect instead of stranding the user.
      console.error(
        "[deposit] overlay failed to open, falling back to hosted checkout",
        overlayError,
      )
      if (!unmountedRef.current) window.location.href = checkoutUrl
    }
  }

  const handleQuickAmount = (quickAmount: number) => {
    setAmount(quickAmount.toString())
    setError("")
  }

  const handleAmountChange = (value: string) => {
    setAmount(value)
    setError("")
    if (!value) return
    const num = Number.parseFloat(value)
    if (num < MIN) setError(`Minimum deposit is ₦${MIN.toLocaleString()}`)
    else if (num > MAX) setError(`Maximum deposit is ₦${MAX.toLocaleString()}`)
  }

  const handleContinue = async () => {
    if (!calculation || calculation.depositAmount <= 0) {
      setError("Please enter a valid amount")
      return
    }

    setError("")
    setProcessing(true)
    setCreditedAmount(calculation.netAmount)
    completedRef.current = false
    updateStatus("opening")

    try {
      const response = await fetch("/api/deposit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: calculation.depositAmount,
          processingFee: calculation.processingFee,
          netAmount: calculation.netAmount,
          description: "Wallet deposit",
          // Overlay-first: the server skips success/cancel redirect URLs so
          // the checkout iframe keeps its own success screen instead of
          // navigating inside the modal.
          overlay: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Deposit failed")
      }

      const data = await response.json()
      const checkoutUrl: string | undefined = data.checkoutUrl || data.paymentUrl
      if (!checkoutUrl) throw new Error("Failed to start checkout. Please try again.")

      try {
        // Safety net: normally already resolved by the mount-time warm start,
        // so this returns instantly. Only the very first click after a failed
        // warm start actually waits on the network.
        await loadScript()
      } catch (scriptError) {
        console.error(
          "[deposit] Bachs script unavailable, falling back to hosted checkout",
          scriptError,
        )
        window.location.href = checkoutUrl
        return
      }

      await openBachsOverlay(checkoutUrl, data.paymentReference)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process deposit")
      setProcessing(false)
      updateStatus("idle")
    }
  }

  // If, somehow, the server returned no rules row (shouldn't happen — we seed
  // a default), the form still renders and the continue button is disabled.
  const rulesAvailable = !!rules

  const buttonLabel = processing
    ? status === "opening"
      ? "Opening secure checkout…"
      : status === "paying"
        ? "Waiting for payment…"
        : status === "verifying"
          ? "Confirming payment…"
          : "Processing..."
    : "Continue"

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-1">Add Funds</h1>
        <p className="text-sm text-gray-500 mb-6">Fund your wallet securely</p>

        <div className="mb-3">
          <label htmlFor="amount" className="text-sm font-medium text-gray-900">
            Enter Amount
          </label>
          <input
            id="amount"
            type="number"
            inputMode="numeric"
            placeholder="₦1000"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            disabled={processing}
            className="mt-2 w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/10 disabled:bg-gray-50"
          />
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {QUICK_AMOUNTS.map((quickAmount) => (
            <button
              key={quickAmount}
              onClick={() => handleQuickAmount(quickAmount)}
              disabled={processing}
              className={`rounded-xl py-2 text-sm font-medium transition-all ${
                amount === quickAmount.toString()
                  ? "bg-black text-white"
                  : "border border-gray-200 text-gray-900 hover:border-gray-300"
              } disabled:opacity-50`}
            >
              {quickAmount >= 1000 ? `₦${quickAmount / 1000}k` : `₦${quickAmount}`}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400 mb-4">
          Minimum: ₦{MIN.toLocaleString()} • Maximum: ₦{MAX.toLocaleString()}
        </p>

        {showReceiveBox && calculation && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="text-sm text-gray-600">
              You will receive{" "}
              <span className="font-semibold text-black">
                ₦{calculation.netAmount.toLocaleString()}
              </span>
            </p>
            <p className="text-xs text-gray-400 mt-1">Final amount after processing</p>
          </div>
        )}

        {error && <p className="text-xs text-red-500 mb-4">{error}</p>}

        {status !== "idle" && (
          <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            {status === "opening" && (
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-gray-300 border-t-black"
                  aria-hidden="true"
                />
                <p className="text-sm text-gray-900">Opening secure checkout…</p>
              </div>
            )}

            {status === "paying" && (
              <>
                <p className="text-sm text-gray-900">
                  Complete your payment in the secure checkout window.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  This page updates automatically once your payment is done — keep it open.
                </p>
              </>
            )}

            {status === "verifying" && (
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-gray-300 border-t-black"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm text-gray-900">Confirming your payment…</p>
                  <p className="text-xs text-gray-400 mt-1">This usually takes a few seconds.</p>
                </div>
              </div>
            )}

            {status === "success" && (
              <>
                <p className="text-sm font-semibold text-black">
                  ₦{creditedAmount.toLocaleString()} added to your wallet
                </p>
                <p className="text-xs text-gray-400 mt-1">Refreshing your balance…</p>
              </>
            )}

            {status === "failed" && (
              <>
                <p className="text-sm text-gray-900">
                  Payment failed — you were not charged. Try another method or retry.
                </p>
                <button
                  onClick={handleContinue}
                  disabled={processing}
                  className="mt-3 w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Retry
                </button>
              </>
            )}

            {status === "expired" && (
              <>
                <p className="text-sm text-gray-900">Checkout timed out</p>
                <p className="text-xs text-gray-400 mt-1">
                  Your payment session expired before it was completed. You were not charged.
                </p>
                <button
                  onClick={handleContinue}
                  disabled={processing}
                  className="mt-3 w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start over
                </button>
              </>
            )}

            {status === "pending-review" && (
              <>
                <p className="text-sm text-gray-900">
                  Payment received — final confirmation in progress.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Your wallet balance updates automatically once the payment is confirmed.
                  No action needed.
                </p>
              </>
            )}

            {status === "error" && (
              <>
                <p className="text-sm text-gray-900">
                  We could not open the secure checkout. Please try again.
                </p>
                <button
                  onClick={handleContinue}
                  disabled={processing}
                  className="mt-3 w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Retry
                </button>
              </>
            )}
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={
            !rulesAvailable ||
            !calculation ||
            calculation.depositAmount <= 0 ||
            processing ||
            !!error
          }
          className="w-full bg-black text-white py-3 rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {buttonLabel}
        </button>

        <p className="text-xs text-gray-400 text-center mt-4 inline-flex w-full items-center justify-center gap-1.5">
          Secure payments powered by
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brands/bachs-lettermark-black.svg" alt="Bachs" className="h-3 w-auto opacity-70" />
        </p>
      </div>
    </div>
  )
}
