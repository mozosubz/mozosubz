import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeWhatsAppPhone } from "@/lib/utils/whatsapp"
import { sendWhatsAppEventEmail } from "@/lib/email/send-whatsapp-event-email"

/**
 * POST /api/whatsapp/connect
 *
 * OPEN API - No authentication required.
 *
 * Called by the external WhatsApp bot AFTER it receives a "CONNECT <token>"
 * message from a user. The bot supplies the WhatsApp number it saw the
 * message from plus the token, and we complete the link.
 *
 * Body: { whatsapp_phone: string, token: string }
 */
export async function POST(request: NextRequest) {
  try {
    // --- Validate body ---
    const body = await request.json()

    const whatsappPhone = normalizeWhatsAppPhone(body?.whatsapp_phone)
    const token = typeof body?.token === "string" ? body.token.trim() : ""

    if (!whatsappPhone) {
      return NextResponse.json(
        { success: false, error: "whatsapp_phone is invalid or missing" },
        { status: 400 },
      )
    }
    if (!token) {
      return NextResponse.json(
        { success: false, error: "token is required" },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    // --- Look up the pending session by token ---
    const { data: session, error: sessionError } = await admin
      .from("whatsapp_sessions")
      .select("id, user_id, connect_token, token_expires_at, is_verified")
      .eq("connect_token", token)
      .maybeSingle()

    if (sessionError) {
      console.error("[WHATSAPP_CONNECT] session lookup error:", sessionError)
      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 },
      )
    }

    if (!session) {
      console.log("[WHATSAPP_CONNECT] Token not found:", token)
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 400 },
      )
    }

    // Token expiry check (10 min)
    if (
      session.token_expires_at &&
      new Date(session.token_expires_at).getTime() < Date.now()
    ) {
      console.log("[WHATSAPP_CONNECT] Token expired:", token)
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 400 },
      )
    }

    // --- Check if this WhatsApp number is in cooldown from a previous disconnect ---
    const { data: cooldownSession, error: cooldownError } = await admin
      .from("whatsapp_sessions")
      .select("disconnect_cooldown_until, user_id")
      .eq("whatsapp_phone", whatsappPhone)
      .is("user_id", null)
      .maybeSingle()

    if (cooldownError) {
      console.error("[WHATSAPP_CONNECT] cooldown check error:", cooldownError)
      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 },
      )
    }

    if (cooldownSession?.disconnect_cooldown_until) {
      if (new Date(cooldownSession.disconnect_cooldown_until).getTime() > Date.now()) {
        console.log("[WHATSAPP_CONNECT] Phone in cooldown:", whatsappPhone)
        return NextResponse.json(
          {
            success: false,
            error: "This WhatsApp number is temporarily unavailable (24-hour security cooldown after disconnection).",
          },
          { status: 400 },
        )
      }
    }

    // --- Ensure this WhatsApp number isn't already linked to a different user ---
    const { data: existingForPhone, error: existingError } = await admin
      .from("whatsapp_sessions")
      .select("user_id, is_verified")
      .eq("whatsapp_phone", whatsappPhone)
      .not("user_id", "is", null)
      .maybeSingle()

    if (existingError) {
      console.error("[WHATSAPP_CONNECT] existing phone check error:", existingError)
      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 },
      )
    }

    if (existingForPhone && existingForPhone.user_id !== session.user_id) {
      console.log("[WHATSAPP_CONNECT] Phone already linked to different user:", whatsappPhone)
      return NextResponse.json(
        { success: false, error: "This WhatsApp number is already linked to another account." },
        { status: 400 },
      )
    }

    // --- Execute the connection: update the pending session with the phone number and mark verified ---
    const { error: updateError } = await admin
      .from("whatsapp_sessions")
      .update({
        whatsapp_phone: whatsappPhone,
        is_verified: true,
        verified_at: new Date().toISOString(),
        disconnect_cooldown_until: null,
      })
      .eq("id", session.id)

    if (updateError) {
      console.error("[WHATSAPP_CONNECT] failed to update session:", updateError)
      return NextResponse.json(
        { success: false, error: "Failed to complete connection" },
        { status: 500 },
      )
    }

    // Fire-and-forget: Log to audit log
    void admin
      .from("whatsapp_audit_logs")
      .insert({
        user_id: session.user_id,
        whatsapp_phone: whatsappPhone,
        event_type: "connect_success",
      })
      .catch(err => console.error("[WHATSAPP_CONNECT] audit log error:", err))

    // Fire-and-forget: Send connection email
    void sendWhatsAppEventEmail({
      userId: session.user_id,
      eventType: "CONNECTED",
      whatsappPhone: whatsappPhone,
    }).catch(err => console.error("[WHATSAPP_CONNECT] email error:", err))

    console.log("[WHATSAPP_CONNECT] Successfully connected:", {
      userId: session.user_id,
      whatsappPhone,
    })

    return NextResponse.json({
      success: true,
      message: "WhatsApp successfully connected",
      whatsappPhone,
    })
  } catch (err) {
    console.error("[WHATSAPP_CONNECT] Fatal error:", {
      message: err instanceof Error ? err.message : String(err),
      type: typeof err,
    })
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    )
  }
}
