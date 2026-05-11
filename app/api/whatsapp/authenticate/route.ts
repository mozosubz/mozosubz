import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeWhatsAppPhone } from "@/lib/utils/whatsapp"

/**
 * POST /api/whatsapp/authenticate
 *
 * OPEN API - No authentication required. External WhatsApp bots call this
 * to resolve a WhatsApp phone number → Mozosubz user_id + full profile.
 *
 * Given a raw WhatsApp phone number (from wa.me or WhatsApp message sender),
 * checks if it's linked to a Mozosubz account. If yes, returns user_id + profile.
 * Bot then uses user_id for ALL subsequent business API calls (airtime, data,
 * cable, electricity, wallet, etc).
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
