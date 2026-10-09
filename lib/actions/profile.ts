'use server'

import { createServerClient } from '@/lib/supabase/server'
import { RESERVED_USERNAMES, USERNAME_RX } from '@/lib/utils/profile-validation'

export async function updateUserProfile(userId: string, username: string) {
  const supabase = await createServerClient()

  try {
    const cleanUsername = username.toLowerCase().trim()


    // Update the profile
    const { error, data } = await supabase
      .from('profiles')
      .update({ username: cleanUsername })
      .eq('id', userId)
      .select()

    if (error) {
      console.error('[PROFILE] Supabase error updating username:', error.code, error.message)
      return false
    }

    return true
  } catch (error) {
    console.error('[PROFILE] Exception in updateUserProfile:', error)
    return false
  }
}

/**
 * Loads the current session user's profile for the complete-profile form.
 * The user is resolved server-side — the client never passes an id.
 */
export async function getMyProfile() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false as const, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username, phone_number')
    .eq('id', user.id)
    .maybeSingle()

  return { success: true as const, profile: profile ?? null }
}

/**
 * Creates/updates the current session user's profile with server-side
 * validation. The id and email always come from the session — a caller
 * cannot write to another user's row or set an arbitrary email.
 */
export async function updateMyProfile(input: {
  fullName: string
  username: string
  phone: string
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return { success: false as const, error: 'Not authenticated' }
  }

  const fullName = String(input.fullName || '').trim()
  const username = String(input.username || '').toLowerCase().trim()
  const phoneDigits = String(input.phone || '').replace(/\D/g, '')

  if (!fullName || fullName.length > 80) {
    return { success: false as const, error: 'Full name is required' }
  }
  if (username.length < 3 || username.length > 30 || !USERNAME_RX.test(username)) {
    return { success: false as const, error: 'Username must be 3-30 characters: lowercase letters, numbers, hyphens' }
  }
  if (RESERVED_USERNAMES.has(username)) {
    return { success: false as const, error: 'That username is reserved' }
  }
  if (phoneDigits.length !== 11) {
    return { success: false as const, error: 'Phone number must be exactly 11 digits' }
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email,
      full_name: fullName,
      username,
      phone_number: phoneDigits,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id'
    })

  if (error) {
    console.error('[PROFILE] Supabase error updating profile:', error.code, error.message)
    return { success: false as const, error: 'Failed to update profile' }
  }

  return { success: true as const }
}
