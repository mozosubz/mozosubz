"use server"

import { buyAirtime } from "@/lib/api/gsubz"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { saveTransaction, atomicDeductWallet } from "@/lib/utils/save-transaction"
import { isValidAmount, isValidPhone } from "@/lib/utils/input-validation"
import { resolveProviderError } from "@/lib/utils/provider-error"
import { scheduleVerifyPending } from "@/lib/utils/schedule-verify"
import { applyServiceMarkup } from "@/lib/pricing/markup"
import { revalidatePath } from "next/cache"

/**
 * Purchase airtime.
 *
 * @param formData  Standard form payload (network, phone, amount).
 * @param trustedUserId  Optional. When provided (e.g. from a Connect Key
 *   authenticated v1 endpoint), the user is treated as authenticated as that
 *   id and the cookie/session lookup is skipped. ONLY pass this from a route
 *   that has already authenticated the caller via a trusted credential.
 */
export async function purchaseAirtime(formData: FormData, trustedUserId?: string) {
  const network = formData.get("network") as string
  const phone = formData.get("phone") as string
  const amount = formData.get("amount") as string

  const startTime = Date.now()
  // Hoisted so the catch block references the exact ID sent to the provider.
  const requestID = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`

  try {
    // SECURITY: Validate inputs
    const numAmount = parseFloat(amount)
    if (!isValidAmount(numAmount) || numAmount < 50 || numAmount > 50000) {
      return { success: false, message: "Airtime amount must be between ₦50 and ₦50,000" }
    }

    const ALLOWED_NETWORKS = ["mtn", "airtel", "glo", "9mobile", "etisalat"]
    if (!network || !ALLOWED_NETWORKS.includes(network.toLowerCase())) {
      return { success: false, message: "Invalid network selected" }
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
    // and trusted v1 callers without a Supabase session cookie. The userId is
    // already verified at this point (either via auth.getUser or Connect Key).
    const admin = createAdminClient()
    const { data: profile } = await admin.from("profiles").select("wallet_balance").eq("id", userId).single()

    if (!profile) {
      return { success: false, message: "Profile not found. Please contact support." }
    }

    const userAmount = Number(amount)
    const chargeAmount = await applyServiceMarkup("airtime", "Airtime", userAmount)
    const balanceBefore = Number(profile.wallet_balance)

    // Check sufficient balance
    if (balanceBefore < chargeAmount) {
      return { success: false, message: "Insufficient wallet balance" }
    }

    // Map network to GSUBZ service ID
    const serviceIdMap: Record<string, string> = {
      mtn: "mtn",
      airtel: "airtel",
      glo: "glo",
      "9mobile": "etisalat",
    }

    const serviceID = serviceIdMap[network.toLowerCase()] || "mtn"

    // Call GSUBZ API
    const gsubzStartTime = Date.now()
    const response = await buyAirtime({
      serviceID,
      phone,
      amount: String(userAmount),
      requestID,
    })
    const gsubzTime = Date.now() - gsubzStartTime

    // Determine success
    const isSuccess =
      (response.code === 200 || response.code === "200" || response.code === "000") &&
      (response.status === "TRANSACTION_SUCCESSFUL" ||
        response.status === "success" ||
        response.status === "successful" ||
        response.description === "TRANSACTION_SUCCESSFUL")

    if (isSuccess) {
      const transactionId = String(response.transactionID || requestID)

      // ATOMIC: Deduct wallet balance in a single database transaction
      const deductStartTime = Date.now()
      const deductResult = await atomicDeductWallet(userId, chargeAmount)
      const deductTime = Date.now() - deductStartTime

      if (!deductResult.success) {
        console.error("[v0] Atomic deduction failed - contact support")
        return {
          success: false,
          message: deductResult.error || "Failed to update wallet balance. Please contact support.",
        }
      }

      const balanceAfter = deductResult.newBalance!

      // Save transaction
      const saveStartTime = Date.now()
      await saveTransaction({
        userId,
        transactionId,
        category: "AIRTIME",
        serviceId: `${network.toLowerCase()}-airtime`,
        serviceName: `${network} Airtime`,
        amount: chargeAmount,
        phone,
        status: "SUCCESS",
        description: `${network} Airtime · ${phone}`,
        balanceBefore,
        balanceAfter,
        apiResponse: response,
      })
      const saveTime = Date.now() - saveStartTime

      // Email is sent automatically by saveTransaction()

      // Revalidate dashboard to update balance and transactions
      revalidatePath("/dashboard")

      return {
        success: true,
        message: "Airtime purchase successful",
        transaction: {
          id: transactionId,
          type: "airtime",
          network,
          phone,
          amount: userAmount,
          status: "success",
          balance: balanceAfter,
        },
      }
    }

    // Transaction failed - still save it as FAILED
    const failedTransactionId = String(response.transactionID || requestID)

    await saveTransaction({
      userId,
      transactionId: failedTransactionId,
      category: "AIRTIME",
      serviceId: `${network.toLowerCase()}-airtime`,
      serviceName: `${network} Airtime`,
      amount: chargeAmount,
      phone,
      status: "FAILED",
      description: `${network} Airtime · ${phone}`,
      balanceBefore,
      balanceAfter: balanceBefore,
      apiResponse: response,
    })

    // Email is sent automatically by saveTransaction()

    const resolved = resolveProviderError(response)
    console.log(`[v0] Airtime purchase failed | ${resolved.code} | provider: ${resolved.providerMessage}`)

    return {
      success: false,
      message: resolved.message,
      errorCode: resolved.code,
      transaction: {
        id: failedTransactionId,
        type: "airtime",
        network,
        phone,
        amount: userAmount,
        status: "failed",
        balance: balanceBefore,
      },
    }
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError"

    if (isTimeout) {
      console.log(`[v0] Airtime purchase timed out — saving PENDING | requestID=${requestID}`)

      const numAmount = parseFloat(amount)
      const pendingChargeAmount = await applyServiceMarkup("airtime", "Airtime", numAmount)
      const networkNameMap: Record<string, string> = { mtn: "MTN", glo: "Glo", airtel: "Airtel", etisalat: "9mobile" }
      const networkName = networkNameMap[network?.toLowerCase()] || network || "Airtime"

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

        await saveTransaction({
          userId: pendingUserId,
          transactionId: requestID,
          category: "AIRTIME",
          serviceId: network,
          serviceName: `${networkName} Airtime`,
          serviceType: "Airtime",
          amount: pendingChargeAmount,
          phone,
          status: "PENDING",
          description: `${networkName} Airtime · ${phone}`,
          balanceBefore: bal,
          balanceAfter: bal,
        })

        scheduleVerifyPending({
          requestID,
          userId: pendingUserId,
          amount: pendingChargeAmount,
          balanceBefore: bal,
          category: "AIRTIME",
        })
      }

      return {
        success: false,
        pending: true,
        message:
          "Your request is taking longer than expected. We are verifying it in the background — your wallet will only be charged if it succeeds. Check your transaction history in a moment.",
      }
    }

    console.error("[v0] Airtime purchase error:", error)
    return { success: false, message: "An error occurred while processing your request", error: String(error) }
  }
}
