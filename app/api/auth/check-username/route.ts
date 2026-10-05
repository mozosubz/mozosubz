import { createClient } from "@supabase/supabase-js"
import { checkRateLimit, getRateLimitIdentifier, RATE_LIMIT_CONFIG } from "@/lib/utils/rate-limit"

// Edge runtime keeps cold starts and round-trips fast.
export const runtime = "edge"
export const dynamic = "force-dynamic"

const USERNAME_RX = /^[a-z0-9_-]+$/

export async function POST(request: Request) {
  try {
    // Bounty fix: this endpoint is a user-enumeration oracle — throttle it.
    const { allowed } = await checkRateLimit(
      getRateLimitIdentifier(request),
      RATE_LIMIT_CONFIG.AUTH_CHECK
    )
    if (!allowed) {
      return Response.json(
        { available: false, error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } }
      )
    }

    const { username } = await request.json()

    if (!username || typeof username !== "string") {
      return Response.json({ available: false, error: "Invalid username" }, { status: 400 })
    }

    const trimmedUsername = username.toLowerCase().trim()

    if (trimmedUsername.length < 3) {
      return Response.json({ available: false, error: "Username too short" })
    }

    // Bounty fix: 500-char usernames were accepted as "available" — enforce a max.
    if (trimmedUsername.length > 30) {
      return Response.json({ available: false, error: "Username too long" })
    }

    if (!USERNAME_RX.test(trimmedUsername)) {
      return Response.json({ available: false, error: "Invalid characters" })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      // Fail CLOSED so we never accidentally tell the user a username is free
      // when we couldn't actually verify.
      return Response.json({ available: false, error: "Server config error" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })

    // Indexed lookup against profiles.username
    // (partial unique index uniq_profiles_username_lower).
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("username", trimmedUsername)
      .limit(1)

    if (error) {
      return Response.json(
        { available: false, error: "Could not verify username" },
        { status: 500 },
      )
    }

    const available = (count ?? 0) === 0

    return Response.json(
      { available, checked: true },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return Response.json({ available: false, error: "Server error" }, { status: 500 })
  }
}
