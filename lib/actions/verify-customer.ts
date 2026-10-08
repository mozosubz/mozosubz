"use server"

import { GsubzError } from "gsubz-sdk"
import { getGsubz } from "@/lib/api/gsubz-sdk"

export interface VerifiedCustomer {
  customerName: string
  address?: string | null
  meterNumber?: string
  meterType?: string
  accountType?: string | null
  canVend?: string
  status?: string
  dueDate?: string
  customerNumber?: string
  customerType?: string
}

export type VerifyCustomerResult =
  | { success: true; customer: VerifiedCustomer }
  | { success: false; message: string }

/**
 * Verify a meter number (electricity) or smartcard/IUC (cable) before charging.
 *
 * `type` is required for electricity and omitted for cable, per the provider
 * contract. A "not found" response is a normal outcome, not an error, so it is
 * returned as a friendly failure rather than thrown.
 */
export async function verifyCustomer(input: {
  serviceID: string
  billersCode: string
  type?: "prepaid" | "postpaid"
}): Promise<VerifyCustomerResult> {
  const billersCode = input.billersCode?.trim()
  if (!input.serviceID || !billersCode) {
    return { success: false, message: "Enter the meter or smartcard number to verify" }
  }

  try {
    const res = await getGsubz().verifyCustomer({
      serviceID: input.serviceID,
      billersCode,
      type: input.type,
    })

    if (!res?.content) {
      return { success: false, message: "We could not find that customer. Please check the number." }
    }

    return { success: true, customer: res.content as VerifiedCustomer }
  } catch (error) {
    if (error instanceof GsubzError) {
      if (error.code === 404) {
        return { success: false, message: "We could not find that customer. Please check the number." }
      }
      return {
        success: false,
        message: error.apiResponse || "Verification is temporarily unavailable. Please try again.",
      }
    }
    console.error("[v0] verifyCustomer error:", error)
    return { success: false, message: "Verification is temporarily unavailable. Please try again." }
  }
}
