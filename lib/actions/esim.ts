"use server"

import type { EsimCountry, EsimOrder, EsimPackage } from "gsubz-sdk"
import { getGsubz, runGsubz } from "@/lib/api/gsubz-sdk"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { finalizeGsubzPurchase } from "@/lib/utils/gsubz-purchase"
import { applyServiceMarkup } from "@/lib/pricing/markup"

/** Public catalogue — no API key required, so it is safe to call freely. */
export async function listEsimCountries(query?: string): Promise<EsimCountry[]> {
  try {
    const { countries } = await getGsubz().esimCountries(query)
    return countries ?? []
  } catch (error) {
    console.error("[v0] listEsimCountries error:", error)
    return []
  }
}

/**
 * Packages for a country, priced for the customer. Pass `raw` to get the
 * provider's base prices (used by the admin pricing page).
 */
export async function listEsimPackages(locationCode: string, raw = false): Promise<EsimPackage[]> {
  if (!locationCode) return []
  try {
    const { packages } = await getGsubz().esimPackages(locationCode)
    const list = packages ?? []
    if (raw) return list
    return Promise.all(
      list.map(async (p) => ({
        ...p,
        price: await applyServiceMarkup("esim", p.name, Number(p.price)),
      })),
    )
  } catch (error) {
    console.error("[v0] listEsimPackages error:", error)
    return []
  }
}

/**
 * Buy an eSIM. Activation is often asynchronous, so this returns as soon as the
 * order is placed and the client polls `getEsimOrder` for the QR code rather
 * than holding the request open.
 *
 * @param trustedUserId  Optional. When provided (e.g. from a Connect Key
 *   authenticated v1 endpoint), the user is treated as authenticated as that
 *   id and the cookie/session lookup is skipped.
 */
export async function purchaseEsim(formData: FormData, trustedUserId?: string) {
  const packageCode = String(formData.get("packageCode") || "").trim()
  const locationCode = String(formData.get("locationCode") || "").trim()
  const requestID = `ESIM${Date.now()}${Math.floor(Math.random() * 1000)}`

  if (!packageCode || !locationCode) {
    return { success: false, message: "Please select an eSIM package" }
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

    const gsubz = getGsubz()

    // Re-resolve the package from the live catalogue so the charged price is
    // always the provider's current price, never a stale client value.
    let pkg: EsimPackage | undefined
    try {
      const { packages } = await gsubz.esimPackages(locationCode)
      pkg = packages?.find((p) => p.packageCode === packageCode)
    } catch {
      return { success: false, message: "Could not load the current price. Please try again." }
    }
    if (!pkg) return { success: false, message: "That eSIM package is no longer available." }

    const basePrice = Number(pkg.price)
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      return { success: false, message: "This eSIM package is temporarily unavailable." }
    }
    const price = await applyServiceMarkup("esim", pkg.name, basePrice)

    const admin = createAdminClient()
    const { data: profile } = await admin.from("profiles").select("wallet_balance").eq("id", userId).single()
    if (!profile) return { success: false, message: "Profile not found. Please contact support." }

    const balanceBefore = Number(profile.wallet_balance)
    if (balanceBefore < price) return { success: false, message: "Insufficient wallet balance" }

    const outcome = await runGsubz(() => gsubz.buyEsim({ packageCode, requestID }))

    return finalizeGsubzPurchase(
      {
        userId,
        category: "ESIM",
        serviceId: packageCode,
        serviceName: pkg.name,
        amount: price,
        phone: "",
        description: `${pkg.name} · ${pkg.country}`,
        planDetails: pkg.name,
        serviceType: "eSIM",
        balanceBefore,
        requestID,
        meta: { packageCode, country: pkg.country, requestID },
      },
      outcome,
    )
  } catch (error) {
    console.error("[v0] eSIM purchase error:", error)
    return { success: false, message: "An error occurred while processing your request" }
  }
}

/** Poll target for an eSIM order while it provisions. */
export async function getEsimOrder(requestID: string): Promise<EsimOrder | null> {
  if (!requestID) return null
  try {
    const { orders } = await getGsubz().esimOrders({ requestID })
    return orders?.[0] ?? null
  } catch (error) {
    console.error("[v0] getEsimOrder error:", error)
    return null
  }
}
