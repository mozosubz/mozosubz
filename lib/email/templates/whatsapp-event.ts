import { renderShell, escapeHtml, formatDateTime } from "./shell"

export type WhatsAppEventType = "CONNECTED" | "DISCONNECTED"

export interface WhatsAppEventData {
  firstName: string
  eventType: WhatsAppEventType
  whatsappPhone: string
  createdAt?: Date | string
  actionUrl: string
  unsubscribeUrl: string
}

function titleFor(eventType: WhatsAppEventType): string {
  if (eventType === "CONNECTED") return "WhatsApp Connected"
  return "WhatsApp Disconnected"
}

function messagFor(eventType: WhatsAppEventType, phone: string): string {
  if (eventType === "CONNECTED") {
    return `Your WhatsApp number <strong>${escapeHtml(phone)}</strong> has been successfully connected to your Mozosubz account. You can now use your WhatsApp bot to access all Mozosubz services.`
  }
  return `Your WhatsApp number <strong>${escapeHtml(phone)}</strong> has been disconnected from your Mozosubz account. It will be available to reconnect in 24 hours.`
}

function badgeFor(eventType: WhatsAppEventType): { bg: string; color: string } {
  if (eventType === "CONNECTED") return { bg: "#dcfce7", color: "#16a34a" }
  return { bg: "#fee2e2", color: "#dc2626" }
}

export function whatsappEventEmail(data: WhatsAppEventData): { subject: string; html: string } {
  const title = titleFor(data.eventType)
  const badge = badgeFor(data.eventType)
  const message = messagFor(data.eventType, data.whatsappPhone)
  const when = formatDateTime(data.createdAt || new Date())

  const body = `
    <tr>
      <td align="center" style="padding:36px 40px 20px 40px;" class="mobile-padding">
        <h1 style="margin:0;font-size:28px;font-weight:600;color:#111827;">${escapeHtml(title)}</h1>
        <p style="margin:8px 0 0 0;font-size:16px;color:#6b7280;">Hi ${escapeHtml(data.firstName)},</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px;" class="mobile-padding">
        <div style="background:${badge.bg};border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0;color:${badge.color};font-weight:600;font-size:14px;">
            ${escapeHtml(data.eventType === "CONNECTED" ? "✓ Connected" : "✗ Disconnected")}
          </p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 40px;" class="mobile-padding">
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
          ${message}
        </p>
        <p style="margin:16px 0 0 0;font-size:12px;color:#9ca3af;">
          WhatsApp Phone: ${escapeHtml(data.whatsappPhone)}<br/>
          Date: ${when}
        </p>
      </td>
    </tr>
  `

  const subject = data.eventType === "CONNECTED" 
    ? "WhatsApp Connected to Your Mozosubz Account"
    : "WhatsApp Disconnected from Your Mozosubz Account"

  const html = renderShell({
    preheader: title,
    body,
    actionText: "View Account",
    actionUrl: data.actionUrl,
    unsubscribeUrl: data.unsubscribeUrl,
  })

  return { subject, html }
}
