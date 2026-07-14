import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: keys, error } = await admin
    .from('connect_keys')
    .select('id, name, key_preview, is_active, created_at, last_used_at, request_count')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch keys' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    keys: (keys || []).map((k) => ({
      id: k.id,
      name: k.name,
      keyPreview: k.key_preview,
      createdAt: k.created_at,
      lastUsedAt: k.last_used_at,
      requestCount: k.request_count ?? 0,
    })),
  })
}
