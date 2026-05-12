import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendWhatsAppEventEmail } from "@/lib/email/send-whatsapp-event-email"

/**
 * POST /api/whatsapp/disconnect
 *
 * Auth: Supabase session cookie (the signed-in user disconnects their own
 * WhatsApp from the profile page).
 *
 * Soft-deletes the WhatsApp connection and sets a 24-hour cooldown so the
 * same number can't be reconnected (to any account) for 24 hours.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      )
    }

    const admin = createAdminClient()

    const { data: existing } = await admin
      .from("whatsapp_sessions")
      .select("whatsapp_phone, id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({
        success: true,
        already_disconnected: true,
      })
    }

    // Calculate 24-hour cooldown end time
    const cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    // Soft-delete: mark user_id as null and set cooldown
    const { error: updateError } = await admin
      .from("whatsapp_sessions")
      .update({
        user_id: null,
        is_verified: false,
        disconnected_at: new Date().toISOString(),
        disconnect_cooldown_until: cooldownUntil,
        verified_at: null,
        connect_token: null,
        token_expires_at: null,
      })
      .eq("id", existing.id)

    if (updateError) {
      console.error("[v0] whatsapp disconnect error:", updateError)
      return NextResponse.json(
        { success: false, error: "Failed to disconnect WhatsApp" },
        { status: 500 },
      )
    }

    void admin.from("whatsapp_audit_logs").insert({
      user_id: user.id,
      whatsapp_phone: existing.whatsapp_phone,
      event_type: "disconnect",
      ip_address: request.headers.get("x-forwarded-for") ?? null,
      user_agent: request.headers.get("user-agent") ?? null,
    })

    // Send disconnection email (fire and forget)
    void sendWhatsAppEventEmail({
      userId: user.id,
      eventType: "DISCONNECTED",
      whatsappPhone: existing.whatsapp_phone,
    })

    return NextResponse.json({
      success: true,
      message: "WhatsApp disconnected",
    })
  } catch (err) {
    console.error("[v0] whatsapp disconnect fatal:", err)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    )
  }
}
