"use server"

import { buyCableSubscription, getCablePlans } from "@/lib/api/gsubz"
import { isGsubzSuccess, resolveCableServiceId } from "@/lib/api/gsubz-services"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { saveTransaction, atomicDeductWallet } from "@/lib/utils/save-transaction"
import { isValidAmount } from "@/lib/utils/input-validation"
import { resolveProviderError } from "@/lib/utils/provider-error"
import { scheduleVerifyPending } from "@/lib/utils/schedule-verify"
import { revalidatePath } from "next/cache"

const MIN_CABLE_AMOUNT = 1100

/**
 * Subscribe to a cable plan.
 *
 * @param formData  Standard form payload (provider, package, packageDisplayName, smartcard, phone).
 * @param trustedUserId  Optional. When provided (e.g. from a Connect Key
 *   authenticated v1 endpoint), the user is treated as authenticated as that
 *   id and the cookie/session lookup is skipped. ONLY pass this from a route
 *   that has already authenticated the caller via a trusted credential.
 */
export async function subscribeCable(formData: FormData, trustedUserId?: string) {
  const provider = formData.get("provider") as string
  const package_name = formData.get("package") as string
  const packageDisplayName = formData.get("packageDisplayName") as string
  const smartcard = formData.get("smartcard") as string
  const phone = formData.get("phone") as string

  // Hoisted so the catch block references the exact ID sent to the provider.
  const requestID = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`
  let pendingChargeAmount = 0

  try {
    const supabase = await createClient()

    let userId = trustedUserId
    if (!userId) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return { success: false, message: "You must be logged in to make a purchase" }
      }
      userId = user.id
    }

    // Use admin client for the profile read so this works for both UI users
    // and trusted v1 callers without a Supabase session cookie.
    const admin = createAdminClient()
    const { data: profile } = await admin.from("profiles").select("wallet_balance, email").eq("id", userId).single()

    if (!profile) {
      return { success: false, message: "Profile not found. Please contact support." }
    }

    const serviceID = resolveCableServiceId(provider)
    if (!serviceID) {
      return { success: false, message: "Unsupported cable provider" }
    }

    const [providerPlans, pricingRules] = await Promise.all([
      getCablePlans(serviceID),
      getCablePricingRulesForService(serviceID),
    ])
    const providerPlan = providerPlans.plans.find((plan) => plan.value === package_name)
    if (!providerPlan) {
      return { success: false, message: "Selected cable package is unavailable" }
    }

    const providerAmount = Number(providerPlan.price)
    const rule = pricingRules.find((item) => item.plan_name.toLowerCase() === providerPlan.displayName.toLowerCase())
    const markup = rule
      ? rule.markup_type === "fixed"
        ? Number(rule.markup_value)
        : (providerAmount * Number(rule.markup_value)) / 100
      : 0
    const purchaseAmount = providerAmount + markup
    pendingChargeAmount = purchaseAmount
    const balanceBefore = Number(profile.wallet_balance)

    if (!Number.isFinite(providerAmount) || providerAmount <= 0) {
      return { success: false, message: "Invalid cable package price" }
    }
    if (providerAmount < MIN_CABLE_AMOUNT) {
      return { success: false, message: "Cable subscription amount must be at least ₦1,100" }
    }
    if (balanceBefore < purchaseAmount) {
      return { success: false, message: "Insufficient wallet balance" }
    }

    const response = await buyCableSubscription({
      serviceID,
      plan: package_name,
      amount: String(providerAmount),
      phone,
      email: profile.email || "customer@subsum.com",
      customerID: smartcard,
      requestID,
    })

    const isSuccess = isGsubzSuccess(response)

    if (isSuccess) {
      const transactionId = String(response.transactionID || requestID)

      // ATOMIC: Deduct wallet balance in a single database transaction
      const deductResult = await atomicDeductWallet(userId, purchaseAmount)

      if (!deductResult.success) {
        console.error("[v0] Deduction failed - contact support")
        return {
          success: false,
          message: deductResult.error || "Failed to update wallet balance. Please contact support.",
        }
      }

      const balanceAfter = deductResult.newBalance!

      // Save transaction (smartcard stored in phone field)
      await saveTransaction({
        userId,
        transactionId,
        category: "CABLE",
        serviceId: serviceID,
        serviceName: `${provider} TV`,
        amount: purchaseAmount,
        phone: smartcard,
        status: "SUCCESS",
        description: packageDisplayName ? `${provider} ${packageDisplayName}` : `${provider} ${package_name} · ${smartcard}`,
        balanceBefore,
        balanceAfter,
        apiResponse: response,
        planDetails: packageDisplayName,
      })

      // Email is sent automatically by saveTransaction()

      // Revalidate dashboard to update balance and transactions
      revalidatePath("/dashboard")

      return {
        success: true,
        message: "Cable subscription successful",
        transaction: {
          id: transactionId,
          type: "cable",
          provider,
          package: package_name,
          smartcard,
          amount: purchaseAmount,
          status: "success",
          balance: balanceAfter,
        },
      }
    }

    // Transaction failed
    const failedTransactionId = String(response.transactionID || requestID)

    await saveTransaction({
      userId,
      transactionId: failedTransactionId,
      category: "CABLE",
      serviceId: serviceID,
      serviceName: `${provider} TV`,
      amount: purchaseAmount,
      phone: smartcard,
      status: "FAILED",
      description: packageDisplayName ? `${provider} ${packageDisplayName}` : `${provider} ${package_name} · ${smartcard}`,
      balanceBefore,
      balanceAfter: balanceBefore,
      apiResponse: response,
      planDetails: packageDisplayName,
    })

    // Email is sent automatically by saveTransaction()

    const resolved = resolveProviderError(response)
    console.log(`[v0] Cable subscription failed | ${resolved.code} | provider: ${resolved.providerMessage}`)

    return {
      success: false,
      message: resolved.message,
      errorCode: resolved.code,
      transaction: {
        id: failedTransactionId,
        type: "cable",
        provider,
        package: package_name,
        smartcard,
        amount: purchaseAmount,
        status: "failed",
        balance: balanceBefore,
      },
    }
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError"

    if (isTimeout) {
      console.log(`[v0] Cable purchase timed out — saving PENDING | requestID=${requestID}`)

      let pendingUserId: string | undefined = trustedUserId
      if (!pendingUserId) {
        try {
          const sup = await createClient()
          const { data: { user } } = await sup.auth.getUser()
          pendingUserId = user?.id
        } catch {}
      }

      if (pendingUserId) {
        const adminClient = createAdminClient()
        const { data: profile } = await adminClient.from("profiles").select("wallet_balance").eq("id", pendingUserId).single()
        const bal = Number(profile?.wallet_balance ?? 0)
        const pendingAmount = pendingChargeAmount

        await saveTransaction({
          userId: pendingUserId,
          transactionId: requestID,
          category: "CABLE",
          serviceId: provider,
          serviceName: `${provider?.toUpperCase()} Cable`,
          serviceType: "Cable",
          amount: pendingAmount,
          phone: smartcard,
          status: "PENDING",
          description: packageDisplayName
            ? `${provider?.toUpperCase()} · ${packageDisplayName}`
            : `${provider?.toUpperCase()} Cable · ${smartcard}`,
          balanceBefore: bal,
          balanceAfter: bal,
          planDetails: packageDisplayName,
        })

        scheduleVerifyPending({
          requestID,
          userId: pendingUserId,
          amount: pendingAmount,
          balanceBefore: bal,
          category: "CABLE",
        })
      }

      return {
        success: false,
        pending: true,
        message:
          "Your request is taking longer than expected. We are verifying it in the background — your wallet will only be charged if it succeeds. Check your transaction history in a moment.",
      }
    }

    console.error("[v0] Request processing error")
    return { success: false, message: "An error occurred while processing your request" }
  }
}

/**
 * Cached pricing-rules lookup for a single cable service. Same pattern as
 * data plans — invalidated by the "pricing-rules" tag when an admin edits
 * any rule (see lib/actions/pricing.ts).
 */
async function getCablePricingRulesForService(service: string) {
  const { unstable_cache } = await import("next/cache")
  const getCached = unstable_cache(
    async () => {
      const { createClient } = await import("@supabase/supabase-js")
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data } = await supabase
        .from("pricing_rules")
        .select("plan_name, base_price, markup_type, markup_value")
        .eq("service_id", service)
        .eq("is_active", true)
      return data || []
    },
    [`pricing-rules-${service}`],
    { revalidate: 1800, tags: ["pricing-rules", `pricing-rules-${service}`] }
  )
  return getCached()
}

export async function fetchCablePlans(provider: string) {
  try {
    const serviceIdMap: Record<string, string> = {
      dstv: "dstv",
      gotv: "gotv",
      startimes: "startimes",
    }

    const service = serviceIdMap[provider.toLowerCase()] || "dstv"

    // Fetch gsubz plans and cached pricing rules in parallel.
    const [plans, pricingRules] = await Promise.all([
      getCablePlans(service),
      getCablePricingRulesForService(service),
    ])

    // Apply markup to plans if pricing rules exist
    const enhancedPlans = (plans.plans || []).map((plan: any) => {
      const rule = pricingRules?.find((r) => r.plan_name.toLowerCase() === plan.displayName.toLowerCase())

      if (rule) {
        const basePrice = parseFloat(plan.price)
        const markup = rule.markup_type === "fixed" ? rule.markup_value : (basePrice * rule.markup_value) / 100
        const finalPrice = basePrice + markup

        return {
          ...plan,
          price: finalPrice.toString(),
          originalPrice: plan.price,
          hasMarkup: true,
          markup: markup,
        }
      }

      return plan
    })

    console.log(`[v0] Enhanced cable plans with markup:`, enhancedPlans)

    return {
      success: true,
      plans: enhancedPlans,
      service: plans.service,
    }
  } catch (error) {
    console.error("[v0] Error fetching cable plans:", error)
    return { success: false, plans: [], error: String(error) }
  }
}

export async function verifySmartcard(provider: string, smartcard: string) {
  await new Promise((resolve) => setTimeout(resolve, 500))

  return {
    success: true,
    customerName: "Customer",
    currentPackage: "Active",
  }
}
