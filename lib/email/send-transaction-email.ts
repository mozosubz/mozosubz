/**
 * Resolves the recipient (from auth.users/profiles) and fires the transaction
 * receipt email. Intentionally non-throwing so callers can fire-and-forget.
 */
"use server"

import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "./client"
import { buildUnsubscribeUrl } from "./unsubscribe"
import { transactionEmail, type TxCategory, type TxStatus } from "./templates/transaction"

interface Input {
  userId: string
  category: TxCategory
  serviceName: string
  amount: number
  status: TxStatus
  transactionId: string
  paymentMethod?: string
  extras?: Array<{ label: string; value: string }>
}

/**
 * All transaction emails link directly to the specific transaction detail page.
 * Deep-links to /dashboard/transactions/<transactionId> for full receipt view.
 */
function buildActionUrl(base: string, input: Input): string {
  return `${base}/dashboard/transactions/${encodeURIComponent(input.transactionId)}`
}

function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://mozosubz.xyz").replace(/\/$/, "")
}

async function resolveRecipient(userId: string): Promise<{ email: string; firstName: string } | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      console.warn("[email] missing SUPABASE_SERVICE_ROLE_KEY — cannot resolve recipient")
      return null
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Always get the email from auth.users (source of truth, guaranteed column).
    const { data: userResp, error: authErr } = await admin.auth.admin.getUserById(userId)
    if (authErr) {
      console.error("[email] auth.admin.getUserById error:", authErr)
      return null
    }
    const email = userResp?.user?.email || null
    if (!email) return null

    // Best-effort display name from profiles. If the column doesn't exist or
    // the row is missing, we fall back gracefully to the email prefix.
    let fullName = ""
    let username = ""
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name, username")
        .eq("id", userId)
        .maybeSingle()
      fullName = (profile?.full_name as string | undefined) || ""
      username = (profile?.username as string | undefined) || ""
    } catch (err) {
      console.warn("[email] profile lookup failed (continuing):", err)
    }

    const firstName = fullName.split(" ")[0] || username || email.split("@")[0] || "there"
    return { email, firstName }
  } catch (err) {
    console.error("[email] resolveRecipient failed:", err)
    return null
  }
}

export async function sendTransactionEmail(input: Input): Promise<void> {
  try {
    // Only send on SUCCESS. Failures auto-refund silently — we don't want to
    // spam the user with every provider hiccup that was fixed by a refund.
    if (input.status !== "SUCCESS") {
      console.log("[email] Skipping non-SUCCESS email | Status:", input.status)
      return
    }

    console.log("[email] sendTransactionEmail starting | UserId:", input.userId, "| Category:", input.category)

    const recipient = await resolveRecipient(input.userId)
    if (!recipient) {
      console.warn("[email] Could not resolve recipient for user:", input.userId)
      return
    }

    console.log("[email] Resolved recipient:", recipient.email)

  const base = getAppUrl()
  console.log("[email] Building email template | Base URL:", base)
  
  const { subject, html } = transactionEmail({
    firstName: recipient.firstName,
    category: input.category,
    serviceName: input.serviceName,
    amount: input.amount,
    status: input.status,
    transactionId: input.transactionId,
    paymentMethod: input.paymentMethod || (input.category === "WALLET_FUND" ? "Bank Transfer" : "Wallet"),
    createdAt: new Date(),
    actionUrl: buildActionUrl(base, input),
    unsubscribeUrl: buildUnsubscribeUrl(input.userId, "transactional"),
    extras: input.extras,
  })

  console.log("[email] Sending email | To:", recipient.email, "| Subject:", subject)

  const result = await sendEmail({
    to: recipient.email,
    userId: input.userId,
    subject,
    html,
    category: "transactional",
    tag: `tx_${input.category.toLowerCase()}`,
  })

  console.log("[email] Email send result:", result)
  } catch (err) {
    console.error("[email] sendTransactionEmail error:", err)
  }
}
