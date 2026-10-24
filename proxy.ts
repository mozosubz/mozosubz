import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { logRequest, logResponse, formatLog } from "@/lib/api-logger"

// Paths that are commonly scanned by bots looking for exposed credentials.
// Block these silently to keep logs clean and prevent info leakage.
const BLOCKED_PATHS = [
  "/.env",
  "/.env.local",
  "/.env.production",
  "/.aws/credentials",
  "/backend/.env",
  "/api/.env",
  "/app/.env",
  "/config/credentials.json",
  "/config/service-account.json",
  "/credentials.json",
  "/client_secret.json",
  "/client_secrets.json",
  "/secrets.json",
  "/key.json",
  "/keyfile.json",
  "/firebase.json",
  "/firebase-credentials.json",
  "/firebase-adminsdk.json",
  "/firebase-service-account.json",
  "/serviceAccountKey.json",
  "/gcp-credentials.json",
  "/gcp-service-account.json",
  "/google-credentials.json",
  "/google-service-account.json",
  "/sa-key.json",
  "/app/credentials.json",
  "/service-account.json",
  "/application_default_credentials.json",
]

/**
 * NOTE (2026-10-13): unauthenticated redirects deliberately do NOT clear the
 * sb-* cookies any more. Clearing on a transient auth failure hard-signed
 * users out mid-session. The /login ↔ /dashboard loop is instead made
 * impossible structurally: /login is never forwarded (see the guard below),
 * so it is always a terminal page.
 *
 * NOTE (2026-10-14): every response returned AFTER the auth check below must
 * carry the cookies @supabase/ssr attached to `supabaseResponse`. When
 * `getUser()` refreshes an expiring session, Supabase ROTATES the refresh
 * token — if that Set-Cookie never reaches the browser, the browser keeps the
 * old, now-invalidated token, its next refresh fails and the user is bounced
 * to /login (and the login page then signs the dead session out). The
 * hardcoded-admin branch here returned a bare NextResponse.next(), which is
 * exactly why the owner's admin account seemed to "log out" when navigating
 * between admin pages.
 */

export async function proxy(request: NextRequest) {
  // Canonical host. www and the apex both serve this app, but Supabase auth
  // cookies are host-only: a session created on mozosubz.xyz is invisible on
  // www.mozosubz.xyz, so a user who enters via the other host gets bounced to
  // /login every time ("have to log in again whenever I come back"). 308
  // everything to the apex host, path and query preserved. api.mozosubz.xyz is
  // a different deployment surface and must not be touched.
  const host = (request.headers.get("host") || "").toLowerCase()
  if (host === "www.mozosubz.xyz") {
    const url = request.nextUrl.clone()
    url.protocol = "https"
    url.host = "mozosubz.xyz"
    return NextResponse.redirect(url, 308)
  }

  const pathname = request.nextUrl.pathname.toLowerCase()

  // Log API requests
  if (pathname.startsWith('/api/')) {
    const requestLog = logRequest(request)
    console.log(`[API] → ${request.method} ${pathname}`)
  }

  // Block known credential-scanning probes before any other processing
  if (BLOCKED_PATHS.some((path) => pathname === path || pathname.endsWith(path))) {
    return new NextResponse(null, { status: 404 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If Supabase is not configured, skip auth checks
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({
      request,
    })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    })

    // Carry any refreshed auth cookies onto redirects and pass-throughs.
    const redirectWithAuthCookies = (url: URL): NextResponse => {
      const response = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
      return response
    }
    const redirectToLogin = (): NextResponse => {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.search = "?expired=1"
      return redirectWithAuthCookies(url)
    }

    // Handle Supabase email confirmation PKCE code exchange.
    // When a user clicks the email confirmation link, Supabase redirects back
    // with ?code=xxx. Check if this is a recovery (password reset) or signup confirmation.
    const code = request.nextUrl.searchParams.get("code")
    const type = request.nextUrl.searchParams.get("type")
    
    if (code) {
      // For recovery (password reset) links, DON'T exchange the code here
      // Pass it to reset-password page and let them handle it
      if (type === "recovery") {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = "/reset-password"
        redirectUrl.search = `?code=${code}`
        return NextResponse.redirect(redirectUrl)
      }

      // For email confirmations (signup), exchange the code for a session
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (!exchangeError) {
        // Redirect to dashboard after email confirmation
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = "/dashboard"
        redirectUrl.search = "?confirmed=1"

        const redirectResponse = NextResponse.redirect(redirectUrl)
        // Preserve the auth cookies set by exchangeCodeForSession.
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie.name, cookie.value)
        })
        return redirectResponse
      }
      // If exchange fails, continue — the login redirect below will catch it
      // and the user can sign in manually or retry.
    }

    // Get user with authentication - more secure than getSession()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Check if accessing admin routes
    const isAdminRoute = request.nextUrl.pathname.startsWith("/admin")

    if (isAdminRoute) {
      // Unauthenticated users trying to access admin
      if (!user) {
        return new NextResponse("Not Found", { status: 404 })
      }

      // Admin access = profiles.is_admin in the database — one source of truth,
      // no hardcoded or env-based email lists. (When this was a bespoke branch
      // it also had to hand-carry refreshed cookies; now the request simply
      // falls through to the supabaseResponse return below.)
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      // Fallback: the ADMIN_EMAILS list keeps a known address working even if
      // its DB flag is missing (see lib/utils/hardcoded-admin.ts).
      if (!profile?.is_admin && !isFallbackAdmin(user.email)) {
        console.warn('[proxy] admin 404 — not admin:', user.email, request.nextUrl.pathname)
        return new NextResponse("Not Found", { status: 404 })
      }
    }

    // Redirect unauthenticated users to login (except public pages and auth
    // pages). /login itself is never forwarded back (see below), so this can
    // never ping-pong with the login page.
    if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
      // Diagnostic: shows in Vercel runtime logs when a session fails to
      // resolve, with whether cookies were present at all.
      console.warn('[proxy] unauth bounce:', request.nextUrl.pathname, '| cookies:', request.cookies.getAll().filter((c) => c.name.startsWith('sb-')).length)
      return redirectToLogin()
    }

    // Protect /integrations/* (e.g. Connect Keys) — not public.
    if (!user && request.nextUrl.pathname.startsWith("/integrations")) {
      return redirectToLogin()
    }

    // Also protect admin routes for unauthenticated users
    if (!user && request.nextUrl.pathname.startsWith("/admin")) {
      console.warn('[proxy] unauth admin bounce:', request.nextUrl.pathname, '| cookies:', request.cookies.getAll().filter((c) => c.name.startsWith('sb-')).length)
      return redirectToLogin()
    }

    // NOTE: authenticated users are intentionally NOT redirected away from
    // /login any more. That forward was one half of the /login ↔ /dashboard
    // redirect loop (the other half being the dashboard's auth check): when
    // the two checks disagreed for a stale/rotating token the pair bounced
    // forever. Leaving /login as a normal page makes the cycle impossible.
    // Signed-in users who open /login simply see the form.

    // Allow authenticated users to access reset-password page
    // (they may have a recovery session from clicking password reset link)
    // Don't redirect them away from this page
    if (request.nextUrl.pathname === "/reset-password") {
      return supabaseResponse
    }

    // Allow signup process even for partially authenticated users (unconfirmed emails)
    // Only redirect from /register if they're FULLY authenticated (email confirmed)
    if (user && request.nextUrl.pathname === "/register") {
      // Check if email is confirmed - if yes, they should be in dashboard/register-success flow
      if (user.email_confirmed_at) {
        const url = request.nextUrl.clone()
        url.pathname = "/dashboard"
        return redirectWithAuthCookies(url)
      }
      // Allow unconfirmed users to stay on /register page
    }

    // Also allow unconfirmed users to view register-success page
    // Don't redirect from register-success - they need to confirm email first

    // Redirect authenticated users from landing page to dashboard
    if (user && request.nextUrl.pathname === "/") {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return redirectWithAuthCookies(url)
    }

    // /register-success is intentionally public: Supabase signUp() with email
    // confirmation enabled does NOT create a session, so the just-signed-up
    // user has no auth cookies yet. Redirecting unauthenticated users away
    // from this page broke the entire confirmation flow — they'd be bounced
    // back to /register the moment we tried to navigate them to success.
    // The page reads `email` from the URL and renders a static message, so
    // it doesn't need authentication.

    return supabaseResponse
  } catch (error) {
    // On error, allow the request to continue — but still hand back whatever
    // auth cookies were attached before the failure.
    return supabaseResponse
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
