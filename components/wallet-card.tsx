"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Copy, Check, ArrowDownToLine, Landmark } from "lucide-react"

interface WalletCardProps {
  balance: number
  userId: string
  accountNumber?: string
  bankName?: string
  bvn?: string
}

// Receives the live `balance` from the dashboard's server render + realtime
// channel, so render is instant and 100% reactive. The Moznify funding
// account (when provisioned) is surfaced inline with one-tap copy.
export function WalletCard({
  balance,
  userId: _userId,
  accountNumber,
  bankName,
  bvn: _bvn,
}: WalletCardProps) {
  const [isHidden, setIsHidden] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)

  // Restore the user's "hide balance" preference on mount.
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsHidden(localStorage.getItem("walletBalanceHidden") === "true")
    }
    setMounted(true)
  }, [])

  const handleToggleBalance = (newState: boolean) => {
    setIsHidden(newState)
    if (typeof window !== "undefined") {
      localStorage.setItem("walletBalanceHidden", String(newState))
    }
  }

  const handleCopyAccount = async () => {
    if (!accountNumber) return
    try {
      await navigator.clipboard.writeText(accountNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (permissions / insecure context) — no-op.
    }
  }

  const formattedBalance = balance.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <div className="wallet-card">
      {/* Fine grid texture — depth without noise */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="balance-label uppercase tracking-[0.14em] text-[11px] font-semibold">
            Wallet Balance
          </span>
          <button
            onClick={() => handleToggleBalance(!isHidden)}
            className="eye-btn"
            aria-label={isHidden ? "Show balance" : "Hide balance"}
          >
            {mounted && isHidden ? (
              <EyeOff style={{ width: 16, height: 16 }} />
            ) : (
              <Eye style={{ width: 16, height: 16 }} />
            )}
          </button>
        </div>

        <div className="balance-amount mb-5 tabular-nums">
          {mounted && isHidden ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : `\u20A6${formattedBalance}`}
        </div>

        {/* Funding account — one-tap copy when provisioned */}
        {mounted && accountNumber && (
          <button
            onClick={handleCopyAccount}
            className="mb-5 w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 bg-white/10 hover:bg-white/[0.16] border border-white/15 transition-colors text-left"
            aria-label={`Copy account number ${accountNumber}`}
          >
            <Landmark className="w-4.5 h-4.5 w-[18px] h-[18px] text-white/70 flex-shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                {bankName || "Funding Account"}
              </span>
              <span className="block text-sm font-bold text-white tracking-[0.08em] tabular-nums">
                {isHidden ? "\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022" : accountNumber}
              </span>
            </span>
            {copied ? (
              <Check className="w-4 h-4 text-emerald-300 flex-shrink-0" />
            ) : (
              <Copy className="w-4 h-4 text-white/60 flex-shrink-0" />
            )}
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/deposit"
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] rounded-xl text-sm text-white font-bold transition-all shadow-[0_6px_20px_rgba(16,185,129,0.4)]"
          >
            <ArrowDownToLine size={16} strokeWidth={2.5} />
            Deposit Funds
          </Link>
          <Link
            href="/dashboard/transactions"
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/[0.16] active:scale-[0.98] rounded-xl text-sm text-white font-bold border border-white/15 transition-all"
          >
            History
          </Link>
        </div>
      </div>
    </div>
  )
}
