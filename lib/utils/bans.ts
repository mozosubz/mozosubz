import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Ban state helpers.
 *
 * Deliberately NOT in a "use server" module: these are called from server
 * components, route handlers and other server modules only, and must not be
 * exposed as directly callable endpoints.
 */

/**
 * True when the profile row exists and is banned.
 *
 * Fails OPEN on read errors: a transient DB failure must not lock every user
 * out of deposits. The ban is still enforced by sign-in and the dashboard
 * layout, which re-check on every page load.
 */
export async function isUserBanned(userId: string): Promise<boolean> {
  if (!userId) return false
  try {
    const { data, error } = await createAdminClient()
      .from('profiles')
      .select('is_banned')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('[BANS] Ban check failed:', error.message)
      return false
    }

    return data?.is_banned === true
  } catch (error) {
    console.error('[BANS] Ban check exception:', error instanceof Error ? error.message : error)
    return false
  }
}
