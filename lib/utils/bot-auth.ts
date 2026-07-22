/**
 * Bot authentication utilities for WhatsApp and Telegram integrations.
 * Generates OTPs, sends verification emails, and manages bot connections.
 */

import { sendEmail } from '@/lib/email/client'
import { botOtpEmail } from '@/lib/email/templates/bot-otp'

/**
 * Generate a random 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Send OTP verification email for bot authentication
 */
export async function sendBotOtpEmail(
  to: string,
  firstName: string,
  platform: 'whatsapp' | 'telegram',
  identifier: string,
  otp: string
): Promise<void> {
  const { subject, html } = botOtpEmail({
    firstName,
    platform,
    identifier,
    otp,
  })

  await sendEmail({
    to,
    subject,
    html,
    category: 'transactional',
    tag: `bot_otp_${platform}`,
  })
}

/**
 * Format platform name for display
 */
export function getPlatformDisplayName(platform: 'whatsapp' | 'telegram'): string {
  return platform === 'whatsapp' ? 'WhatsApp' : 'Telegram'
}

/**
 * Validate phone number format (basic check)
 * Accepts: 10348011234567, +2348011234567, +1234567890, etc
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Remove spaces, dashes, and parentheses but keep the +
  const cleaned = phone.replace(/[\s\-()]+/g, '')
  // Check if it's a valid phone number with optional + prefix and 10-15 digits
  return /^\+?[1-9]\d{9,14}$/.test(cleaned)
}

/**
 * Validate Telegram user ID format
 */
export function isValidTelegramUserId(id: string | number): boolean {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id
  // Telegram user IDs are positive integers
  return Number.isFinite(numId) && numId > 0 && numId < Number.MAX_SAFE_INTEGER
}
