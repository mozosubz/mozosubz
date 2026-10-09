import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function DELETE(request: NextRequest) {
  try {
    // Get the connection ID from the URL query
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get("id")

    if (!connectionId) {
      return NextResponse.json(
        { error: "Connection ID required" },
        { status: 400 }
      )
    }

    // Get authenticated user
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Delete the connection using admin client
    const adminSupabase = createAdminClient()
    const { error: deleteError } = await adminSupabase
      .from("bot_connections")
      .delete()
      .eq("id", connectionId)
      .eq("user_id", user.id) // Ensure user can only delete their own connections

    if (deleteError) {
      console.error("[Disconnect Bot] Delete error:", deleteError)
      return NextResponse.json(
        { error: "Failed to disconnect bot" },
        { status: 500 }
      )
    }


    return NextResponse.json(
      { success: true, message: "Bot disconnected successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("[Disconnect Bot] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
