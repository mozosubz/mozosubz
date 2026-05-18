/**
 * Resend email client.
 *
 * API details (verified against https://resend.com/docs):
 *  - Base URL: https://api.resend.com (UNVERSIONED — no /v1/ prefix)
 *  - Endpoint: POST /emails
 *  - Auth:     Authorization: Bearer re_xxx
 *  - REQUIRED: User-Agent header. Missing it returns 403 / error code 1010
 *              even with a valid API key. We set it explicitly below.
 *  - Tags:     array of { name, value }. Values must match /^[A-Za-z0-9_-]+$/
 *              and be <= 256 chars (sanitized below).
 *  - Rate:     5 req/s per team (default).
 *
 * Design goals:
 *  - Never throws. Email is a side-effect — a failure here must NEVER roll
 *    back a successful wallet credit or purchase.
 *  - Fire-and-forget from the call site.
 *  - Respects email_preferences (marketing vs transactional).
 *
 * Env vars (priority order — first non-empty wins):
 *   RESEND_API_KEY            (required)
 *   RESEND_FROM_EMAIL  | UNOSEND_FROM_EMAIL  (legacy fallback)
 *   RESEND_FROM_NAME   | UNOSEND_FROM_NAME   (legacy fallback)
 */

import { createClient } from "@supabase/supabase-js"

export type EmailCategory = "transactional" | "marketing"

export interface SendEmailOptions {
  to: string
  userId?: string // used to check email_preferences
  subject: string
  html: string
  category: EmailCategory
  // A short label used to group emails in the Resend dashboard.
  tag?: string
}

const RESEND_ENDPOINT = "https://api.resend.com/emails"

function pickEnv(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k]
    if (v && v.trim()) return v.trim()
  }
  return undefined
}

function getFromHeader(): string {
  const email = pickEnv("RESEND_FROM_EMAIL", "UNOSEND_FROM_EMAIL")
  const name = pickEnv("RESEND_FROM_NAME", "UNOSEND_FROM_NAME") || "Mozosubz"
  if (!email) return "Mozosubz <no-reply@mozosubz.com>"
  // RFC 5322 display-name format: "Name <email@domain>"
  return `${name} <${email}>`
}

/**
 * Resend tag values must match /^[A-Za-z0-9_-]+$/ and be <= 256 chars.
 * Sanitize defensively so a stray character never breaks a send.
 */
function sanitizeTag(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256) || "general"
}

/**
 * Check the email_preferences table for this user and category. If no row
 * exists, we treat the user as opted-in (default).
 *
 * Transactional emails (receipts) are always sent regardless of preference —
 * users have a legal right to receipts. Only marketing is gated.
 */
async function shouldSend(userId: string | undefined, category: EmailCategory): Promise<boolean> {
  // Transactional emails always send.
  if (category === "transactional") return true

  // Marketing without a userId — assume opted in (e.g. welcome email for
  // a brand-new signup whose id we already have).
  if (!userId) return true

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) return true // fail-open on misconfig

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data } = await admin
      .from("email_preferences")
      .select("marketing_enabled")
      .eq("user_id", userId)
      .maybeSingle()

    if (!data) return true // no row → opted in
    return data.marketing_enabled !== false
  } catch (err) {
    console.error("[email] shouldSend lookup failed (failing open):", err)
    return true
  }
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ sent: boolean; skipped?: string }> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.warn("[email] RESEND_API_KEY not set — skipping send")
      return { sent: false, skipped: "no_api_key" }
    }

    if (!opts.to || !opts.to.includes("@")) {
      return { sent: false, skipped: "invalid_recipient" }
    }

    const allowed = await shouldSend(opts.userId, opts.category)
    if (!allowed) {
      console.log("[email] user opted out of", opts.category, "— skipping")
      return { sent: false, skipped: "opted_out" }
    }

    const tagValue = sanitizeTag(opts.tag || opts.category)

    const body = {
      from: getFromHeader(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      // Resend uses an array of {name, value} pairs (different shape from
      // the previous provider which took a single string). We expose two
      // tags so the dashboard groups by both category and event type.
      tags: [
        { name: "category", value: sanitizeTag(opts.category) },
        { name: "type", value: tagValue },
      ],
    }

    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Required by Resend — requests without User-Agent are rejected
        // with 403 / error code 1010. See client header docs.
        "User-Agent": "mozosubz/1.0 (+https://mozosubz.com)",
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.error("[email] Resend failed", res.status, text)
      return { sent: false, skipped: `http_${res.status}` }
    }

    return { sent: true }
  } catch (err) {
    console.error("[email] send exception (swallowed):", err)
    return { sent: false, skipped: "exception" }
  }
}
