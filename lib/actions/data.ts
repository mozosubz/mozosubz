"use server"

import { buyData, getDataPlans } from "@/lib/api/gsubz"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { saveTransaction, atomicDeductWallet, atomicRefundWallet } from "@/lib/utils/save-transaction"
import { sendTransactionEmail } from "@/lib/email/send-transaction-email"
import { isValidAmount, isValidPhone } from "@/lib/utils/input-validation"
import {
  deriveRequestID,
  findExistingTransaction,
  reconcileWithProvider,
} from "@/lib/utils/idempotency"
import { revalidatePath } from "next/cache"

/**
 * Purchase a data plan.
 *
 * @param formData  Standard form payload (serviceID, plan, phone, amount, planDisplayName).
 * @param trustedUserId  Optional. When provided (e.g. from a Connect Key
 *   authenticated v1 endpoint), the user is treated as authenticated as that
 *   id and the cookie/session lookup is skipped. ONLY pass this from a route
 *   that has already authenticated the caller via a trusted credential.
 */
export async function purchaseData(formData: FormData, trustedUserId?: string) {
  const serviceID = formData.get("serviceID") as string
  const plan = formData.get("plan") as string
  const phone = formData.get("phone") as string
  const clientAmount = formData.get("amount") as string
  const planDisplayName = formData.get("planDisplayName") as string

  try {
    // SECURITY: Validate all inputs before processing
    const amount = parseFloat(clientAmount)
    
    if (!isValidAmount(amount) || amount <= 0) {
      return { success: false, message: "Invalid amount" }
    }

    if (!isValidPhone(phone)) {
      return { success: false, message: "Invalid phone number" }
    }

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

    const balanceBefore = Number(profile.wallet_balance)

    // Check sufficient balance BEFORE calling Gsubz API
    if (balanceBefore < amount) {
      return { success: false, message: "Insufficient wallet balance" }
    }

    const requestID = await deriveRequestID({
      userId,
      category: "DATA",
      recipient: phone,
      amount,
      plan,
      clientRequestID: (formData.get("requestID") as string) || undefined,
    })

    // Replay protection — return existing outcome if this intent already
    // hit the database (double-click / retry).
    const existingTx = await findExistingTransaction(userId, requestID)
    if (existingTx) {
      return {
        success: existingTx.status === "SUCCESS",
        message:
          existingTx.status === "SUCCESS"
            ? "Data purchase successful"
            : existingTx.status === "FAILED"
              ? existingTx.description || "Transaction failed"
              : "Transaction already in progress",
        transaction: {
          id: existingTx.transaction_id,
          type: "data",
          serviceID,
          plan,
          phone,
          amount: Number(existingTx.amount),
          status: existingTx.status.toLowerCase(),
          balance: Number(existingTx.balance_after),
        },
      }
    }

    // Call GSUBZ API. Tolerate network failures via reconcile.
    let response: any
    let networkError: unknown = null
    try {
      response = await buyData({
        serviceID,
        plan,
        phone,
        requestID,
      })
    } catch (err) {
      networkError = err
      console.error("[v0] Data gsubz call failed, will reconcile:", err)
    }

    if (networkError || !response) {
      const reco = await reconcileWithProvider(requestID)
      if (reco.status === "success") {
        response = reco.raw || { code: 200, status: "TRANSACTION_SUCCESSFUL", transactionID: requestID, amount }
      } else if (reco.status === "failed") {
        response = reco.raw || { code: 0, status: "FAILED", description: "Transaction failed" }
      } else {
        return {
          success: false,
          pending: true,
          message:
            "We couldn't confirm your data purchase yet. Please check your transaction history before retrying.",
          transaction: {
            id: requestID,
            type: "data",
            serviceID,
            plan,
            phone,
            amount,
            status: "pending",
            balance: balanceBefore,
          },
        }
      }
    }

    // Use the client-provided amount (which includes markup) instead of API response amount
    const userAmount = clientAmount ? Number(clientAmount) : (response.amount ? Number(response.amount) : 0)

    // Map network name - extract network from serviceID (e.g., "glo_sme" -> "glo")
    const networkNameMap: Record<string, string> = {
      mtn: "MTN",
      glo: "Glo",
      airtel: "Airtel",
      etisalat: "9mobile",
    }
    const networkKey = serviceID.split('_')[0].toLowerCase() // Extract first part before underscore
    const networkName = networkNameMap[networkKey] || "Data"
    const serviceType = serviceID.split('_').slice(1).join('_') || "data" // Extract service type (e.g., "sme", "gifting")

    // Determine success
    const isSuccess =
      (response.code === 200 || response.code === "200" || response.code === "000") &&
      (response.status === "TRANSACTION_SUCCESSFUL" ||
        response.status === "success" ||
        response.status === "successful" ||
        response.description === "TRANSACTION_SUCCESSFUL")

    if (isSuccess) {
      // Key on our deterministic requestID for replay-safety.
      const transactionId = requestID
      const providerTxnId = String(response.transactionID || requestID)

      // ATOMIC: Deduct wallet balance in a single database transaction
      // This prevents race conditions when multiple requests hit simultaneously
      const deductResult = await atomicDeductWallet(userId, userAmount)

      if (!deductResult.success) {
        console.error("[v0] Deduction failed - contact support")
        return {
          success: false,
          message: deductResult.error || "Failed to update wallet balance. Please contact support.",
        }
      }

      const balanceAfter = deductResult.newBalance!

      // Save transaction
      await saveTransaction({
        userId,
        transactionId,
        category: "DATA",
        serviceId: serviceID,
        serviceName: `${networkName} Data`,
        serviceType: "Data",
        serviceVariant: `${networkName.toUpperCase()} ${serviceType.toUpperCase().replace('_', ' ')}`,
        amount: userAmount,
        phone,
        status: "SUCCESS",
        description: planDisplayName ? `${networkName} Data · ${planDisplayName}` : `${networkName} Data · ${phone}`,
        balanceBefore,
        balanceAfter,
        apiResponse: response,
        planDetails: planDisplayName,
      })

      // Send transaction email (fire-and-forget - don't await)
      sendTransactionEmail({
        userId,
        category: "DATA",
        serviceName: `${networkName} Data`,
        amount: userAmount,
        status: "SUCCESS",
        transactionId,
        paymentMethod: "Wallet",
        extras: [
          { label: "Phone", value: phone },
          { label: "Plan", value: planDisplayName || plan },
        ],
      }).catch((err) => console.error("[v0] Email send failed:", err))

      // Revalidate dashboard to update balance and transactions
      revalidatePath("/dashboard")

      return {
        success: true,
        message: "Data purchase successful",
        transaction: {
          id: transactionId,
          type: "data",
          serviceID,
          plan,
          phone,
          amount: userAmount,
          status: "success",
          balance: balanceAfter,
        },
      }
    }

    // Transaction failed - still save it, keyed on requestID for replay safety.
    const failedTransactionId = requestID
    const providerFailedId = String(response.transactionID || requestID)

    await saveTransaction({
      userId,
      transactionId: failedTransactionId,
      category: "DATA",
      serviceId: serviceID,
      serviceName: `${networkName} Data`,
      serviceType: "Data",
      serviceVariant: `${networkName.toUpperCase()} ${serviceType.toUpperCase().replace('_', ' ')}`,
      amount: userAmount,
      phone,
      status: "FAILED",
      description: planDisplayName ? `${networkName} Data · ${planDisplayName}` : `${networkName} Data · ${phone}`,
      balanceBefore,
      balanceAfter: balanceBefore,
      apiResponse: response,
      planDetails: planDisplayName,
    })

    // Send failure email
    await sendTransactionEmail({
      userId,
      category: "DATA",
      serviceName: `${networkName} Data`,
      amount: userAmount,
      status: "FAILED",
      transactionId: failedTransactionId,
      extras: [
        { label: "Phone", value: phone },
        { label: "Plan", value: plan },
        { label: "Status", value: "Failed" },
        { label: "Reason", value: response.description || "Transaction could not be processed" },
      ],
    })

    return {
      success: false,
      message: response.description || "Transaction failed",
      transaction: {
        id: failedTransactionId,
        type: "data",
        serviceID,
        plan,
        phone,
        amount: userAmount,
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
 * Cached pricing-rules lookup for a single service.
 *
 * Why: every plan-list request used to hit Supabase to fetch markup rules,
 * which dominated the response time (gsubz plans themselves are already
 * cached via unstable_cache). Pricing rules change rarely (admin-only), so
 * we cache them per service and invalidate via the "pricing-rules" tag in
 * lib/actions/pricing.ts on any create/update/delete.
 *
 * Note: imported lazily inside the function to keep the module tree-shake
 * friendly and to scope the cache key per serviceId.
 */
async function getPricingRulesForService(serviceId: string) {
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
        .eq("service_id", serviceId)
        .eq("is_active", true)
      return data || []
    },
    [`pricing-rules-${serviceId}`],
    { revalidate: 1800, tags: ["pricing-rules", `pricing-rules-${serviceId}`] }
  )
  return getCached()
}

export async function fetchDataPlans(serviceID: string) {
  try {
    const serviceMap: Record<string, string> = {
      mtn_sme: "mtn",
      mtn_datashare: "mtn",
      mtn_gifting: "mtn",
      mtn_awoof: "mtn",
      glo_data: "glo",
      glo_sme: "glo",
      airtel_sme: "airtel",
      airtel_gifting: "airtel",
      etisalat_data: "etisalat",
    }

    const serviceId = serviceMap[serviceID.toLowerCase()] || serviceID

    // Fetch gsubz plans and cached pricing rules in parallel.
    const [plans, pricingRules] = await Promise.all([
      getDataPlans(serviceID),
      getPricingRulesForService(serviceId),
    ])
    
    // Apply markup to plans if pricing rules exist
    const enhancedPlans = (plans.plans || []).map((plan: any) => {
      const rule = pricingRules?.find((r) => r.plan_name.toLowerCase() === plan.displayName.toLowerCase())
      
      if (rule) {
        const basePrice = parseFloat(plan.price)
        const markup = rule.markup_type === "fixed" ? rule.markup_value : (basePrice * rule.markup_value) / 100
        const finalPrice = basePrice + markup
        
        console.log(`[v0] Applying markup to ${plan.displayName}: ${basePrice} + ${markup} = ${finalPrice}`)
        
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
    
    console.log(`[v0] Enhanced plans with markup:`, enhancedPlans)
    
    return {
      success: true,
      plans: enhancedPlans,
      service: plans.service,
    }
  } catch (error) {
    console.error("[v0] Error fetching plans:", error)
    return { success: false, plans: [], error: String(error) }
  }
}
