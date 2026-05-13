import { NextResponse } from "next/server"
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
export async function POST(request: Request) {
  try {
    // --- Validate body ---
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 },
      )
    }

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

    // Check env vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl) {
      return NextResponse.json(
        { success: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL" },
        { status: 503 },
      )
    }
    if (!serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 503 },
      )
    }

    // Create admin client
    const admin = createAdminClient()

    // --- Look up the pending session by token ---
    const { data: session, error: sessionError } = await admin
      .from("whatsapp_sessions")
      .select("id, user_id, connect_token, token_expires_at, is_verified")
      .eq("connect_token", token)
      .maybeSingle()

    if (sessionError) {
      console.error("[v0] whatsapp connect session lookup error:", sessionError)
      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 },
      )
    }

    if (!session) {
      void admin.from("whatsapp_audit_logs").insert({
        whatsapp_phone: whatsappPhone,
        event_type: "connect_failed",
        details: { reason: "token_not_found" },
      }).catch(err => console.error("[v0] audit log error:", err))
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
      void admin.from("whatsapp_audit_logs").insert({
        user_id: session.user_id,
        whatsapp_phone: whatsappPhone,
        event_type: "connect_failed",
        details: { reason: "token_expired" },
      }).catch(err => console.error("[v0] audit log error:", err))
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
      console.error("[v0] whatsapp cooldown check error:", cooldownError)
      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 },
      )
    }

    if (cooldownSession && cooldownSession.disconnect_cooldown_until) {
      if (new Date(cooldownSession.disconnect_cooldown_until).getTime() > Date.now()) {
        void admin.from("whatsapp_audit_logs").insert({
          whatsapp_phone: whatsappPhone,
          event_type: "connect_failed",
          details: { reason: "in_cooldown" },
        }).catch(err => console.error("[v0] audit log error:", err))
        return NextResponse.json(
          {
            success: false,
            error: "This WhatsApp number is temporarily unavailable (24-hour security cooldown after disconnection). Please try again later.",
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
      console.error("[v0] whatsapp existing phone check error:", existingError)
      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 },
      )
    }

    if (existingForPhone) {
      if (existingForPhone.user_id !== session.user_id) {
        void admin.from("whatsapp_audit_logs").insert({
          user_id: session.user_id,
          whatsapp_phone: whatsappPhone,
          event_type: "connect_failed",
          details: { reason: "phone_already_linked" },
        }).catch(err => console.error("[v0] audit log error:", err))
        return NextResponse.json(
          {
            success: false,
            error: "This WhatsApp number is already connected to another account. Please disconnect it from that account first.",
          },
          { status: 409 },
        )
      }
      // If it's the same user but already verified, just return success
      if (existingForPhone.is_verified) {
        return NextResponse.json({
          success: true,
          user_id: session.user_id,
          whatsapp_phone: whatsappPhone,
          message: "WhatsApp already connected",
        })
      }
    }

    // --- Finalize ---
    const now = new Date().toISOString()
    const { error: updateError } = await admin
      .from("whatsapp_sessions")
      .update({
        whatsapp_phone: whatsappPhone,
        is_verified: true,
        verified_at: now,
        connect_token: null,
        token_expires_at: null,
        last_activity: now,
        updated_at: now,
      })
      .eq("id", session.id)

    if (updateError) {
      console.error("[v0] whatsapp connect update error:", updateError)
      return NextResponse.json(
        { success: false, error: "Failed to link WhatsApp" },
        { status: 500 },
      )
    }

    void admin.from("whatsapp_audit_logs").insert({
      user_id: session.user_id,
      whatsapp_phone: whatsappPhone,
      event_type: "connect_success",
    }).catch(err => console.error("[v0] audit log error:", err))

    // Send connection email (fire and forget)
    void sendWhatsAppEventEmail({
      userId: session.user_id,
      eventType: "CONNECTED",
      whatsappPhone: whatsappPhone,
    }).catch(err => console.error("[v0] email send error:", err))

    return NextResponse.json({
      success: true,
      user_id: session.user_id,
      whatsapp_phone: whatsappPhone,
      verified_at: now,
    })
  } catch (err) {
    console.error("[v0] whatsapp connect fatal error:", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    )
  }
}
