"use server"

import { buyElectricityToken } from "@/lib/api/gsubz"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { saveTransaction, atomicDeductWallet } from "@/lib/utils/save-transaction"
import { sendTransactionEmail } from "@/lib/email/send-transaction-email"
import {
  deriveRequestID,
  findExistingTransaction,
  reconcileWithProvider,
} from "@/lib/utils/idempotency"
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

    // Map DISCO to service ID
    const serviceIdMap: Record<string, string> = {
      "Ikeja Electric": "ikeja-electric",
      "Eko Electric": "eko-electric",
      "Abuja Electric": "abuja-electric",
      "Kano Electric": "kano-electric",
      "Port Harcourt Electric": "portharcourt-electric",
      "Jos Electric": "jos-electric",
      "Ibadan Electric": "ibadan-electric",
      "Kaduna Electric": "kaduna-electric",
      "Enugu Electric": "enugu-electric",
      "Benin Electric": "benin-electric",
      "Aba Electric": "aba-electric",
      "Yola Electric": "yola-electric",
    }

    const serviceID = serviceIdMap[disco] || "ikeja-electric"
    const requestID = await deriveRequestID({
      userId,
      category: "ELECTRICITY",
      recipient: meterNumber,
      amount: Number(amount),
      plan: `${serviceID}:${meterType}`,
      clientRequestID: (formData.get("requestID") as string) || undefined,
    })
    const purchaseAmount = Number(amount)
    const balanceBefore = Number(profile.wallet_balance)

    // Check sufficient balance
    if (balanceBefore < purchaseAmount) {
      return { success: false, message: "Insufficient wallet balance" }
    }

    // Replay protection.
    const existingElec = await findExistingTransaction(userId, requestID)
    if (existingElec) {
      return {
        success: existingElec.status === "SUCCESS",
        message:
          existingElec.status === "SUCCESS"
            ? "Electricity payment successful"
            : existingElec.status === "FAILED"
              ? existingElec.description || "Transaction failed"
              : "Transaction already in progress",
        transaction: {
          id: existingElec.transaction_id,
          type: "electricity",
          disco,
          meterType,
          meterNumber,
          amount: Number(existingElec.amount),
          status: existingElec.status.toLowerCase(),
          balance: Number(existingElec.balance_after),
        },
      }
    }

    // Call GSUBZ API with reconcile-on-error.
    let response: any
    let elecNetworkError: unknown = null
    try {
      response = await buyElectricityToken({
        serviceID,
        phone,
        customerID: meterNumber,
        amount,
        variation_code: meterType,
        requestID,
      })
    } catch (err) {
      elecNetworkError = err
      console.error("[v0] Electricity gsubz call failed, will reconcile:", err)
    }

    if (elecNetworkError || !response) {
      const reco = await reconcileWithProvider(requestID)
      if (reco.status === "success") {
        response = reco.raw || { code: 200, status: "TRANSACTION_SUCCESSFUL", transactionID: requestID }
      } else if (reco.status === "failed") {
        response = reco.raw || { code: 0, status: "FAILED", description: "Transaction failed" }
      } else {
        return {
          success: false,
          pending: true,
          message:
            "We couldn't confirm your electricity payment yet. Please check your transaction history before retrying.",
          transaction: {
            id: requestID,
            type: "electricity",
            disco,
            meterType,
            meterNumber,
            amount: purchaseAmount,
            status: "pending",
            balance: balanceBefore,
          },
        }
      }
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

      // Save transaction (meter number stored in phone field)
      await saveTransaction({
        userId,
        transactionId,
        category: "ELECTRICITY",
        serviceId: serviceID,
        serviceName: "Electricity",
        amount: purchaseAmount,
        phone: meterNumber,
        status: "SUCCESS",
        description: `${disco} Electricity · ${meterNumber}`,
        balanceBefore,
        balanceAfter,
        apiResponse: response,
      })

      // Send transaction email (fire-and-forget - don't await)
      sendTransactionEmail({
        userId,
        category: "ELECTRICITY",
        serviceName: `${disco} Electricity`,
        amount: purchaseAmount,
        status: "SUCCESS",
        transactionId,
        paymentMethod: "Wallet",
        extras: [
          { label: "Meter Type", value: meterType },
          { label: "Meter Number", value: meterNumber },
        ],
      }).catch((err) => console.error("[v0] Email send failed:", err))

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
    const failedTransactionId = requestID
    const providerFailedId = String(response.transactionID || requestID)

    await saveTransaction({
      userId,
      transactionId: failedTransactionId,
      category: "ELECTRICITY",
      serviceId: serviceID,
      serviceName: "Electricity",
      amount: purchaseAmount,
      phone: meterNumber,
      status: "FAILED",
      description: `${disco} Electricity · ${meterNumber}`,
      balanceBefore,
      balanceAfter: balanceBefore,
      apiResponse: response,
    })

    // Send failure email
    await sendTransactionEmail({
      userId,
      category: "ELECTRICITY",
      serviceName: "Electricity",
      amount: purchaseAmount,
      status: "FAILED",
      transactionId: failedTransactionId,
      extras: [
        { label: "Provider", value: disco },
        { label: "Meter Type", value: meterType },
        { label: "Meter Number", value: meterNumber },
        { label: "Status", value: "Failed" },
        { label: "Reason", value: response.description || "Transaction could not be processed" },
      ],
    })

    return {
      success: false,
      message: response.description || "Transaction failed",
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
