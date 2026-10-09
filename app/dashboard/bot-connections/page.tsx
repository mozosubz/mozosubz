"use server"

import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { BotConnectionsClient } from "@/components/bot-connections-client"

async function fetchBotConnections(userId: string) {
  const adminSupabase = createAdminClient()
  const { data: connections, error: connectError } = await adminSupabase
    .from("bot_connections")
    .select("id, platform, identifier, connected_at, last_active_at")
    .eq("user_id", userId)
    .order("connected_at", { ascending: false })

  if (connectError) {
    console.error("Failed to fetch connections:", connectError)
    return []
  }

  return (connections || []).map((conn) => ({
    id: conn.id,
    platform: conn.platform,
    identifier: conn.identifier,
    connected_at: conn.connected_at,
    last_active: conn.last_active_at,
    status: "active",
  }))
}

export async function refreshBotConnections(userId: string) {
  return await fetchBotConnections(userId)
}

export default async function BotConnectionsPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (!user || authError) {
    redirect("/login")
  }

  // Fetch bot connections from database
  const connections = await fetchBotConnections(user.id)

  return (
    <BotConnectionsClient
      userId={user.id}
      initialUser={{ id: user.id, email: user.email ?? null }}
      initialConnections={connections}
    />
  )
}
