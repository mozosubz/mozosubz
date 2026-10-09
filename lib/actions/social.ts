"use server"

import { getGsubz, getSocialServices, runGsubz, type SocialService } from "@/lib/api/gsubz-sdk"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { finalizeGsubzPurchase } from "@/lib/utils/gsubz-purchase"
import { applyServiceMarkup } from "@/lib/pricing/markup"
import { resolveApiPlanPrice } from "@/lib/pricing/api-pricing"

/**
 * Social catalogue priced for the customer. Pass `raw` to get the provider's
 * base prices (used by the admin pricing page).
 */
export async function listSocialServices(raw = false): Promise<SocialService[]> {
  try {
    const services = await getSocialServices()
    if (raw) return services
    return Promise.all(
      services.map(async (s) => ({
        ...s,
        price: String(await applyServiceMarkup("social", s.display_name, Number(s.price))),
      })),
    )
  } catch (error) {
    console.error("[v0] listSocialServices error:", error)
    return []
  }
}

/**
 * @param trustedUserId  Optional. When provided (e.g. from a Connect Key
 *   authenticated v1 endpoint), the user is treated as authenticated as that
 *   id and the cookie/session lookup is skipped.
 */
export async function purchaseSocial(formData: FormData, trustedUserId?: string, apiPricing = false) {
  const serviceValue = String(formData.get("service") || "").trim()
  const link = String(formData.get("link") || "").trim()
  const quantity = Number.parseInt(String(formData.get("quantity") || "0"), 10)
  const requestID = `SOC${Date.now()}${Math.floor(Math.random() * 1000)}`

  if (!serviceValue) return { success: false, message: "Please select a service" }
  if (!/^https?:\/\//i.test(link)) {
    return { success: false, message: "Enter a valid link starting with http:// or https://" }
  }

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

    // Re-resolve the service from the live catalogue so min/max and price are
    // always the provider's current values.
    let service: SocialService | undefined
    try {
      const services = await getSocialServices()
      service = services.find((s) => String(s.value) === serviceValue)
    } catch {
      return { success: false, message: "Could not load the current price. Please try again." }
    }
    if (!service) return { success: false, message: "That service is no longer available." }

    if (!Number.isInteger(quantity) || quantity < service.min || quantity > service.max) {
      return { success: false, message: `Quantity must be between ${service.min} and ${service.max}` }
    }

    const unitPrice = Number(service.price)
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return { success: false, message: "This service is temporarily unavailable." }
    }
    // API (Connect Key) callers pay the per-unit price set on the admin API
    // pricing page, not the dashboard markup.
    let unit: number
    if (apiPricing) {
      const apiUnit = await resolveApiPlanPrice("social", service.display_name)
      if (apiUnit === null) {
        return { success: false, message: "This service is not available for API users.", errorCode: "PLAN_NOT_ENABLED" }
      }
      unit = apiUnit
    } else {
      unit = await applyServiceMarkup("social", service.display_name, unitPrice)
    }
    const price = Math.round(unit * quantity * 100) / 100

    const admin = createAdminClient()
    const { data: profile } = await admin.from("profiles").select("wallet_balance").eq("id", userId).single()
    if (!profile) return { success: false, message: "Profile not found. Please contact support." }

    const balanceBefore = Number(profile.wallet_balance)
    if (balanceBefore < price) return { success: false, message: "Insufficient wallet balance" }

    const gsubz = getGsubz()
    const outcome = await runGsubz(() =>
      gsubz.buySocial({ plan: String(service.value), link, quantity, requestID }),
    )

    return finalizeGsubzPurchase(
      {
        userId,
        category: "SOCIAL",
        serviceId: String(service.value),
        serviceName: service.display_name,
        amount: price,
        phone: "",
        description: `${service.display_name} · ${quantity}`,
        planDetails: `${quantity} × ${service.display_name}`,
        serviceType: "Social Media",
        balanceBefore,
        requestID,
        meta: { link, quantity, service: service.display_name },
      },
      outcome,
    )
  } catch (error) {
    console.error("[v0] Social order error:", error)
    return { success: false, message: "An error occurred while processing your request" }
  }
}
