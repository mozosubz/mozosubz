'use client'

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, LayoutGrid, History, User, PanelLeftOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { DesktopSidebar } from "./desktop-sidebar"
import { WhatsAppSupport } from "./whatsapp-support"

const SIDEBAR_STORAGE_KEY = "mozosubz:sidebar-hidden"

interface AppShellProps {
  children: React.ReactNode
}

const tabs = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Services", href: "/dashboard/services", icon: LayoutGrid },
  { name: "History", href: "/dashboard/transactions", icon: History },
  { name: "Profile", href: "/dashboard/profile", icon: User },
]

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()

  // Desktop sidebar visibility, remembered per browser. Starts visible on the
  // server render; the stored preference applies after mount.
  const [sidebarHidden, setSidebarHidden] = useState(false)

  useEffect(() => {
    try {
      setSidebarHidden(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1")
    } catch {
      /* private mode etc. — default stays visible */
    }
  }, [])

  const setSidebar = (hidden: boolean) => {
    setSidebarHidden(hidden)
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, hidden ? "1" : "0")
    } catch {
      /* ignore */
    }
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    return pathname.startsWith(href)
  }

  return (
    <div className={cn("app-shell", sidebarHidden && "sidebar-hidden")}>
      <DesktopSidebar isOpen={false} onClose={() => {}} onCollapse={() => setSidebar(true)} />
      <div className="app-content">
        {children}
      </div>

      {/* Desktop: bring the sidebar back after collapsing it (mobile keeps the
          bottom nav, so this is md+ only). */}
      {sidebarHidden && (
        <button
          type="button"
          onClick={() => setSidebar(false)}
          aria-label="Show sidebar"
          title="Show sidebar"
          className="hidden md:flex fixed bottom-6 left-6 z-40 w-11 h-11 items-center justify-center rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-lg text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--primary)]/40 transition"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
      )}

      <WhatsAppSupport />

      <nav className="bottom-nav" style={{ contain: "layout style paint" }}>
        {tabs.map((tab) => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn("tab-btn", active && "active")}
              prefetch={true}
            >
              <div className="tab-icon-wrap">
                <tab.icon style={{ width: 19, height: 19 }} />
              </div>
              <span className="tab-label">{tab.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
