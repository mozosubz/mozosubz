import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { ConnectedDevicesClient } from '@/components/connected-devices-client'

export default async function ConnectedDevicesPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (!user || authError) {
    redirect('/login')
  }

  // Fetch user's connect key
  const { data: apiKey } = await supabase
    .from('api_keys')
    .select('connect_key')
    .eq('user_id', user.id)
    .eq('permissions', JSON.stringify(['data', 'airtime', 'bot']))
    .maybeSingle()

  return (
    <ConnectedDevicesClient
      initialUser={{ id: user.id, email: user.email ?? null }}
      connectKey={apiKey?.connect_key ?? null}
    />
  )
}


