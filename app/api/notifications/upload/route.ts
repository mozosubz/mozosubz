import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isHardcodedAdmin } from '@/lib/utils/hardcoded-admin'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin && !isHardcodedAdmin(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an image file' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Only image files are supported' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Image must be 5MB or smaller' }, { status: 400 })

  const blob = await put(`notifications/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`, file, { access: 'public' })
  return NextResponse.json({ url: blob.url })
}
