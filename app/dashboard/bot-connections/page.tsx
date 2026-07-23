import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { BotConnectionsClient } from "@/components/bot-connections-client"

export default async function BotConnectionsPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (!user || authError) {
    redirect("/login")
  }

  // Fetch bot connections directly from database using admin client
  const adminSupabase = createAdminClient()
  const { data: connections, error: connectError } = await adminSupabase
    .from("bot_connections")
    .select("id, platform, identifier, connected_at, last_active_at, status")
    .eq("user_id", user.id)
    .order("connected_at", { ascending: false })

  if (connectError) {
    console.error("[Bot Connections Page] Failed to fetch connections:", connectError)
  }

  // Map database fields to component interface
  const formattedConnections = (connections || []).map((conn) => ({
    id: conn.id,
    platform: conn.platform,
    identifier: conn.identifier,
    connected_at: conn.connected_at,
    last_active: conn.last_active_at,
    status: conn.status || "active",
  }))

  return (
    <BotConnectionsClient
      initialUser={{ id: user.id, email: user.email ?? null }}
      initialConnections={formattedConnections}
    />
  )
}
