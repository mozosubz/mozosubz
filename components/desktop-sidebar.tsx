'use client'

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, LayoutGrid, Wallet, History, User, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "./logo"

interface DesktopSidebarProps {
  isOpen: boolean
  onClose: () => void
}

const tabs = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Services", href: "/dashboard/services", icon: LayoutGrid },
  { name: "History", href: "/dashboard/transactions", icon: History },
  { name: "Wallet", href: "/dashboard/deposit", icon: Wallet },
  { name: "Profile", href: "/dashboard/profile", icon: User },
]

export function DesktopSidebar({ isOpen, onClose }: DesktopSidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Overlay for mobile/tablet when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-30"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "app-shell-sidebar fixed md:static md:flex flex-col",
          "transition-transform duration-300 ease-in-out",
          "z-40 md:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Close button - mobile only */}
        <div className="md:hidden p-4 border-b border-[var(--border)] flex items-center justify-between">
          <Logo />
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--text-2)] hover:bg-[var(--surface)] transition"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Logo - desktop only */}
        <div className="hidden md:block p-6 border-b border-[var(--border)]">
          <Link href="/dashboard" aria-label="Mozosubz home">
            <Logo />
          </Link>
        </div>

        {/* Navigation — icon squares with soft tints, active row on light blue */}
        <nav className="flex-1 px-4 py-5 space-y-1.5">
          {tabs.map((tab) => {
            const active = isActive(tab.href)
            return (
              <Link
                key={tab.name}
                href={tab.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-200",
                  active
                    ? "bg-[#eef4ff] text-[#1a56db] font-semibold"
                    : "text-[var(--text-2)] hover:bg-[var(--surface)] hover:text-[var(--text-1)]"
                )}
              >
                <span
                  className={cn(
                    "w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 transition-colors",
                    active ? "bg-[#dbe7ff]" : "bg-[var(--surface)]"
                  )}
                >
                  <tab.icon className="w-[18px] h-[18px]" />
                </span>
                <span className="text-sm font-medium">{tab.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] text-xs text-[var(--text-3)]">
          <p>© 2026 Mozosubz</p>
        </div>
      </aside>
    </>
  )
}
