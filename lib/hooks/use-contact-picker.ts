"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Contact Picker API wrapper.
 *
 * The API is unusually constrained, and each constraint was a real failure mode
 * in the previous inline implementation:
 *   - Chromium on Android only (no iOS Safari, no desktop).
 *   - Secure context required.
 *   - Must run in a *top-level* browsing context — it throws inside an iframe,
 *     which is why this never works in an embedded preview but does work on the
 *     deployed site.
 *   - Must be triggered by a user gesture.
 *
 * Types are declared here because TypeScript's DOM lib does not ship them; the
 * old code called navigator.contacts directly and failed the type check.
 */

interface ContactInfo {
  name?: string[]
  tel?: string[]
  email?: string[]
}

interface ContactsManager {
  select: (
    properties: Array<"name" | "tel" | "email" | "address" | "icon">,
    options?: { multiple?: boolean },
  ) => Promise<ContactInfo[]>
  getProperties: () => Promise<string[]>
}

declare global {
  interface Navigator {
    contacts?: ContactsManager
  }
}

export type ContactPickResult =
  | { status: "picked"; phone: string; name?: string }
  | { status: "cancelled" }
  | { status: "unsupported"; message: string }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string }

/**
 * Normalises a phone number from the address book into the 11-digit local
 * Nigerian format (0XXXXXXXXXX).
 *
 * Contacts are stored inconsistently — "+234 803 123 4567", "2348031234567",
 * "0803-123-4567", or "8031234567" with the leading zero omitted. The previous
 * implementation only accepted results that were already exactly 11 digits
 * starting with "0", so the very common 10-digit and "+234"-with-zero forms were
 * silently dropped: the picker opened, you chose a contact, and nothing
 * happened. That was the reported bug.
 */
export function normalizeNigerianPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "")
  if (!digits) return null

  // International access prefix, e.g. 00234...
  if (digits.startsWith("00")) digits = digits.slice(2)
  // Country code.
  if (digits.startsWith("234")) digits = digits.slice(3)
  // Trunk zero, which may appear on its own or after the country code
  // (some address books store "+2340803...").
  if (digits.startsWith("0")) digits = digits.slice(1)

  // What remains should be the 10-digit subscriber number. Every Nigerian
  // mobile line starts with 7, 8 or 9 at this point (0701/0803/0905/...), which
  // filters out landlines and malformed entries.
  if (digits.length === 10 && /^[789]/.test(digits)) {
    return `0${digits}`
  }

  return null
}

export function useContactPicker() {
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    // Per spec both halves must be present; checking only navigator.contacts
    // gives false positives on browsers that ship a partial implementation.
    setSupported(
      typeof navigator !== "undefined" &&
        "contacts" in navigator &&
        "ContactsManager" in window,
    )
  }, [])

  const pickContact = useCallback(async (): Promise<ContactPickResult> => {
    if (!supported) {
      return {
        status: "unsupported",
        message: "Contact picker isn't available on this browser. Please type the number instead.",
      }
    }

    try {
      const contacts = await navigator.contacts!.select(["tel", "name"], { multiple: false })

      // An empty array is how the API reports "user closed the sheet".
      if (!contacts || contacts.length === 0) {
        return { status: "cancelled" }
      }

      const contact = contacts[0]
      const name = contact.name?.[0]
      const numbers = contact.tel ?? []

      if (numbers.length === 0) {
        return {
          status: "invalid",
          message: name
            ? `${name} has no phone number saved.`
            : "That contact has no phone number saved.",
        }
      }

      // Try every stored number, not just the first. A contact whose landline
      // is listed above their mobile used to fail outright.
      for (const candidate of numbers) {
        const phone = normalizeNigerianPhone(candidate)
        if (phone) return { status: "picked", phone, name }
      }

      return {
        status: "invalid",
        message: `"${numbers[0]}" isn't a valid Nigerian mobile number. Please type it manually.`,
      }
    } catch (error) {
      // The user dismissing the sheet surfaces as an AbortError — not a fault.
      if (error instanceof DOMException && error.name === "AbortError") {
        return { status: "cancelled" }
      }

      console.log("[v0] Contact picker failed:", error)

      // Thrown when embedded in an iframe, which is the usual cause here.
      if (error instanceof DOMException && error.name === "InvalidStateError") {
        return {
          status: "unsupported",
          message: "Contact picker can't run inside an embedded preview. Open the site directly.",
        }
      }

      return {
        status: "error",
        message: "Couldn't open your contacts. Please type the number instead.",
      }
    }
  }, [supported])

  return { pickContact, supported }
}
