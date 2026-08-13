import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isHardcodedAdmin } from '@/lib/utils/hardcoded-admin'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ notifications: [] }, { status: 401 })

  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, message, type, link, image_url, audience, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: 'Unable to load notifications' }, { status: 500 })
  return NextResponse.json({ notifications: data ?? [] })
}

export async function PATCH() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
  if (error) return NextResponse.json({ error: 'Unable to update notifications' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || (!isHardcodedAdmin(user.email) && !(await supabase.from('profiles').select('is_admin').eq('id', user.id).single()).data?.is_admin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const title = String(body.title || '').trim()
  const message = String(body.message || '').trim()
  const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null
  const link = body.link ? String(body.link).trim() : null
  const dedupeKey = body.dedupeKey ? String(body.dedupeKey).trim() : `announcement:${Date.now()}`
  if (!title || !message || title.length > 120 || message.length > 5000) return NextResponse.json({ error: 'Title and message are required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (usersError) return NextResponse.json({ error: 'Unable to load audience' }, { status: 500 })
  const userIds = users.users.map((item) => item.id)
  const { data: admins } = await admin.from('profiles').select('id').eq('is_admin', true)
  const adminIds = (admins ?? []).map((item) => item.id)
  const audience = body.audience === 'admins' || body.audience === 'users' ? body.audience : 'all'
  const requestedIds = Array.isArray(body.recipientIds) ? body.recipientIds.map((id: unknown) => String(id)).filter(Boolean) : []
  const ids = requestedIds.length > 0
    ? [...new Set(requestedIds.filter((id: string) => userIds.includes(id)))]
    : audience === 'admins' ? adminIds : audience === 'users' ? userIds : [...new Set([...userIds, ...adminIds])]
  if (requestedIds.length > 0 && ids.length === 0) return NextResponse.json({ error: 'No valid recipients selected' }, { status: 400 })
  const rows = ids.map((userId) => ({ user_id: userId, title, message, image_url: imageUrl, link, audience: adminIds.includes(userId) ? 'admin' : 'user', type: 'announcement', dedupe_key: `${dedupeKey}:${userId}` }))
  let delivered = 0
  for (const row of rows) {
    const { data: existing } = await admin.from('notifications').select('id').eq('user_id', row.user_id).eq('dedupe_key', row.dedupe_key).maybeSingle()
    if (existing) continue
    const { error } = await admin.from('notifications').insert(row)
    if (error) {
      console.error('[v0] notification delivery failed', { userId: row.user_id, code: error.code, message: error.message })
      return NextResponse.json({ error: `Unable to deliver announcement: ${error.message}` }, { status: 500 })
    }
    delivered += 1
  }
  return NextResponse.json({ ok: true, delivered, requested: rows.length })
}
