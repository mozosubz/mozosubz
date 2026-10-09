"use server"

import { getGsubz, runGsubz } from "@/lib/api/gsubz-sdk"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { finalizeGsubzPurchase } from "@/lib/utils/gsubz-purchase"
import { applyServiceMarkup } from "@/lib/pricing/markup"
import { applyApiMarkup, resolveApiServiceSettings, API_SERVICE_KEYS } from "@/lib/pricing/api-pricing"

/**
 * GSUBZ does not publish an SMS price through the plans endpoint, so the
 * customer rate is configured here. Override with SMS_UNIT_PRICE (naira per
 * 160-character page) without a code change.
 */
const SMS_UNIT_PRICE = Number(process.env.SMS_UNIT_PRICE ?? 4)
const SMS_PAGE_CHARS = 160
const MAX_RECIPIENTS = 5000
const MAX_MESSAGE_CHARS = 905

const SENDER_PATTERN = /^[A-Za-z]{3,11}$/

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean)
}

/**
 * The customer-facing rate for one 160-character page, with the admin markup
 * already applied. The page reads this so the amount it displays is the amount
 * the wallet is actually charged.
 */
export async function getBulkSmsRate(): Promise<{
  unitPrice: number
  pageChars: number
  maxRecipients: number
  maxMessageChars: number
}> {
  const unitPrice = await applyServiceMarkup("bulk-sms", "Bulk SMS", SMS_UNIT_PRICE)
  return {
    unitPrice,
    pageChars: SMS_PAGE_CHARS,
    maxRecipients: MAX_RECIPIENTS,
    maxMessageChars: MAX_MESSAGE_CHARS,
  }
}

/**
 * @param trustedUserId  Optional. When provided (e.g. from a Connect Key
 *   authenticated v1 endpoint), the user is treated as authenticated as that
 *   id and the cookie/session lookup is skipped.
 */
export async function sendBulkSms(formData: FormData, trustedUserId?: string, apiPricing = false) {
  const from = String(formData.get("from") || "").trim()
  const toRaw = String(formData.get("to") || "")
  const msg = String(formData.get("msg") || "").trim()
  const requestID = `SMS${Date.now()}${Math.floor(Math.random() * 1000)}`

  if (!SENDER_PATTERN.test(from)) {
    return { success: false, message: "Sender name must be 3–11 letters, with no spaces or numbers" }
  }
  if (!msg) return { success: false, message: "Enter a message to send" }
  if (msg.length > MAX_MESSAGE_CHARS) {
    return { success: false, message: `Message is too long (max ${MAX_MESSAGE_CHARS} characters)` }
  }

  const recipients = parseRecipients(toRaw)
  if (recipients.length === 0) return { success: false, message: "Add at least one recipient number" }
  if (recipients.length > MAX_RECIPIENTS) {
    return { success: false, message: `Too many recipients (max ${MAX_RECIPIENTS})` }
  }

  const pages = Math.max(1, Math.ceil(msg.length / SMS_PAGE_CHARS))
  const units = recipients.length * pages

  try {
    let userId = trustedUserId
    if (!userId) {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return { success: false, message: "You must be logged in to make a purchase" }
      userId = user.id
    }

    const admin = createAdminClient()
    const { data: profile } = await admin.from("profiles").select("wallet_balance").eq("id", userId).single()
    if (!profile) return { success: false, message: "Profile not found. Please contact support." }

    // Bulk SMS has no plan catalogue — it is billed per 160-character page per
    // recipient, so the markup is applied to the UNIT rate and then multiplied
    // out. Marking up the total instead would scale the markup with volume.
    // API (Connect Key) callers use the enable flag and markup from the admin
    // API pricing page; the dashboard markup does not apply to them.
    let unitPrice: number
    if (apiPricing) {
      const settings = await resolveApiServiceSettings(API_SERVICE_KEYS.bulkSms)
      if (!settings.enabled) {
        return { success: false, message: "Bulk SMS is not available for API users.", errorCode: "SERVICE_DISABLED" }
      }
      unitPrice = applyApiMarkup(SMS_UNIT_PRICE, settings.markup)
    } else {
      unitPrice = await applyServiceMarkup("bulk-sms", "Bulk SMS", SMS_UNIT_PRICE)
    }
    const price = Math.round(unitPrice * units * 100) / 100
    const balanceBefore = Number(profile.wallet_balance)
    if (balanceBefore < price) {
      return { success: false, message: "Insufficient wallet balance" }
    }

    const gsubz = getGsubz()
    const outcome = await runGsubz(() => gsubz.sendSms({ from, to: recipients, msg, requestID }))

    return finalizeGsubzPurchase(
      {
        userId,
        category: "BULK_SMS",
        serviceId: "bulk-sms",
        serviceName: "Bulk SMS",
        amount: price,
        phone: `${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`,
        description: `Bulk SMS · ${recipients.length} recipient${recipients.length === 1 ? "" : "s"} · ${pages} page${pages === 1 ? "" : "s"}`,
        planDetails: `${recipients.length} × ${pages} page${pages === 1 ? "" : "s"}`,
        serviceType: "Bulk SMS",
        balanceBefore,
        requestID,
        meta: { recipients: recipients.length, pages, sender: from },
      },
      outcome,
    )
  } catch (error) {
    console.error("[v0] Bulk SMS error:", error)
    return { success: false, message: "An error occurred while processing your request" }
  }
}
