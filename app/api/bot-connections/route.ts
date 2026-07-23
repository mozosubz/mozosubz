import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch connections from database
    const adminSupabase = createAdminClient()
    const { data: connections, error: connectError } = await adminSupabase
      .from("bot_connections")
      .select("id, platform, identifier, connected_at, last_active_at")
      .eq("user_id", user.id)
      .order("connected_at", { ascending: false })

    if (connectError) {
      console.error("[Bot Connections API] Database error:", connectError)
      return NextResponse.json(
        { error: "Failed to fetch connections" },
        { status: 500 }
      )
    }

    // Format response
    const formattedConnections = (connections || []).map((conn) => ({
      id: conn.id,
      platform: conn.platform,
      identifier: conn.identifier,
      connected_at: conn.connected_at,
      last_active: conn.last_active_at,
      status: "active",
    }))

    console.log(
      `[Bot Connections API] Found ${formattedConnections.length} connections for user ${user.id}:`,
      formattedConnections
    )

    return NextResponse.json({
      connections: formattedConnections,
    })
  } catch (err) {
    console.error("[Bot Connections API] Error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
