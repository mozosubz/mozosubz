"use server"

import { buyElectricityToken } from "@/lib/api/gsubz"
import { isGsubzSuccess, resolveElectricityServiceId } from "@/lib/api/gsubz-services"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { saveTransaction, atomicDeductWallet } from "@/lib/utils/save-transaction"
import { resolveProviderError } from "@/lib/utils/provider-error"
import { scheduleVerifyPending } from "@/lib/utils/schedule-verify"
import { applyServiceMarkup } from "@/lib/pricing/markup"
import { revalidatePath } from "next/cache"

/**
 * Pay for electricity.
 *
 * @param formData  Standard form payload (disco, meterType, meterNumber, amount, phone).
 * @param trustedUserId  Optional. When provided (e.g. from a Connect Key
 *   authenticated v1 endpoint), the user is treated as authenticated as that
 *   id and the cookie/session lookup is skipped. ONLY pass this from a route
 *   that has already authenticated the caller via a trusted credential.
 */
export async function payElectricity(formData: FormData, trustedUserId?: string) {
  const disco = formData.get("disco") as string
  const meterType = formData.get("meterType") as string
  const meterNumber = formData.get("meterNumber") as string
  const amount = formData.get("amount") as string
  const phone = formData.get("phone") as string

  // Hoisted so the catch block references the exact ID sent to the provider.
  const requestID = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`

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

    const serviceID = resolveElectricityServiceId(disco)
    if (!serviceID) {
      return { success: false, message: "Unsupported electricity provider" }
    }
    const purchaseAmount = Number(amount)
    if (!Number.isFinite(purchaseAmount) || purchaseAmount < 1100 || purchaseAmount > 500000) {
      return { success: false, message: 'Electricity amount must be between ₦1,100 and ₦500,000' }
    }
    const providerMeterType = meterType?.toLowerCase() as "prepaid" | "postpaid"
    if (!["prepaid", "postpaid"].includes(providerMeterType)) {
      return { success: false, message: "Invalid meter type" }
    }
    if (!meterNumber || meterNumber.trim().length < 6) {
      return { success: false, message: "Invalid meter number" }
    }
    const chargeAmount = await applyServiceMarkup("electricity", "Electricity", purchaseAmount)
    const balanceBefore = Number(profile.wallet_balance)

    // Check sufficient balance
    if (balanceBefore < chargeAmount) {
      return { success: false, message: "Insufficient wallet balance" }
    }

    // Call GSUBZ API
    const response = await buyElectricityToken({
      serviceID,
      phone,
      customerID: meterNumber,
      amount,
      variationCode: providerMeterType,
    })

    const isSuccess = isGsubzSuccess(response)

    if (isSuccess) {
      const transactionId = String(response.transactionID || requestID)

      // ATOMIC: Deduct wallet balance in a single database transaction
      const deductResult = await atomicDeductWallet(userId, chargeAmount)

      if (!deductResult.success) {
        console.error("[v0] Deduction failed - contact support")
        return {
          success: false,
          message: deductResult.error || "Failed to update wallet balance. Please contact support.",
        }
      }

      const balanceAfter = deductResult.newBalance!

      // Save transaction (meter number stored in phone field)
      await saveTransaction({
        userId,
        transactionId,
        category: "ELECTRICITY",
        serviceId: serviceID,
        serviceName: "Electricity",
        amount: chargeAmount,
        phone: meterNumber,
        status: "SUCCESS",
        description: `${disco} Electricity · ${meterNumber}`,
        balanceBefore,
        balanceAfter,
        apiResponse: response,
      })

      // Email is sent automatically by saveTransaction()

      // Revalidate dashboard to update balance and transactions
      revalidatePath("/dashboard")

      return {
        success: true,
        message: "Electricity payment successful",
        transaction: {
          id: transactionId,
          type: "electricity",
          disco,
          meterType,
          meterNumber,
          amount: purchaseAmount,
          token: response.token || null,
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
      category: "ELECTRICITY",
      serviceId: serviceID,
      serviceName: "Electricity",
      amount: chargeAmount,
      phone: meterNumber,
      status: "FAILED",
      description: `${disco} Electricity · ${meterNumber}`,
      balanceBefore,
      balanceAfter: balanceBefore,
      apiResponse: response,
    })

    // Email is sent automatically by saveTransaction()

    const resolved = resolveProviderError(response)
    console.log(`[v0] Electricity payment failed | ${resolved.code} | provider: ${resolved.providerMessage}`)

    return {
      success: false,
      message: resolved.message,
      errorCode: resolved.code,
      transaction: {
        id: failedTransactionId,
        type: "electricity",
        disco,
        meterType,
        meterNumber,
        amount: purchaseAmount,
        status: "failed",
        balance: balanceBefore,
      },
    }
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError"

    if (isTimeout) {
      console.log(`[v0] Electricity payment timed out — saving PENDING | requestID=${requestID}`)

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
        const numAmount = parseFloat(amount)
        const pendingChargeAmount = await applyServiceMarkup("electricity", "Electricity", numAmount)
      const pendingServiceId = resolveElectricityServiceId(disco)
      if (!pendingServiceId) {
        return { success: false, message: "Unsupported electricity provider" }
      }

      await saveTransaction({
          userId: pendingUserId,
          transactionId: requestID,
          category: "ELECTRICITY",
          serviceId: pendingServiceId,
          serviceName: "Electricity",
          amount: pendingChargeAmount,
          phone: meterNumber,
          status: "PENDING",
          description: `${disco} Electricity · ${meterNumber}`,
          balanceBefore: bal,
          balanceAfter: bal,
        })

        scheduleVerifyPending({
          requestID,
          userId: pendingUserId,
          amount: pendingChargeAmount,
          balanceBefore: bal,
          category: "ELECTRICITY",
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

export async function verifyMeter(disco: string, meterNumber: string, meterType: string) {
  await new Promise((resolve) => setTimeout(resolve, 500))

  return {
    success: true,
    customerName: "Customer",
    address: "Address",
  }
}
