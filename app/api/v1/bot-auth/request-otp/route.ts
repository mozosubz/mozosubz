import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateOTP, sendBotOtpEmail, isValidPhoneNumber, isValidTelegramUserId } from '@/lib/utils/bot-auth'
import { logRequest } from '@/lib/api-logger'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/utils/rate-limit'

/**
 * POST /api/v1/bot-auth/request-otp
 *
 * Body: { email, platform, identifier }
 * Response: { success: boolean, message: string }
 *
 * Sends a 6-digit OTP via email for bot authentication
 * Rate limited: 5 requests per minute per IP
 * Version: 2.0 - Fixed getUserByEmail method
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = logRequest(request)

  try {
    // SECURITY: Enforce rate limit (5 requests per minute per IP)
    const ip = getRateLimitIdentifier(request)
    const { allowed } = await checkRateLimit(ip, {
      interval: 60000,
      maxRequests: 5,
      keyPrefix: 'rl:bot-auth:otp',
    })

    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many OTP requests. Please wait a minute before trying again.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const body = await request.json()
    const { email, platform, identifier } = body

    // Validate inputs
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email is required' },
        { status: 400 }
      )
    }

    if (!['whatsapp', 'telegram'].includes(platform)) {
      return NextResponse.json(
        { success: false, error: 'Platform must be whatsapp or telegram' },
        { status: 400 }
      )
    }

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Identifier (phone or telegram_user_id) is required' },
        { status: 400 }
      )
    }

    // Validate identifier based on platform
    if (platform === 'whatsapp' && !isValidPhoneNumber(identifier)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    if (platform === 'telegram' && !isValidTelegramUserId(identifier)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Telegram user ID format' },
        { status: 400 }
      )
    }

    // Check if user exists by querying profiles table (case-insensitive)
    const supabase = createAdminClient()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (profileError || !profile?.id) {
      // Don't leak that user doesn't exist - for security
      return NextResponse.json(
        { success: true, message: 'If the email exists, you will receive an OTP' },
        { status: 200 }
      )
    }

    const firstName = profile?.full_name?.split(' ')[0] || email.split('@')[0] || 'User'
    const userId = profile.id

    // Generate OTP
    const otp = generateOTP()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000) // 5 minutes

    // Store OTP in database
    const { error: otpError } = await supabase.from('bot_otp').insert({
      user_id: userId,
      otp_code: otp,
      platform,
      identifier,
      expires_at: expiresAt.toISOString(),
    })

    if (otpError) {
      console.error(`[Bot Auth Request OTP] Failed to store OTP:`, otpError)
      return NextResponse.json(
        { success: false, error: 'Failed to generate OTP' },
        { status: 500 }
      )
    }

    // Send OTP email
    await sendBotOtpEmail(email, firstName, platform, identifier, otp)

    const duration = Date.now() - startTime

    return NextResponse.json(
      { success: true, message: 'OTP sent to your email' },
      { status: 200 }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Bot Auth Request OTP] Error: ${error} | ${duration}ms`)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
