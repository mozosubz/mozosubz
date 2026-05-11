import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeWhatsAppPhone } from "@/lib/utils/whatsapp"

/**
 * POST /api/whatsapp/connect
 *
 * Auth: WhatsApp bot API key in `Authorization: Bearer <key>` header.
 *
 * Called by the external WhatsApp bot AFTER it receives a "CONNECT <token>"
 * message from a user. The bot supplies the WhatsApp number it saw the
 * message from plus the token, and we complete the link.
 *
 * Body: { whatsapp_phone: string, token: string }
 */
export async function POST(request: Request) {
  try {
    // --- Authenticate the bot (optional but recommended) ---
    // If WHATSAPP_BOT_API_KEY is set, callers MUST present it as a
    // Bearer token. If it's not set, we accept any caller — useful for
    // local dev, but in production you should always set the env var.
    const botKey = process.env.WHATSAPP_BOT_API_KEY
    if (botKey) {
      const authHeader = request.headers.get("authorization") ?? ""
      const presentedKey = authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : ""

      if (!presentedKey || presentedKey !== botKey) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 },
        )
      }
    }

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

    const admin = createAdminClient()

    // --- Look up the pending session by token ---
    const { data: session } = await admin
      .from("whatsapp_sessions")
      .select("id, user_id, connect_token, token_expires_at, is_verified")
      .eq("connect_token", token)
      .maybeSingle()

    if (!session) {
      void admin.from("whatsapp_audit_logs").insert({
        whatsapp_phone: whatsappPhone,
        event_type: "connect_failed",
        details: { reason: "token_not_found" },
      })
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
      })
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 400 },
      )
    }

    // --- Ensure this WhatsApp number isn't already linked to a different user ---
    const { data: existingForPhone } = await admin
      .from("whatsapp_sessions")
      .select("user_id")
      .eq("whatsapp_phone", whatsappPhone)
      .maybeSingle()

    if (existingForPhone && existingForPhone.user_id !== session.user_id) {
      void admin.from("whatsapp_audit_logs").insert({
        user_id: session.user_id,
        whatsapp_phone: whatsappPhone,
        event_type: "connect_failed",
        details: { reason: "phone_already_linked" },
      })
      return NextResponse.json(
        {
          success: false,
          error: "This WhatsApp number is already linked to another account",
        },
        { status: 409 },
      )
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
    })

    return NextResponse.json({
      success: true,
      user_id: session.user_id,
      whatsapp_phone: whatsappPhone,
      verified_at: now,
    })
  } catch (err) {
    console.error("[v0] whatsapp connect fatal:", err)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    )
  }
}
