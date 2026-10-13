import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isHardcodedAdmin } from "@/lib/utils/hardcoded-admin"
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
 * Expire every supabase auth cookie on an outgoing redirect.
 *
 * Used when the proxy decides the visitor is unauthenticated but the request
 * still carries sb-* cookies (expired/revoked session, or the auth service
 * hiccuped). Without this, /dashboard and /login can redirect to each other
 * forever — ERR_TOO_MANY_REDIRECTS — because each hop re-evaluates the same
 * unusable cookie with opposite outcomes.
 */
function clearAuthCookiesOn(request: NextRequest, response: NextResponse): NextResponse {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 })
    }
  }
  return response
}

export async function proxy(request: NextRequest) {
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

      // Check hardcoded admin email first
      const isAdmin = isHardcodedAdmin(user.email)
      
      if (isAdmin) {
        // Set is_admin=true in the profiles table for this user
        // This ensures the database reflects the admin status
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ is_admin: true })
          .eq('id', user.id)
        
        if (updateError) {
          // Silent fail - admin flag update is non-critical
        }
        
        return NextResponse.next({
          request,
        })
      }
      
      // Check if user has admin flag in database
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
      
      if (!profile?.is_admin) {
        return new NextResponse("Not Found", { status: 404 })
      }
    }

    // Redirect unauthenticated users to login (except public pages and auth pages).
    // The redirect ALSO expires any sb-* cookies present: an unusable session
    // cookie (expired/revoked, or the auth service was briefly unreachable)
    // would otherwise ping-pong between /dashboard (!user → /login) and
    // /login (user → /dashboard) forever — ERR_TOO_MANY_REDIRECTS. Clearing
    // the cookie here makes the next /login render (terminal, no forward).
    //
    // The target carries `?expired=1`: browsers that cached the old bare
    // /login → /dashboard 307 (served with a 1-hour Cache-Control before the
    // no-store fix) keep replaying it from cache. A parameterised URL was
    // never cached, so the cycle can't survive in those browsers either.
    if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.search = "?expired=1"
      return clearAuthCookiesOn(request, NextResponse.redirect(url))
    }

    // Protect /integrations/* (e.g. Connect Keys) — not public.
    if (!user && request.nextUrl.pathname.startsWith("/integrations")) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.search = "?expired=1"
      return clearAuthCookiesOn(request, NextResponse.redirect(url))
    }

    // Also protect admin routes for unauthenticated users
    if (!user && request.nextUrl.pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.search = "?expired=1"
      return clearAuthCookiesOn(request, NextResponse.redirect(url))
    }

    // Redirect authenticated users away from login (only login page, not register or register-success)
    if (user && request.nextUrl.pathname === "/login") {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }

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
        return NextResponse.redirect(url)
      }
      // Allow unconfirmed users to stay on /register page
    }

    // Also allow unconfirmed users to view register-success page
    // Don't redirect from register-success - they need to confirm email first

    // Redirect authenticated users from landing page to dashboard
    if (user && request.nextUrl.pathname === "/") {
      const url = request.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
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
    // On error, allow the request to continue
    return NextResponse.next({
      request,
    })
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
