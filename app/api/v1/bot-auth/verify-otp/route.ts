import { NextRequest, NextResponse } from 'next/server'
import { verifyConnectKey } from '@/lib/middleware/verify-connect-key'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBotOtpEmail } from '@/lib/utils/bot-auth'
import { logRequest } from '@/lib/api-logger'
import crypto from 'crypto'

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
  console.log(`[Bot Auth Verify OTP] → POST | From: ${requestLog.ip}`)

  try {
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
      console.log(`[Bot Auth Verify OTP] User not found: ${email} | Error: ${profileError?.message}`)
      return NextResponse.json(
        { success: false, error: 'User not found', details: profileError?.message },
        { status: 404 }
      )
    }

    const userId = profile.id

    // 2. Verify OTP from database
    console.log(`[Bot Auth Verify OTP] Checking OTP | userId: ${userId} | otp_code: ${otp_code} | platform: ${platform}`)
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
    
    console.log(`[Bot Auth Verify OTP] OTP record found:`, otpRecords ? 'YES' : 'NO')

    if (!otpRecords) {
      console.log(`[Bot Auth Verify OTP] Invalid or expired OTP for user: ${userId}`)
      return NextResponse.json(
        { success: false, error: 'Invalid or expired OTP' },
        { status: 401 }
      )
    }

    // Check expiry
    const expiresAt = new Date(otpRecords.expires_at)
    if (expiresAt < new Date()) {
      console.log(`[Bot Auth Verify OTP] OTP expired for user: ${userId}`)
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

    // 5. Always generate and return a new API key on successful OTP verification
    // This ensures OTP verification gives users immediate access without needing to store keys
    console.log(`[Bot Auth Verify OTP] Generating new connect_key for user ${userId}`)
    
    // Generate a real API key: format connect_<48 hex chars>_<timestamp>
    const randomBytes = crypto.randomBytes(24).toString('hex')
    const timestamp = Date.now().toString(16)
    const plainTextKey = `connect_${randomBytes}_${timestamp}`
    const keyHash = crypto.createHash('sha256').update(plainTextKey).digest('hex')
    const keyPreview = `connect_${randomBytes.slice(0, 8)}`
    
    const { data: newKey, error: createError } = await supabase
      .from('connect_keys')
      .insert({
        user_id: userId,
        name: `Bot Key - ${new Date().toISOString()}`,
        key_hash: keyHash,
        key_preview: keyPreview,
        permissions: ['data', 'airtime', 'bot'],
        is_active: true,
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

    const connectKeys = newKey
    console.log(`[Bot Auth Verify OTP] ✓ New connect_key created: ${keyPreview}`)

    // 6. Profile already fetched at the start, use it for response
    const duration = Date.now() - startTime
    console.log(`[Bot Auth Verify OTP] ✓ OTP verified and bot connection created for user: ${userId} | ${duration}ms`)

    return NextResponse.json(
      {
        success: true,
        api_key: plainTextKey, // Always return the full plaintext key - OTP proves ownership
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
        message: 'Store your API key securely. It will not be shown again.',
      },
      { status: 200 }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Bot Auth Verify OTP] Error: ${error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
