import { NextRequest, NextResponse } from "next/server"
import { isFallbackAdmin } from "@/lib/utils/hardcoded-admin"
import { checkRateLimit, RATE_LIMIT_CONFIG, getRateLimitCount, clearRateLimit } from "@/lib/utils/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    // Admin check - authenticate caller via Supabase session
    const supabase = await createServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Admin means profiles.is_admin in the database — the single source of truth.
    const { data: adminProfile } = await createAdminClient()
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()

    if (!adminProfile?.is_admin && !isFallbackAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const { identifier, type = "ip" } = await request.json()

    if (!identifier) {
      return NextResponse.json({ error: "Identifier (IP or email) required" }, { status: 400 })
    }

    let lookupIdentifier = identifier

    // If email provided, we need to find the IP from the signup logs
    // For now, we'll also try clearing by email directly as a fallback
    if (type === "email") {
      try {
        const supabase = createAdminClient()
        
        // Try to find user profile to get their email
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", identifier.toLowerCase())
          .single()

        if (!profile) {
          return NextResponse.json(
            { error: `Email '${identifier}' not found in system` },
            { status: 404 }
          )
        }

        // We'll clear using email as the lookup key since rate limiting uses IP
        // but we're providing a convenience method to clear by email
        lookupIdentifier = identifier.toLowerCase()
        
      } catch (error) {
        console.error("[v0] Email lookup error:", error)
        return NextResponse.json(
          { error: "Failed to lookup email" },
          { status: 400 }
        )
      }
    }

    // Get the rate limit config for signup
    const config = RATE_LIMIT_CONFIG.AUTH_REGISTER

    // Get current count before clearing
    const currentCount = await getRateLimitCount(lookupIdentifier, config.keyPrefix)

    // Clear the rate limit
    const success = await clearRateLimit(lookupIdentifier, config.keyPrefix)

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Rate limit cleared for ${type === "email" ? "email: " + identifier : "IP: " + identifier}`,
        previousCount: currentCount,
        maxAllowed: config.maxRequests,
      })
    } else {
      return NextResponse.json(
        { error: "Failed to clear rate limit" },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("[v0] Clear rate limit error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
