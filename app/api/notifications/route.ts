import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ notifications: [] }, { status: 401 })

  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, message, type, link, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: 'Unable to load notifications' }, { status: 500 })
  return NextResponse.json({ notifications: data ?? [] })
}

export async function PATCH() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  if (error) return NextResponse.json({ error: 'Unable to update notifications' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
