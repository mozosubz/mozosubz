import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clearConnectKeyCacheForUser } from '@/lib/middleware/verify-connect-key'

export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('connect_keys')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .select('id')

  if (error) {
    return NextResponse.json({ success: false, error: 'Failed to revoke key' }, { status: 500 })
  }

  // Bounty fix: never report success when nothing was revoked — a zero-row
  // update must surface as an error so clients don't trust a stale key.
  if (!data || data.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No active keys to revoke' },
      { status: 404 }
    )
  }

  // Without this the 60-second verifier cache keeps honouring the revoked key
  // on this instance. (Other instances still expire within the TTL.)
  clearConnectKeyCacheForUser(user.id)

  return NextResponse.json({ success: true, revoked: data.length })
}
