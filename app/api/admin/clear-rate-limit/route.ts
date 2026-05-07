import { NextRequest, NextResponse } from "next/server"
import { isHardcodedAdmin } from "@/lib/utils/hardcoded-admin"
import { clearRateLimit, getRateLimitCount, RATE_LIMIT_CONFIG } from "@/lib/utils/rate-limit"

export async function POST(request: NextRequest) {
  try {
    // Admin check
    const user = await isHardcodedAdmin(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { ipAddress, endpoint } = await request.json()

    if (!ipAddress || !endpoint) {
      return NextResponse.json({ error: "Missing ipAddress or endpoint" }, { status: 400 })
    }

    // Get the rate limit config for the endpoint
    const config = (RATE_LIMIT_CONFIG as any)[endpoint]
    if (!config) {
      return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 })
    }

    // Get current count before clearing
    const currentCount = await getRateLimitCount(ipAddress, config.keyPrefix)

    // Clear the rate limit
    const success = await clearRateLimit(ipAddress, config.keyPrefix)

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Rate limit cleared for ${endpoint}`,
        ipAddress,
        endpoint,
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
