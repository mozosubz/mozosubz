import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * POST /api/whatsapp/disconnect
 *
 * Auth: Supabase session cookie (the signed-in user disconnects their own
 * WhatsApp from the profile page).
 *
 * Removes the WhatsApp connection row entirely so the same number can be
 * re-linked later (to this account or another).
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
      .select("whatsapp_phone")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({
        success: true,
        already_disconnected: true,
      })
    }

    const { error: deleteError } = await admin
      .from("whatsapp_sessions")
      .delete()
      .eq("user_id", user.id)

    if (deleteError) {
      console.error("[v0] whatsapp disconnect error:", deleteError)
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
