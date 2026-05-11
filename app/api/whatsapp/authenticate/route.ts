import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeWhatsAppPhone } from "@/lib/utils/whatsapp"

/**
 * POST /api/whatsapp/authenticate
 *
 * OPEN API - External WhatsApp bots call this to resolve a WhatsApp phone number
 * to a Mozosubz user profile.
 *
 * Security: Only WhatsApp numbers that were explicitly linked by users
 * (via the connect flow) will authenticate. The bot extracts the sender's
 * WhatsApp number from the incoming message and calls this endpoint.
 *
 * Body: { whatsapp_phone: string }
 * 
 * Examples:
 *   Linked: { success: true, authenticated: true, user_id, profile: {...} }
 *   Not linked: { success: true, authenticated: false, message: "..." }
 *   Disconnected: { success: true, authenticated: false, message: "..." }
 */
export async function POST(request: Request) {
  try {
    // --- Validate body ---
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          message: "Invalid request format",
        },
        { status: 200 },
      )
    }

    const whatsappPhone = normalizeWhatsAppPhone(body?.whatsapp_phone)
    if (!whatsappPhone) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          message: "Invalid or missing WhatsApp phone number",
        },
        { status: 200 },
      )
    }

    const admin = createAdminClient()

    // --- Check if WhatsApp number exists and is verified ---
    const { data: session, error: sessionError } = await admin
      .from("whatsapp_sessions")
      .select(
        "id, user_id, is_verified, verified_at, created_at, updated_at, last_activity",
      )
      .eq("whatsapp_phone", whatsappPhone)
      .maybeSingle()

    // If query fails, return error but don't expose DB issues
    if (sessionError) {
      console.error("[v0] whatsapp session query error:", sessionError)
      void admin.from("whatsapp_audit_logs").insert({
        whatsapp_phone: whatsappPhone,
        event_type: "authenticate_failed",
        details: { reason: "database_error" },
      })
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          message: "Unable to verify this number at the moment",
        },
        { status: 200 },
      )
    }

    // --- Number not connected to any account ---
    if (!session) {
      void admin.from("whatsapp_audit_logs").insert({
        whatsapp_phone: whatsappPhone,
        event_type: "authenticate_failed",
        details: { reason: "not_linked" },
      })
      return NextResponse.json(
        {
          success: true,
          authenticated: false,
          message:
            "This WhatsApp number is not connected to an active Mozosubz account. Please connect it on the website first.",
        },
        { status: 200 },
      )
    }

    // --- Number connected but not verified (disconnected) ---
    if (!session.is_verified) {
      void admin.from("whatsapp_audit_logs").insert({
        whatsapp_phone: whatsappPhone,
        event_type: "authenticate_failed",
        details: { reason: "not_verified" },
      })
      return NextResponse.json(
        {
          success: true,
          authenticated: false,
          message:
            "This WhatsApp number has been disconnected from your account. Please reconnect it on the website.",
        },
        { status: 200 },
      )
    }

    // --- Fetch user profile ---
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select(
        "id, email, full_name, username, phone_number, wallet_balance, is_admin",
      )
      .eq("id", session.user_id)
      .maybeSingle()

    if (profileError) {
      console.error("[v0] whatsapp profile query error:", profileError)
      void admin.from("whatsapp_audit_logs").insert({
        user_id: session.user_id,
        whatsapp_phone: whatsappPhone,
        event_type: "authenticate_failed",
        details: { reason: "profile_fetch_error" },
      })
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          message: "Unable to retrieve user profile",
        },
        { status: 200 },
      )
    }

    // --- User profile not found (edge case: user deleted but session exists) ---
    if (!profile) {
      void admin.from("whatsapp_audit_logs").insert({
        user_id: session.user_id,
        whatsapp_phone: whatsappPhone,
        event_type: "authenticate_failed",
        details: { reason: "profile_not_found" },
      })
      return NextResponse.json(
        {
          success: true,
          authenticated: false,
          message:
            "Account associated with this WhatsApp number no longer exists",
        },
        { status: 200 },
      )
    }

    // --- Update last activity (fire and forget) ---
    void admin
      .from("whatsapp_sessions")
      .update({ last_activity: new Date().toISOString() })
      .eq("id", session.id)

    // --- Log successful authentication ---
    void admin.from("whatsapp_audit_logs").insert({
      user_id: session.user_id,
      whatsapp_phone: whatsappPhone,
      event_type: "authenticate_success",
    })

    // --- Return authenticated user profile ---
    return NextResponse.json(
      {
        success: true,
        authenticated: true,
        user_id: session.user_id,
        verified_at: session.verified_at,
        profile: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          username: profile.username,
          phone_number: profile.phone_number,
          wallet_balance: profile.wallet_balance,
          is_admin: profile.is_admin,
        },
      },
      { status: 200 },
    )
  } catch (err) {
    console.error("[v0] whatsapp authenticate fatal:", err)
    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        message: "Internal server error",
      },
      { status: 200 },
    )
  }
}
