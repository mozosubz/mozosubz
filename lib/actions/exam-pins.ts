"use server"

import { getGsubz, runGsubz } from "@/lib/api/gsubz-sdk"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { finalizeGsubzPurchase } from "@/lib/utils/gsubz-purchase"
import { isValidPhone } from "@/lib/utils/input-validation"
import { applyServiceMarkup } from "@/lib/pricing/markup"

const EXAM_BOARDS: Record<string, { serviceId: string; plan: string; label: string }> = {
  waec: { serviceId: "waec", plan: "WAEC", label: "WAEC Result Checker Pin" },
  neco: { serviceId: "neco", plan: "NECO", label: "NECO Result Checker Pin" },
  nabteb: { serviceId: "nabteb", plan: "NABTEB", label: "NABTEB Result Checker Pin" },
}

export interface ExamBoardOption {
  id: string
  label: string
  short: string
  price: number
}

/**
 * Live prices for the board picker, so the UI never shows a stale amount.
 * Pass `raw` to get the provider's base price (used by the admin pricing page).
 */
export async function getExamPinPrices(raw = false): Promise<ExamBoardOption[]> {
  const gsubz = getGsubz()
  return Promise.all(
    Object.entries(EXAM_BOARDS).map(async ([id, config]) => {
      try {
        const plans = await gsubz.getPlans(config.serviceId)
        const base = Number(plans.plans?.[0]?.price ?? 0)
        const price = raw || base <= 0 ? base : await applyServiceMarkup("exam-pins", config.label, base)
        return { id, label: config.label, short: id.toUpperCase(), price }
      } catch {
        return { id, label: config.label, short: id.toUpperCase(), price: 0 }
      }
    }),
  )
}

/**
 * Buy a WAEC / NECO / NABTEB result-checker pin.
 *
 * The pin text comes back in the provider's `api_response` and is returned to
 * the caller so the UI can show it immediately; it is also stored on the
 * transaction row for later retrieval.
 *
 * @param trustedUserId  Optional. When provided (e.g. from a Connect Key
 *   authenticated v1 endpoint), the user is treated as authenticated as that
 *   id and the cookie/session lookup is skipped.
 */
export async function purchaseExamPin(formData: FormData, trustedUserId?: string) {
  const board = String(formData.get("board") || "").toLowerCase()
  const phone = String(formData.get("phone") || "").trim()
  const requestID = `EXAM${Date.now()}${Math.floor(Math.random() * 1000)}`

  const config = EXAM_BOARDS[board]
  if (!config) return { success: false, message: "Please select a valid exam board" }
  if (!isValidPhone(phone)) return { success: false, message: "Enter a valid phone number" }

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

    const gsubz = getGsubz()

    // Price comes from the live catalogue so a provider price change can never
    // leave us charging a stale amount.
    let basePrice = 0
    try {
      const plans = await gsubz.getPlans(config.serviceId)
      basePrice = Number(plans.plans?.[0]?.price ?? 0)
    } catch {
      return { success: false, message: "Could not load the current price. Please try again." }
    }
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      return { success: false, message: "This exam pin is temporarily unavailable." }
    }
    const price = await applyServiceMarkup("exam-pins", config.label, basePrice)

    const admin = createAdminClient()
    const { data: profile } = await admin.from("profiles").select("wallet_balance").eq("id", userId).single()
    if (!profile) return { success: false, message: "Profile not found. Please contact support." }

    const balanceBefore = Number(profile.wallet_balance)
    if (balanceBefore < price) return { success: false, message: "Insufficient wallet balance" }

    const outcome = await runGsubz(() =>
      gsubz.buyExamPin({ serviceID: config.serviceId, plan: config.plan, phone, requestID }),
    )

    return finalizeGsubzPurchase(
      {
        userId,
        category: "EXAM_PINS",
        serviceId: config.serviceId,
        serviceName: config.label,
        amount: price,
        phone,
        description: `${config.label} · ${phone}`,
        planDetails: config.label,
        serviceType: "Exam Pin",
        balanceBefore,
        requestID,
        meta: { board, pin: outcome.success ? outcome.apiResponse : undefined },
      },
      outcome,
    )
  } catch (error) {
    console.error("[v0] Exam pin purchase error:", error)
    return { success: false, message: "An error occurred while processing your request" }
  }
}
