/**
 * Bot OTP verification email.
 *
 * Sent when a user initiates bot authentication (WhatsApp or Telegram).
 * Contains a 6-digit OTP code that must be entered to link the platform.
 */

import { renderShell, escapeHtml } from "./shell"

export interface BotOtpEmailData {
  firstName: string
  platform: 'whatsapp' | 'telegram'
  identifier: string
  otp: string
}

export function botOtpEmail(data: BotOtpEmailData): { subject: string; html: string } {
  const platformName = data.platform === 'whatsapp' ? 'WhatsApp' : 'Telegram'
  const platformEmoji = data.platform === 'whatsapp' ? '💬' : '📱'

  const body = `
    <tr>
      <td align="center" style="padding:36px 40px 12px 40px;" class="mobile-padding">
        <h1 style="margin:0;font-size:24px;font-weight:600;color:#111827;">Link ${platformName} to Mozosubz</h1>
        <p style="margin:10px 0 0 0;color:#6b7280;font-size:15px;line-height:1.6;">
          Hi ${escapeHtml(data.firstName)}, you've requested to link ${platformName} to your Mozosubz account for bot authentication.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:16px 40px 24px 40px;" class="mobile-padding">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#f9fafb;">
          <tr>
            <td align="center" style="padding:30px 20px;">
              <p style="margin:0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Your verification code</p>
              <p style="margin:16px 0 0 0;font-size:42px;font-weight:700;color:#111827;font-family:monospace;letter-spacing:4px;">${escapeHtml(data.otp)}</p>
              <p style="margin:16px 0 0 0;font-size:12px;color:#9ca3af;">Valid for 5 minutes</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:0 40px 24px 40px;" class="mobile-padding">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border:1px solid #86efac;border-radius:12px;">
          <tr>
            <td style="padding:18px 22px;">
              <p style="margin:0;font-size:13px;font-weight:700;color:#15803d;">📱 PLATFORM DETAILS</p>
              <p style="margin:8px 0 0 0;font-size:14px;color:#166534;line-height:1.6;">
                <strong>Platform:</strong> ${platformName}<br>
                <strong>Identifier:</strong> ${escapeHtml(data.identifier)}<br>
                <strong>Action:</strong> Bot authentication enabled
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:0 40px 24px 40px;" class="mobile-padding">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;">
          <tr>
            <td style="padding:18px 22px;">
              <p style="margin:0;font-size:13px;font-weight:700;color:#92400e;">⚠️ SECURITY NOTE</p>
              <p style="margin:8px 0 0 0;font-size:14px;color:#b45309;line-height:1.6;">
                Never share this code with anyone. Mozosubz staff will never ask for your verification code.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding:8px 40px 40px 40px;" class="mobile-padding">
        <p style="margin:0;font-size:13px;color:#9ca3af;">
          ${platformEmoji} Linking your ${platformName} account will enable bot features on Mozosubz
        </p>
      </td>
    </tr>
  `

  const html = renderShell({
    previewText: `Your ${platformName} verification code: ${data.otp}`,
    headerSubtitle: "Verification Code",
    bodyHtml: body,
    unsubscribeUrl: '',
  })

  return {
    subject: `Your ${platformName} verification code: ${data.otp}`,
    html,
  }
}
