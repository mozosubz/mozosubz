"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { checkRateLimit } from "@/lib/utils/rate-limit"
import { isDisposableEmail } from "@/lib/utils/disposable-email"
import { after } from "next/server"
import { sendLoginAlertEmail, sendWelcomeEmail } from "@/lib/email/server-flows"
import { EMAIL_RX, RESERVED_USERNAMES, USERNAME_RX } from "@/lib/utils/profile-validation"

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

async function getClientIp(): Promise<string> {
  const headerList = await headers()
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown"
  )
}

/**
 * Bounty fix: the login form used to call supabase.auth.signInWithPassword
 * directly from the browser, so anyone with the public anon key could hit
 * /auth/v1/token themselves and brute-force passwords with no throttle at
 * all (30 wrong passwords in a row returned 200s). Password verification now
 * happens here, on the server, behind two limiters:
 *   - per IP+email: slows attacks on a specific account
 *   - per IP: slows attackers rotating target emails
 * The browser never sends credentials to Supabase directly anymore.
 */
export async function signInAction(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = String(email || "").trim().toLowerCase()
  const trimmedPassword = String(password || "")
  if (!normalizedEmail || !trimmedPassword) {
    return { success: false, error: "Email and password are required" }
  }

  const ip = await getClientIp()

  // 10 attempts per 5 min per IP+email pair (existing policy, now enforced
  // on the only path that reaches Supabase).
  const perTarget = await checkRateLimit(`${ip}:${normalizedEmail}`, {
    interval: 300000,
    maxRequests: 10,
    keyPrefix: "rl:auth:login",
  })
  if (!perTarget.allowed) {
    return {
      success: false,
      error: "Too many login attempts. Please wait a few minutes and try again.",
    }
  }

  // 30 attempts per 15 min per IP across all emails — catches credential
  // stuffing that rotates targets to dodge the per-email limiter.
  const perIp = await checkRateLimit(ip, {
    interval: 900000,
    maxRequests: 30,
    keyPrefix: "rl:auth:login-ip",
  })
  if (!perIp.allowed) {
    return {
      success: false,
      error: "Too many login attempts from your network. Please wait a few minutes and try again.",
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: trimmedPassword,
  })
  if (error) {
    // Generic message: never reveal whether the email exists.
    return { success: false, error: "Invalid email or password" }
  }

  // Single-device login: revoke every OTHER refresh token for this user so
  // other devices lose access on their next token refresh. The session
  // manager on /dashboard picks up the SIGNED_OUT event and redirects them.
  supabase.auth.signOut({ scope: "others" }).catch(() => {})

  // Security alert email runs after the response is sent — never blocks login.
  const signedInUserId = data?.user?.id
  if (signedInUserId) {
    after(() => sendLoginAlertEmail(signedInUserId, normalizedEmail))
  }

  return { success: true }
}

/**
 * Bounty fix: signup used to call supabase.auth.signUp directly from the
 * browser, so the disposable-email and validation checks only ever ran on
 * the client — attackers signed up with 1secmail.com addresses via direct
 * REST calls. Signup now runs here where those checks are authoritative.
 */
export async function signUpAction(input: {
  fullName: string
  username: string
  email: string
  phone: string
  password: string
}): Promise<{ success: boolean; error?: string }> {
  const fullName = String(input.fullName || "").trim()
  const username = String(input.username || "").toLowerCase().trim()
  const email = String(input.email || "").toLowerCase().trim()
  const phoneDigits = String(input.phone || "").replace(/\D/g, "")
  const password = String(input.password || "")

  if (!fullName || fullName.length > 80) {
    return { success: false, error: "Full name required (max 80 characters)" }
  }
  if (username.length < 3 || username.length > 30 || !USERNAME_RX.test(username)) {
    return { success: false, error: "Username must be 3-30 characters: lowercase letters, numbers, hyphens" }
  }
  if (RESERVED_USERNAMES.has(username)) {
    return { success: false, error: "That username is reserved" }
  }
  if (!EMAIL_RX.test(email)) {
    return { success: false, error: "Invalid email format" }
  }
  if (isDisposableEmail(email)) {
    return { success: false, error: "Disposable email addresses are not allowed" }
  }
  if (phoneDigits.length !== 11) {
    return { success: false, error: "Phone must be exactly 11 digits" }
  }
  // Raised from Supabase's default 6 — 6-char passwords fall to trivial
  // brute force on a payments platform.
  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" }
  }

  const ip = await getClientIp()
  // 5 signups per hour per IP — account farming becomes expensive.
  const throttle = await checkRateLimit(ip, {
    interval: 3600000,
    maxRequests: 5,
    keyPrefix: "rl:auth:signup",
  })
  if (!throttle.allowed) {
    return { success: false, error: "Too many signup attempts. Please try again later." }
  }

  const supabase = await createClient()
  const headerList = await headers()
  const origin =
    process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
    headerList.get("origin") ||
    `${headerList.get("x-forwarded-proto") || "https"}://${headerList.get("x-forwarded-host") || "localhost:3000"}`

  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/dashboard`,
      data: {
        full_name: fullName,
        username,
        phone: phoneDigits,
      },
    },
  })

  if (signUpError) {
    // Map the common Supabase errors to friendly, non-enumerating messages.
    if (/already|registered|exists/i.test(signUpError.message)) {
      return { success: false, error: "Email already registered" }
    }
    return { success: false, error: "Registration failed. Please check your details and try again." }
  }

  // Supabase's email-enumeration protection: an existing email returns no
  // error but an empty identities array.
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { success: false, error: "Email already registered" }
  }

  if (!data?.user?.id) {
    return { success: false, error: "Registration failed. Please try again." }
  }

  // Welcome email runs after the response is sent — never blocks signup.
  const newUserId = data.user.id
  after(() => sendWelcomeEmail(newUserId, email, fullName))

  return { success: true }
}

/**
 * Bounty fix: the forgot-password form called supabase.auth.resetPasswordForEmail
 * directly from the browser. The request now runs server-side behind a rate
 * limiter, and the response never reveals whether the email is registered.
 */
export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = String(email || "").trim().toLowerCase()
  if (!EMAIL_RX.test(normalizedEmail)) {
    return { success: false, error: "Enter a valid email address" }
  }

  const ip = await getClientIp()
  const throttle = await checkRateLimit(`${ip}:${normalizedEmail}`, {
    interval: 300000,
    maxRequests: 5,
    keyPrefix: "rl:auth:reset",
  })
  if (!throttle.allowed) {
    return { success: false, error: "Too many attempts. Please wait a few minutes and try again." }
  }

  const supabase = await createClient()
  const headerList = await headers()
  const origin =
    headerList.get("origin") ||
    `${headerList.get("x-forwarded-proto") || "https"}://${headerList.get("x-forwarded-host") || "localhost:3000"}`

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: `${origin}/reset-password`,
  })
  if (error) {
    // Ops visibility only — the client always sees the generic success screen.
    console.error("password reset request failed:", error.message)
  }

  return { success: true }
}
