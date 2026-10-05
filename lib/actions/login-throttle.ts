"use server"

import { headers } from "next/headers"
import { checkRateLimit } from "@/lib/utils/rate-limit"

/**
 * Bounty fix: login had no brute-force throttle (30 bad passwords in a row
 * still returned 200). The login form must consume one token from this
 * server-side limiter BEFORE calling supabase.auth.signInWithPassword.
 * Keyed on IP + email so an attacker is slowed per-source and per-target.
 */
export async function consumeLoginAttempt(email: string): Promise<{ allowed: boolean; resetAt?: number }> {
  const normalizedEmail = String(email || "").trim().toLowerCase()
  if (!normalizedEmail) {
    return { allowed: false }
  }

  const headerList = await headers()
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown"

  // 10 attempts per 5 minutes per IP+email pair.
  const { allowed, resetAt } = await checkRateLimit(
    `${ip}:${normalizedEmail}`,
    { interval: 300000, maxRequests: 10, keyPrefix: "rl:auth:login" }
  )

  return { allowed, resetAt }
}
