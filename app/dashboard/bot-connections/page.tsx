import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
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

  // Fetch bot connections from API
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://api.mozosubz.xyz"
  const connectionsRes = await fetch(`${baseUrl}/api/v1/bot-auth/connections`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "User-ID": user.id,
    },
    next: { revalidate: 60 },
  })

  const connectionsData = connectionsRes.ok ? await connectionsRes.json() : { connections: [] }

  return (
    <BotConnectionsClient
      initialUser={{ id: user.id, email: user.email ?? null }}
      initialConnections={connectionsData.connections || []}
    />
  )
}
