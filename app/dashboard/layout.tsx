import type React from "react"
import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { isUserBanned } from "@/lib/utils/bans"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()

  // Use getUser() instead of getSession() - more secure, hits Supabase server
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    // Route the sign-out through the route handler when the request still
    // carries auth cookies: the proxy (proxy.ts) forwards logged-in users
    // from /login to /dashboard, so a stale cookie the layout rejects would
    // otherwise bounce between the two pages forever. The handler clears the
    // cookies before landing on /login, which is then terminal.
    redirect("/api/auth/signout?next=/login")
  }

  // Banned accounts are signed out and sent to /login with a notice.
  // Cookie writes are not allowed from a Server Component, so the sign-out
  // happens in the GET handler of /api/auth/signout (a Route Handler) which
  // then redirects back to /login?banned=1.
  if (await isUserBanned(user.id)) {
    redirect("/api/auth/signout?banned=1")
  }

  return <AppShell>{children}</AppShell>
}
