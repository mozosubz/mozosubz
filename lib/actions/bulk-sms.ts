"use server"

import { getGsubz, runGsubz } from "@/lib/api/gsubz-sdk"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { finalizeGsubzPurchase } from "@/lib/utils/gsubz-purchase"
import { resolveUnitRate } from "@/lib/pricing/markup"
import { applyApiMarkup, resolveApiServiceSettings, API_SERVICE_KEYS } from "@/lib/pricing/api-pricing"
import { atomicRefundWallet } from "@/lib/utils/save-transaction"
import { countSmsPages } from "@/lib/utils/sms"

/**
 * GSUBZ bills bulk SMS per page per recipient (₦5/page at the time of writing
 * — see "Send Bulk SMS" in the API doc) and does not publish an SMS price
 * through the plans endpoint. This constant is only the fallback rate: once an
 * admin saves a "Bulk SMS" rule on the pricing page, that rule's base price
 * becomes the rate. Override the fallback with SMS_UNIT_PRICE.
 */
const SMS_UNIT_PRICE = Number(process.env.SMS_UNIT_PRICE ?? 5)
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

function toCount(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/**
 * The customer-facing rate for one page, with the admin markup already applied.
 * The page reads this so the amount it displays is the amount the wallet is
 * actually charged.
 */
export async function getBulkSmsRate(): Promise<{
  unitPrice: number
  pageChars: number
  maxRecipients: number
  maxMessageChars: number
}> {
  const unitPrice = await resolveUnitRate("bulk-sms", "Bulk SMS", SMS_UNIT_PRICE)
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

  const pages = countSmsPages(msg)
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

    // Bulk SMS has no plan catalogue — it is billed per page per recipient, so
    // the markup is applied to the UNIT rate and then multiplied out. Marking
    // up the total instead would scale the markup with volume. API (Connect
    // Key) callers use the enable flag and markup from the admin API pricing
    // page, which is deliberately separate from the dashboard rate.
    let unitPrice: number
    if (apiPricing) {
      const settings = await resolveApiServiceSettings(API_SERVICE_KEYS.bulkSms)
      if (!settings.enabled) {
        return { success: false, message: "Bulk SMS is not available for API users.", errorCode: "SERVICE_DISABLED" }
      }
      unitPrice = applyApiMarkup(SMS_UNIT_PRICE, settings.markup)
    } else {
      unitPrice = await resolveUnitRate("bulk-sms", "Bulk SMS", SMS_UNIT_PRICE)
    }
    const price = Math.round(unitPrice * units * 100) / 100
    const balanceBefore = Number(profile.wallet_balance)
    if (balanceBefore < price) {
      return { success: false, message: "Insufficient wallet balance" }
    }

    const gsubz = getGsubz()
    const outcome = await runGsubz(() => gsubz.sendSms({ from, to: recipients, msg, requestID }))

    // GSUBZ refunds every number it could not deliver. Pass that on: the
    // customer only pays for messages that actually went out.
    const sent = toCount(outcome.raw.sent)
    const failedCount = toCount(outcome.raw.failed)
    const skippedCount = toCount(outcome.raw.skipped)
    const refund =
      outcome.success && failedCount > 0 ? Math.round(failedCount * pages * unitPrice * 100) / 100 : 0

    const result = await finalizeGsubzPurchase(
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
        meta: {
          recipients: recipients.length,
          recipientNumbers: recipients,
          message: msg,
          pages,
          sender: from,
          sent,
          failed: failedCount,
          skipped: skippedCount,
          refund,
        },
      },
      outcome,
    )

    // GSUBZ quirk (observed 2026-10-09): /api/sms/ answers 406
    // INVALID_ARGUMENTS_DUPLICATE_REQUEST_ID even when the requestID is brand
    // new — their own /api/verify/ has no record of the ID — while still
    // delivering the messages and charging nothing. A bare "failed" confuses
    // customers who receive the SMS, so say exactly what happened instead.
    if (
      !result.success &&
      !result.pending &&
      Number(outcome.code) === 406 &&
      String(outcome.description).includes("DUPLICATE_REQUEST_ID")
    ) {
      console.warn("[v0] GSUBZ SMS duplicate-rejection on a fresh requestID:", {
        requestID,
        recipients: recipients.length,
        providerBody: outcome.raw,
      })
      return {
        ...result,
        message:
          "The provider flagged this send as a duplicate, but the message may still have been delivered and you were not charged. If your recipients received it, you are all set — otherwise please try again in a few minutes.",
      }
    }

    if (result.success && refund > 0) {
      const refunded = await atomicRefundWallet(userId, refund)
      if (!refunded.success) {
        console.error("[v0] Bulk SMS partial-failure refund failed:", {
          requestID,
          userId,
          refund,
          error: refunded.error,
        })
      }
    }

    return result
  } catch (error) {
    console.error("[v0] Bulk SMS error:", error)
    return { success: false, message: "An error occurred while processing your request" }
  }
}
