import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBotOtpEmail } from '@/lib/utils/bot-auth'
import { logRequest } from '@/lib/api-logger'
import { generateConnectKey, hashConnectKey, getKeyPreview } from '@/lib/utils/connect-key'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/utils/rate-limit'

/**
 * POST /api/v1/bot-auth/verify-otp
 *
 * Body: {
 *   email: string,
 *   otp_code: string,
 *   platform: 'whatsapp' | 'telegram',
 *   identifier: string
 * }
 *
 * Verifies OTP code, creates/links bot_connections record, and returns the user's API key.
 * The returned API key is their existing connect_key (same one used for data/airtime).
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)

  try {
    // SECURITY: Rate limit OTP verification attempts to prevent brute force (5 attempts/min per IP)
    const ip = getRateLimitIdentifier(request)
    const { allowed } = await checkRateLimit(ip, {
      interval: 60000,
      maxRequests: 5,
      keyPrefix: 'rl:bot-auth:verify',
    })

    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many verification attempts. Please wait a minute.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const body = await request.json()
    const { email, otp_code, platform, identifier } = body

    // Validate inputs
    if (!email || !otp_code || !platform || !identifier) {
      return NextResponse.json(
        { success: false, error: 'Email, OTP code, platform, and identifier are required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // 1. Get user by email from profiles table (case-insensitive)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone_number, wallet_balance')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (profileError || !profile?.id) {
      return NextResponse.json(
        { success: false, error: 'User not found', details: profileError?.message },
        { status: 404 }
      )
    }

    const userId = profile.id

    // 2. Verify OTP from database
    const { data: otpRecords, error: otpFetchError } = await supabase
      .from('bot_otp')
      .select('*')
      .eq('user_id', userId)
      .eq('otp_code', otp_code)
      .eq('platform', platform)
      .maybeSingle()

    if (otpFetchError) {
      console.error(`[Bot Auth Verify OTP] OTP fetch error:`, otpFetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to verify OTP', details: otpFetchError.message },
        { status: 500 }
      )
    }
    

    if (!otpRecords) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired OTP' },
        { status: 401 }
      )
    }

    // Check expiry
    const expiresAt = new Date(otpRecords.expires_at)
    if (expiresAt < new Date()) {
      // Clean up expired OTP
      await supabase.from('bot_otp').delete().eq('id', otpRecords.id)
      return NextResponse.json(
        { success: false, error: 'OTP has expired' },
        { status: 401 }
      )
    }

    // 3. Delete used OTP (single use)
    await supabase.from('bot_otp').delete().eq('id', otpRecords.id)

    // 4. Upsert bot_connections record
    const { error: connectionError } = await supabase.from('bot_connections').upsert(
      {
        user_id: userId,
        platform,
        identifier,
        connected_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,platform',
      }
    )

    if (connectionError) {
      console.error(`[Bot Auth Verify OTP] Failed to create bot connection:`, connectionError)
      return NextResponse.json(
        { success: false, error: 'Failed to link platform' },
        { status: 500 }
      )
    }

    // 5. Check if user has existing active key - if not, create one using standard utilities
    const { data: existingKeys, error: keyError } = await supabase
      .from('connect_keys')
      .select('id, key_preview, permissions, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)

    let connectKeys = existingKeys && existingKeys[0] ? existingKeys[0] : null
    let plainTextKey: string | null = null
    let isNewKey = false

    if (keyError && keyError.code !== 'PGRST116') {
      console.error(`[Bot Auth Verify OTP] Failed to fetch connect_key:`, keyError)
    }

    // If user already has a key, reuse it (don't generate new one)
    if (connectKeys) {
    } else {
      // Only create new key if user has none - use standard key generation utilities
      
      // Generate new key using standard utility
      plainTextKey = generateConnectKey()
      const keyHash = hashConnectKey(plainTextKey)
      const keyPreview = getKeyPreview(plainTextKey)
      
      const { data: newKey, error: createError } = await supabase
        .from('connect_keys')
        .insert({
          user_id: userId,
          name: `Bot Auth Key - ${new Date().toISOString()}`,
          key_hash: keyHash,
          key_preview: keyPreview,
          permissions: ['data', 'airtime', 'bot'],
          is_active: true,
          created_at: new Date().toISOString(),
        })
        .select('id, key_preview, permissions, is_active')
        .single()

      if (createError || !newKey) {
        console.error(`[Bot Auth Verify OTP] Failed to create connect_key:`, createError)
        return NextResponse.json(
          { success: false, error: 'Failed to create API key' },
          { status: 500 }
        )
      }

      connectKeys = newKey
      isNewKey = true
    }

    // 6. Profile already fetched at the start, use it for response
    const duration = Date.now() - startTime

    const responseData: any = {
      success: true,
      api_key_preview: connectKeys.key_preview,
      user: {
        id: userId,
        email: profile.email || email,
        name: profile.full_name || 'User',
        phone: profile.phone_number || null,
        wallet_balance: profile.wallet_balance || 0,
      },
      platform,
      identifier,
    }

    // Return full key only for newly created keys
    if (isNewKey && plainTextKey) {
      responseData.api_key = plainTextKey
      responseData.message = 'Your API key has been generated. Copy it now - it will not be shown again.'
    } else {
      // For existing keys, direct user to /integrations/keys to view
      responseData.api_key = null
      responseData.message = 'You already have an API key. View and copy it at https://mozosubz.xyz/integrations/keys'
    }

    return NextResponse.json(responseData, { status: 200 })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Bot Auth Verify OTP] Error: ${error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
