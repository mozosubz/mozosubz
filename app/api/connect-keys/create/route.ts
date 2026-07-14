import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateConnectKey, hashConnectKey, getKeyPreview } from '@/lib/utils/connect-key'

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let name = 'default'
  try {
    const body = await request.json()
    if (body?.name && typeof body.name === 'string') {
      name = body.name.trim().slice(0, 64)
    }
  } catch {
    // use default name
  }

  const admin = createAdminClient()

  // Revoke any existing active keys for this user
  await admin
    .from('connect_keys')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('revoked_at', null)

  // Generate new key
  const rawKey = generateConnectKey()
  const keyHash = hashConnectKey(rawKey)
  const keyPreview = getKeyPreview(rawKey)

  const { error } = await admin.from('connect_keys').insert({
    user_id: user.id,
    name,
    key_hash: keyHash,
    key_preview: keyPreview,
    is_active: true,
    permissions: ['data', 'airtime'],
    created_at: new Date().toISOString(),
  })

  if (error) {
    return NextResponse.json({ success: false, error: 'Failed to create key' }, { status: 500 })
  }

  // Return the raw key ONCE — it is never stored in plaintext
  return NextResponse.json({ success: true, key: rawKey, keyPreview })
}
