"use server"

import { buyCableSubscription, getCablePlans } from "@/lib/api/gsubz"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { saveTransaction, atomicDeductWallet } from "@/lib/utils/save-transaction"
import { sendTransactionEmail } from "@/lib/email/send-transaction-email"
import { isValidAmount } from "@/lib/utils/input-validation"
import {
  deriveRequestID,
  findExistingTransaction,
  reconcileWithProvider,
} from "@/lib/utils/idempotency"
import { revalidatePath } from "next/cache"

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
    const { data: profile } = await admin.from("profiles").select("wallet_balance").eq("id", userId).single()

    if (!profile) {
      return { success: false, message: "Profile not found. Please contact support." }
    }

    // Map provider to service ID
    const serviceIdMap: Record<string, string> = {
      dstv: "dstv",
      gotv: "gotv",
      startimes: "startimes",
    }

    const serviceID = serviceIdMap[provider.toLowerCase()] || "dstv"

    // Cable price comes back from gsubz, so we can't use amount in the
    // bucket key — but (user + smartcard + package) within 30s is a
    // strong-enough fingerprint of "the same purchase intent".
    const requestID = await deriveRequestID({
      userId,
      category: "CABLE",
      recipient: smartcard,
      amount: 0,
      plan: `${serviceID}:${package_name}`,
      clientRequestID: (formData.get("requestID") as string) || undefined,
    })

    const existingCable = await findExistingTransaction(userId, requestID)
    if (existingCable) {
      return {
        success: existingCable.status === "SUCCESS",
        message:
          existingCable.status === "SUCCESS"
            ? "Cable subscription successful"
            : existingCable.status === "FAILED"
              ? existingCable.description || "Transaction failed"
              : "Transaction already in progress",
        transaction: {
          id: existingCable.transaction_id,
          type: "cable",
          provider,
          package: package_name,
          smartcard,
          amount: Number(existingCable.amount),
          status: existingCable.status.toLowerCase(),
          balance: Number(existingCable.balance_after),
        },
      }
    }

    // Call GSUBZ API with reconcile-on-error.
    let response: any
    let cableNetworkError: unknown = null
    try {
      response = await buyCableSubscription({
        serviceID,
        plan: package_name,
        phone,
        customerID: smartcard,
        requestID,
      })
    } catch (err) {
      cableNetworkError = err
      console.error("[v0] Cable gsubz call failed, will reconcile:", err)
    }

    if (cableNetworkError || !response) {
      const reco = await reconcileWithProvider(requestID)
      if (reco.status === "success") {
        response = reco.raw || { code: 200, status: "TRANSACTION_SUCCESSFUL", transactionID: requestID, amount: 0 }
      } else if (reco.status === "failed") {
        response = reco.raw || { code: 0, status: "FAILED", description: "Transaction failed" }
      } else {
        return {
          success: false,
          pending: true,
          message:
            "We couldn't confirm your subscription yet. Please check your transaction history before retrying.",
          transaction: {
            id: requestID,
            type: "cable",
            provider,
            package: package_name,
            smartcard,
            amount: 0,
            status: "pending",
            balance: Number(profile.wallet_balance),
          },
        }
      }
    }

    const purchaseAmount = Number(response.amount || 0)
    const balanceBefore = Number(profile.wallet_balance)

    // Check sufficient balance
    if (balanceBefore < purchaseAmount) {
      return { success: false, message: "Insufficient wallet balance" }
    }

    // Determine success
    const isSuccess =
      (response.code === 200 || response.code === "200" || response.code === "000") &&
      (response.status === "TRANSACTION_SUCCESSFUL" ||
        response.status === "success" ||
        response.status === "successful" ||
        response.description === "TRANSACTION_SUCCESSFUL")

    if (isSuccess) {
      const transactionId = requestID
      const providerTxnId = String(response.transactionID || requestID)

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

      // Send transaction email (fire-and-forget - don't await)
      sendTransactionEmail({
        userId,
        category: "CABLE",
        serviceName: `${provider} TV`,
        amount: purchaseAmount,
        status: "SUCCESS",
        transactionId,
        paymentMethod: "Wallet",
        extras: [
          { label: "Package", value: package_name },
          { label: "Smartcard", value: smartcard },
        ],
      }).catch((err) => console.error("[v0] Email send failed:", err))

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
    const failedTransactionId = requestID
    const providerFailedId = String(response.transactionID || requestID)

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

    // Send failure email
    await sendTransactionEmail({
      userId,
      category: "CABLE",
      serviceName: `${provider} TV`,
      amount: purchaseAmount,
      status: "FAILED",
      transactionId: failedTransactionId,
      extras: [
        { label: "Provider", value: provider },
        { label: "Package", value: package_name },
        { label: "Smartcard", value: smartcard },
        { label: "Status", value: "Failed" },
        { label: "Reason", value: response.description || "Transaction could not be processed" },
      ],
    })

    return {
      success: false,
      message: response.description || "Transaction failed",
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
