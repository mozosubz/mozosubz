import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "./client"
import { buildUnsubscribeUrl } from "./unsubscribe"
import { whatsappEventEmail, type WhatsAppEventType } from "./templates/whatsapp-event"

interface Input {
  userId: string
  eventType: WhatsAppEventType
  whatsappPhone: string
}

function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://mozosubz.com").replace(/\/$/, "")
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

    const { data: userResp, error: authErr } = await admin.auth.admin.getUserById(userId)
    if (authErr) {
      console.error("[email] auth.admin.getUserById error:", authErr)
      return null
    }
    const email = userResp?.user?.email || null
    if (!email) return null

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

export async function sendWhatsAppEventEmail(input: Input): Promise<void> {
  const recipient = await resolveRecipient(input.userId)
  if (!recipient) return

  const base = getAppUrl()
  const actionUrl = `${base}/profile`

  const { subject, html } = whatsappEventEmail({
    firstName: recipient.firstName,
    eventType: input.eventType,
    whatsappPhone: input.whatsappPhone,
    createdAt: new Date(),
    actionUrl,
    unsubscribeUrl: buildUnsubscribeUrl(input.userId, "transactional"),
  })

  await sendEmail({
    to: recipient.email,
    userId: input.userId,
    subject,
    html,
    category: "transactional",
    tag: `whatsapp_${input.eventType.toLowerCase()}`,
  })
}
