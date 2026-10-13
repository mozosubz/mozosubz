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
  const supabase = await createServerClient()
  await supabase.auth.signOut()

  const banned = request.nextUrl.searchParams.get("banned") === "1"
  const nextParam = request.nextUrl.searchParams.get("next")
  const base = nextParam && nextParam.startsWith("/") ? nextParam : "/login"

  const url = new URL(base, request.url)
  if (banned) url.searchParams.set("banned", "1")
  return NextResponse.redirect(url)
}

export async function POST() {
  await signOut()
  return NextResponse.json({ success: true })
}
