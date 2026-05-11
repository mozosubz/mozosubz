import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeWhatsAppNumber, isValidWhatsAppNumber } from "@/lib/utils/whatsapp-token"

export async function POST(request: NextRequest) {
  try {
    const { whatsapp_number } = await request.json()

    if (!whatsapp_number) {
      return NextResponse.json(
        { error: "WhatsApp number required" },
        { status: 400 }
      )
    }

    if (!isValidWhatsAppNumber(whatsapp_number)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid WhatsApp number format",
        },
        { status: 400 }
      )
    }

    const normalizedNumber = normalizeWhatsAppNumber(whatsapp_number)
    const supabase = createAdminClient()

    // Find verified connection
    const { data: connection } = await supabase
      .from("whatsapp_connections")
      .select("user_id, verified, disconnected_at")
      .eq("whatsapp_number", normalizedNumber)
      .eq("verified", true)
      .is("disconnected_at", null)
      .single()

    if (!connection) {
      return NextResponse.json({
        success: false,
        error: "WhatsApp not connected",
      }, { status: 401 })
    }

    // Get user wallet balance
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, wallet_balance, full_name")
      .eq("id", connection.user_id)
      .single()

    if (error || !profile) {
      return NextResponse.json(
        { error: "Failed to get balance" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user_id: connection.user_id,
      wallet_balance: profile.wallet_balance,
      user_name: profile.full_name,
    })
  } catch (error) {
    console.error("[v0] WhatsApp balance error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
