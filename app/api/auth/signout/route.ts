import { NextRequest, NextResponse } from "next/server"
import { signOut } from "@/lib/actions/auth"
import { createServerClient } from "@/lib/supabase/server"

/**
 * GET /api/auth/signout?banned=1
 *
 * Cookie-clearing redirect target. Server Components (e.g. the dashboard
 * layout when it detects a banned account) cannot write cookies, so they
 * redirect here and this Route Handler signs the session out before sending
 * the browser back to the login page.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    await supabase.auth.signOut()
  } catch {
    // An expired/revoked refresh token can make signOut throw — the explicit
    // cookie clearing below still runs, which is what breaks redirect loops.
  }

  const banned = request.nextUrl.searchParams.get("banned") === "1"
  const nextParam = request.nextUrl.searchParams.get("next")
  const base = nextParam && nextParam.startsWith("/") ? nextParam : "/login"

  const url = new URL(base, request.url)
  if (banned) url.searchParams.set("banned", "1")
  const response = NextResponse.redirect(url)

  // Belt and braces: expire any sb-* cookie the signOut call did not clear,
  // so the next request cannot re-trigger the /login ↔ /dashboard bounce.
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 })
    }
  }

  return response
}

export async function POST() {
  await signOut()
  return NextResponse.json({ success: true })
}
