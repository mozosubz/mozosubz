"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Contact Picker — two-tier strategy for Android:
 *
 * Tier 1 — Contact Picker API (navigator.contacts.select)
 *   Chrome 80+ on Android. Returns structured data directly in the browser.
 *   Constraints: HTTPS only, top-level browsing context (no iframes).
 *
 * Tier 2 — Android Intent URI fallback
 *   Works in every Android browser (Samsung Internet, Firefox, Opera, stock
 *   WebView, older Chrome). Opens the native Contacts app via an intent URI:
 *     intent://contacts#Intent;action=android.intent.action.PICK;...;end
 *   After the user picks a contact the OS returns a content:// URI via the
 *   Activity result. Because this is a pure web page (not a WebView that
 *   intercepts intents), the OS has nowhere to deliver the result — so the
 *   fallback can open the native app but cannot receive the phone number back.
 *   In that case we inform the user and keep the input focused so they can
 *   type the number they just looked up. This is the standard web pattern.
 *
 * TypeScript's DOM lib does not ship ContactsManager types, so they are
 * declared inline.
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

/** True when running on any Android device, regardless of browser. */
function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false
  return /android/i.test(navigator.userAgent)
}

/**
 * Opens the native Android Contacts app via an intent URI.
 *
 * Because a web page cannot receive the Activity result (unlike a native app
 * or a WebView with a custom scheme handler), this only lets the user *look
 * up* the number — they still need to type it. We return `android-intent-opened`
 * so the caller can show an appropriate message.
 *
 * The intent URI format is documented at:
 * https://developer.chrome.com/docs/multidevice/android/intents/
 */
function openAndroidContactsIntent(): boolean {
  try {
    // action=PICK + type filters to phone numbers only so the user sees a
    // number-selection sheet rather than the full contact card.
    const intentUri =
      "intent://contacts#Intent;" +
      "action=android.intent.action.PICK;" +
      "type=vnd.android.cursor.dir/phone_v2;" +
      "end"
    window.location.href = intentUri
    return true
  } catch {
    return false
  }
}

export type ContactPickResult =
  | { status: "picked"; phone: string; name?: string }
  | { status: "cancelled" }
  | { status: "android-intent-opened"; message: string }
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
  const [android, setAndroid] = useState(false)

  useEffect(() => {
    // The spec only requires `navigator.contacts` to exist; `ContactsManager`
    // is a desktop-Chrome-only global that doesn't exist on Android Chrome —
    // the only real-world device where this API is available. Checking for
    // both meant the button was always hidden on Android.
    const hasApi = typeof navigator !== "undefined" && "contacts" in navigator
    setSupported(hasApi)
    setAndroid(isAndroid())
  }, [])

  const pickContact = useCallback(async (): Promise<ContactPickResult> => {
    // --- Tier 1: Contact Picker API (Chrome 80+ on Android) ---
    if (supported) {
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

        // Thrown when embedded in an iframe, which is the usual cause here.
        // Fall through to the Android intent fallback if we're on Android.
        if (error instanceof DOMException && error.name === "InvalidStateError" && android) {
          // intentional fall-through to Tier 2 below
        } else if (error instanceof DOMException && error.name === "InvalidStateError") {
          return {
            status: "unsupported",
            message: "Contact picker can't run inside an embedded preview. Open the site directly.",
          }
        } else {
          return {
            status: "error",
            message: "Couldn't open your contacts. Please type the number instead.",
          }
        }
      }
    }

    // --- Tier 2: Android intent URI (any Android browser) ---
    // Works on Samsung Internet, Firefox for Android, Opera, WebView, and
    // older Chrome that predates the Contact Picker API. The OS opens the
    // native Contacts app; because we are a web page (not a native/WebView app)
    // there is no channel for the result to come back, so we tell the user to
    // type the number they just looked up.
    if (android) {
      const opened = openAndroidContactsIntent()
      if (opened) {
        return {
          status: "android-intent-opened",
          message: "Your Contacts app should open. Note the number, then type it here.",
        }
      }
    }

    // --- No path available ---
    return {
      status: "unsupported",
      message: "Contact picker is not available on this browser. Please type the number instead.",
    }
  }, [supported, android])

  // `canPick` is true on any Android device — either the API or the intent
  // will work. Used by callers to decide whether to show the button at all.
  const canPick = supported || android

  return { pickContact, supported, android, canPick }
}
