/**
 * SESSION MANAGEMENT
 *
 * IMPORTANT (bug fix 2026-10-13): this used to force a sign-out whenever a
 * SIGNED_IN event arrived with an access token different from the current
 * one. Supabase fires SIGNED_IN on token refresh/recovery paths too (tab
 * regaining visibility, another tab refreshing first), so that check
 * periodically logged the SAME device out mid-session — reported as "logged
 * out a few minutes after signing in".
 *
 * Single-device enforcement already happens server-side and safely:
 * signInAction revokes the account's other refresh tokens, so a second device
 * loses access when its token next refreshes. No client-side forced sign-out
 * is needed, and this manager now only reacts to a real SIGNED_OUT.
 */

import { createClient } from "@/lib/supabase/client"

let authSubscription: (() => void) | null = null

export function setupSessionManager() {
  if (authSubscription) {
    return authSubscription
  }

  const supabase = createClient()

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event) => {
      // When SIGNED_OUT fires (logout on another tab, or the refresh token
      // was revoked), send this tab to the login page.
      if (event === "SIGNED_OUT") {
        if (typeof window !== "undefined") {
          window.location.href = "/login"
        }
      }
    }
  )

  // Store unsubscribe function for cleanup
  authSubscription = () => subscription?.unsubscribe()

  return authSubscription
}

/**
 * Cleanup session manager (call on app unmount if needed)
 */
export function cleanupSessionManager() {
  if (authSubscription) {
    authSubscription()
    authSubscription = null
  }
}

/**
 * Check if current session is still valid
 */
export async function isSessionValid(): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return !!session
  } catch (error) {
    console.error("[v0] Error checking session:", error)
    return false
  }
}
