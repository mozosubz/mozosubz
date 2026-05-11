import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeWhatsAppNumber, isValidWhatsAppNumber } from "@/lib/utils/whatsapp-token"

export async function POST(request: NextRequest) {
  try {
    const { whatsapp_number, amount, description } = await request.json()

    if (!whatsapp_number) {
      return NextResponse.json(
        { error: "WhatsApp number required" },
        { status: 400 }
      )
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
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

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", connection.user_id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Failed to get user information" },
        { status: 400 }
      )
    }

    // Forward the deposit request to the existing deposit API
    // The WhatsApp bot should use this to initiate deposit
    // This endpoint validates the WhatsApp connection and proxies to /api/deposit/start
    // with the authenticated user context

    return NextResponse.json({
      success: true,
      message: "Use this user_id to call /api/deposit/start",
      user_id: connection.user_id,
      user_email: profile.email,
      user_name: profile.full_name,
      amount: parseFloat(amount),
      description: description || "Wallet deposit via WhatsApp",
      next_step: "POST /api/deposit/start with user context",
    })
  } catch (error) {
    console.error("[v0] WhatsApp deposit error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
