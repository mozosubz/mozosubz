import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isFallbackAdmin } from '@/lib/utils/hardcoded-admin'
import { sendEmail } from '@/lib/email/client'
import { checkRateLimit } from '@/lib/utils/rate-limit'

export const runtime = 'nodejs'

const MAX_MESSAGE_LENGTH = 2000

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildEmailHtml(input: {
  name: string
  email: string
  userId: string
  message: string
  userAgent: string
  page: string
}): string {
  const { name, email, userId, message, userAgent, page } = input
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 14px;color:#6b7280;font-size:12px;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:6px 14px;color:#111827;font-size:13px;">${escapeHtml(value)}</td></tr>`

  return `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f4f5;padding:28px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <div style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:14px;font-weight:600;color:#111827;">New support message</div>
    </div>
    <div style="padding:8px 6px;">
      ${row('From', name || '—')}
      ${row('Email', email)}
      ${row('User ID', userId)}
      ${row('Page', page || '—')}
      ${row('Sent', new Date().toISOString())}
    </div>
    <div style="padding:18px 20px;border-top:1px solid #e5e7eb;">
      <div style="font-size:12px;color:#6b7280;margin-bottom:8px;">Message</div>
      <div style="font-size:14px;line-height:1.6;color:#111827;white-space:pre-wrap;">${escapeHtml(message)}</div>
    </div>
    <div style="padding:12px 20px;background:#fafafa;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
      User agent: ${escapeHtml(userAgent || '—')}
    </div>
  </div>
</div>`
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.id || !user.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // 5 messages per hour per account.
    const { allowed } = await checkRateLimit(user.id, {
      interval: 3_600_000,
      maxRequests: 5,
      keyPrefix: 'rl:support:msg',
    })
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many messages sent. Try again later.' },
        { status: 429 }
      )
    }

    const body = (await request.json().catch(() => null)) as { message?: string; page?: string } | null
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    if (message.length < 2 || message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { success: false, error: 'Message must be between 2 and 2000 characters.' },
        { status: 400 }
      )
    }
    const page = typeof body?.page === 'string' ? body.page.slice(0, 200) : ''

    // Recipients: every admin in the database plus the env fallback list.
    // The sender's own address is excluded so an admin messaging support
    // doesn't email themselves.
    const admin = createAdminClient()
    const { data: adminProfiles } = await admin
      .from('profiles')
      .select('email')
      .eq('is_admin', true)

    const senderEmail = user.email.toLowerCase()
    const envAdmins = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)

    const recipients = Array.from(
      new Set([
        ...(adminProfiles || []).map((p) => (p.email || '').toLowerCase().trim()).filter(Boolean),
        ...envAdmins,
      ])
    ).filter((email) => email !== senderEmail && email.includes('@'))

    if (recipients.length === 0) {
      console.error('[SUPPORT] No admin recipients configured')
      return NextResponse.json(
        { success: false, error: 'Support is not configured. Please try again later.' },
        { status: 500 }
      )
    }

    // Sender display name: profile full name, falling back to the email prefix.
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, username')
      .eq('id', user.id)
      .maybeSingle()
    const displayName = profile?.full_name?.trim() || profile?.username || senderEmail.split('@')[0]

    const userAgent = request.headers.get('user-agent') || ''
    const html = buildEmailHtml({
      name: displayName,
      email: user.email,
      userId: user.id,
      message,
      userAgent,
      page,
    })
    const subject = `Mozosubz support — ${displayName}`

    let delivered = 0
    for (const to of recipients) {
      const result = await sendEmail({
        to,
        subject,
        html,
        category: 'transactional',
        tag: 'support_message',
      })
      if (result.sent) delivered += 1
    }

    if (delivered === 0) {
      console.error('[SUPPORT] Message delivered to zero admins', { user: senderEmail })
      return NextResponse.json(
        { success: false, error: 'Message could not be sent. Please try again.' },
        { status: 502 }
      )
    }

    console.log('[SUPPORT] Message delivered', { to: delivered, from: senderEmail })
    return NextResponse.json({ success: true, delivered })
  } catch (error) {
    console.error('[SUPPORT] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Message could not be sent. Please try again.' },
      { status: 500 }
    )
  }
}
