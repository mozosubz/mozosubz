import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { LoginForm } from "@/components/login-form"

/**
 * Server guard: the Supabase session cookie is HttpOnly, so a stale/revoked
 * session (single-device login revokes the previous refresh token) cannot be
 * cleared from the browser. Without this, /login and /dashboard redirect to
 * each other forever (ERR_TOO_MANY_REDIRECTS) and the user can never reach
 * the form. If the cookie exists but the server rejects the session, we drop
 * every supabase auth cookie here and render the form.
 */
async function clearDeadSession() {
  try {
    const { createServerClient } = await import("@/lib/supabase/server")
    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()
    const hasAuthCookie = cookieStore.getAll().some((c) => c.name.startsWith("sb-"))
    if (!hasAuthCookie) return

    const supabase = await createServerClient()
    const { error } = await supabase.auth.getUser()
    if (!error) return // session is still valid — nothing to clear

    // Only destroy the session when Supabase says the session itself is dead.
    // A transient/network error must NOT sign the user out — that made brief
    // outages (and auth races) look like random logouts. The form still
    // renders either way.
    const message = (error.message || "").toLowerCase()
    const sessionIsDead =
      message.includes("invalid refresh token") ||
      message.includes("refresh token not found") ||
      message.includes("invalid claim") ||
      message.includes("auth session missing") ||
      message.includes("user from sub claim in jwt does not exist")
    if (!sessionIsDead) return

    try {
      await supabase.auth.signOut()
    } catch {
      // An expired refresh token cannot be revoked via the API — expire the
      // cookies directly instead.
    }
    for (const c of cookieStore.getAll()) {
      if (c.name.startsWith("sb-")) {
        cookieStore.set(c.name, "", { path: "/", maxAge: 0 })
      }
    }
  } catch {
    // Never block the login form on cleanup failure.
  }
}

export default async function LoginPage() {
  await clearDeadSession()
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-blue-200 animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
