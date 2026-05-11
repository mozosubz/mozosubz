import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { WhatsAppConnectClient } from "@/components/whatsapp-connect-client"
import { maskWhatsAppPhone } from "@/lib/utils/whatsapp"

export const metadata = {
  title: "Connect WhatsApp - Mozosubz",
  description: "Link your WhatsApp account to your Mozosubz wallet.",
}

export default async function WhatsAppConnectPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?next=/profile/whatsapp")
  }

  // Read current connection state (server-side, first paint accurate)
  const { data: session } = await supabase
    .from("whatsapp_sessions")
    .select("whatsapp_phone, is_verified, verified_at")
    .eq("user_id", user.id)
    .maybeSingle()

  const connected = !!(session?.is_verified && session.whatsapp_phone)

  return (
    <WhatsAppConnectClient
      connected={connected}
      maskedPhone={connected ? maskWhatsAppPhone(session!.whatsapp_phone) : null}
      verifiedAt={connected ? session!.verified_at : null}
    />
  )
}
