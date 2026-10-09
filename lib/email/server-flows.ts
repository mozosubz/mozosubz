import "server-only"

import { headers } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email/client"
import { buildUnsubscribeUrl } from "@/lib/email/unsubscribe"
import { loginAlertEmail } from "@/lib/email/templates/login-alert"
import { welcomeEmail } from "@/lib/email/templates/welcome"

function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://mozosubz.xyz").replace(/\/$/, "")
}

/**
 * Cheap, dependency-free UA parser. Returns a human-readable device string
 * like "Chrome on Windows" or "Safari on iPhone". Good enough for a
 * security email — not a fingerprint.
 */
function parseUserAgent(ua: string): string {
  if (!ua) return "Unknown device"

  let browser = "Unknown browser"
  if (/Edg\//i.test(ua)) browser = "Edge"
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera"
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome"
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari"
  else if (/Firefox\//i.test(ua)) browser = "Firefox"

  let os = "Unknown OS"
  if (/iPhone|iPod/i.test(ua)) os = "iPhone"
  else if (/iPad/i.test(ua)) os = "iPad"
  else if (/Android/i.test(ua)) os = "Android"
  else if (/Windows NT/i.test(ua)) os = "Windows"
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS"
  else if (/Linux/i.test(ua)) os = "Linux"

  return `${browser} on ${os}`
}

/**
 * Sends the "new sign-in" security email. Called from signInAction via
 * after(), so it runs after the response is sent and never blocks login.
 * IP and device come from request headers — the client never supplies them.
 */
export async function sendLoginAlertEmail(userId: string, email: string): Promise<void> {
  try {
    const hdrs = await headers()
    const xff = hdrs.get("x-forwarded-for")
    const ip = xff ? xff.split(",")[0]!.trim() : hdrs.get("x-real-ip") || hdrs.get("cf-connecting-ip") || "Unknown"
    const device = parseUserAgent(hdrs.get("user-agent") || "")

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, username")
      .eq("id", userId)
      .maybeSingle()

    if (!profile) return

    const firstName =
      (profile.full_name as string | undefined)?.split(" ")[0] ||
      (profile.username as string | undefined) ||
      email.split("@")[0] ||
      "there"

    const { subject, html } = loginAlertEmail({
      firstName,
      signInAt: new Date(),
      ipAddress: ip,
      device,
      secureAccountUrl: `${getAppUrl()}/dashboard/profile`,
      unsubscribeUrl: buildUnsubscribeUrl(profile.id as string, "transactional"),
    })

    await sendEmail({
      to: email,
      userId: profile.id as string,
      subject,
      html,
      category: "transactional",
      tag: "login_alert",
    })
  } catch (err) {
    // Never surface email errors to the user — they are already logged in.
    console.error("login alert email failed:", err)
  }
}

/**
 * Sends the welcome email to a brand-new signup. Called from signUpAction
 * via after() with the userId resolved server-side from the signup result —
 * the client never passes identifiers, so this cannot be abused to spam
 * arbitrary inboxes.
 */
export async function sendWelcomeEmail(userId: string, email: string, fullName: string): Promise<void> {
  try {
    const base = getAppUrl()
    const firstName = fullName.split(" ")[0] || email.split("@")[0] || "there"

    const { subject, html } = welcomeEmail({
      firstName,
      dashboardUrl: `${base}/dashboard`,
      unsubscribeUrl: buildUnsubscribeUrl(userId, "marketing"),
    })

    await sendEmail({
      to: email,
      userId,
      subject,
      html,
      category: "marketing",
      tag: "welcome",
    })
  } catch (err) {
    console.error("welcome email failed:", err)
  }
}
