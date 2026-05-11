import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeWhatsAppPhone } from "@/lib/utils/whatsapp"

/**
 * POST /api/whatsapp/authenticate
 *
 * Auth: WhatsApp bot API key in `Authorization: Bearer <key>` header.
 *
 * Given a raw WhatsApp phone number (the bot sees the sender's wa.me number),
 * resolves it to the Mozosubz user_id + profile snapshot. This is the bridge
 * the bot uses BEFORE calling any other Mozosubz business API — it confirms
 * "this WhatsApp number belongs to a real Mozosubz user, here is who".
 *
 * No existing business APIs are modified by this layer. The bot is expected
 * to use the returned user_id when calling existing endpoints on behalf of
 * the user.
 *
 * Body: { whatsapp_phone: string }
 *
 * Response (linked):
 *   { success: true, authenticated: true, user_id, profile: {...} }
 *
 * Response (not linked):
 *   { success: true, authenticated: false }
 */
export async function POST(request: Request) {
  try {
    // --- Authenticate the bot ---
    const botKey = process.env.WHATSAPP_BOT_API_KEY
    if (!botKey) {
      return NextResponse.json(
        { success: false, error: "WhatsApp bot is not configured" },
        { status: 503 },
      )
    }

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
    if (!whatsappPhone) {
      return NextResponse.json(
        { success: false, error: "whatsapp_phone is invalid or missing" },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    // --- Resolve the session row ---
    const { data: session } = await admin
      .from("whatsapp_sessions")
      .select("user_id, is_verified, verified_at")
      .eq("whatsapp_phone", whatsappPhone)
      .maybeSingle()

    if (!session || !session.is_verified) {
      void admin.from("whatsapp_audit_logs").insert({
        whatsapp_phone: whatsappPhone,
        event_type: "authenticate_failed",
        details: { reason: "not_linked" },
      })
      return NextResponse.json({
        success: true,
        authenticated: false,
      })
    }

    // --- Fetch profile snapshot ---
    const { data: profile } = await admin
      .from("profiles")
      .select(
        "id, email, full_name, username, phone_number, wallet_balance, is_admin",
      )
      .eq("id", session.user_id)
      .maybeSingle()

    // Touch last_activity (best-effort)
    void admin
      .from("whatsapp_sessions")
      .update({ last_activity: new Date().toISOString() })
      .eq("user_id", session.user_id)

    void admin.from("whatsapp_audit_logs").insert({
      user_id: session.user_id,
      whatsapp_phone: whatsappPhone,
      event_type: "authenticate_success",
    })

    return NextResponse.json({
      success: true,
      authenticated: true,
      user_id: session.user_id,
      verified_at: session.verified_at,
      profile: profile
        ? {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            username: profile.username,
            phone_number: profile.phone_number,
            wallet_balance: profile.wallet_balance,
            is_admin: profile.is_admin,
          }
        : null,
    })
  } catch (err) {
    console.error("[v0] whatsapp authenticate fatal:", err)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    )
  }
}
