import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  generateConnectToken,
  CONNECT_TOKEN_TTL_MS,
  maskWhatsAppPhone,
} from "@/lib/utils/whatsapp"

/**
 * POST /api/whatsapp/connect-token
 *
 * Auth: Supabase session cookie (i.e. a signed-in Mozosubz user).
 *
 * Generates a short-lived (10 minute) connect token that the user must
 * forward via WhatsApp to the bot. The bot then calls /api/whatsapp/connect
 * with { whatsapp_phone, token } to finalize the link.
 *
 * If the user is already connected, this endpoint returns the existing
 * connection (masked phone) instead of issuing a new token.
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

    // If already verified, do not issue a new token — surface the existing link.
    const { data: existing } = await admin
      .from("whatsapp_sessions")
      .select("whatsapp_phone, is_verified, verified_at")
      .eq("user_id", user.id)
      .maybeSingle()

    if (existing?.is_verified && existing.whatsapp_phone) {
      return NextResponse.json({
        success: true,
        already_connected: true,
        whatsapp_phone_masked: maskWhatsAppPhone(existing.whatsapp_phone),
        verified_at: existing.verified_at,
      })
    }

    const token = generateConnectToken()
    const expiresAt = new Date(Date.now() + CONNECT_TOKEN_TTL_MS).toISOString()

    // Upsert by user_id (unique). A pending row may already exist from a
    // previous attempt — overwrite the token + expiry.
    const { error: upsertError } = await admin
      .from("whatsapp_sessions")
      .upsert(
        {
          user_id: user.id,
          connect_token: token,
          token_expires_at: expiresAt,
          is_verified: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )

    if (upsertError) {
      console.error("[v0] whatsapp connect-token upsert error:", upsertError)
      return NextResponse.json(
        { success: false, error: "Failed to generate token" },
        { status: 500 },
      )
    }

    // Best-effort audit log — never block the response on this.
    void admin.from("whatsapp_audit_logs").insert({
      user_id: user.id,
      event_type: "token_generated",
      ip_address: request.headers.get("x-forwarded-for") ?? null,
      user_agent: request.headers.get("user-agent") ?? null,
    })

    return NextResponse.json({
      success: true,
      token,
      expires_in_minutes: 10,
      expires_at: expiresAt,
      instructions:
        "Send the message 'CONNECT " +
        token +
        "' to the Mozosubz WhatsApp bot to finish linking your account.",
    })
  } catch (err) {
    console.error("[v0] whatsapp connect-token fatal:", err)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    )
  }
}
