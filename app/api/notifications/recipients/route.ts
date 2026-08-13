import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isHardcodedAdmin } from '@/lib/utils/hardcoded-admin'

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || (!isHardcodedAdmin(user.email) && !(await supabase.from('profiles').select('is_admin').eq('id', user.id).single()).data?.is_admin)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim() || ''
  const transactionId = url.searchParams.get('transactionId')?.trim() || ''
  const admin = createAdminClient()
  let ids: string[] = []
  if (transactionId) {
    const { data } = await admin.from('transactions').select('user_id').or(`id.eq.${transactionId},transaction_id.eq.${transactionId}`).limit(1).maybeSingle()
    if (data?.user_id) ids = [data.user_id]
  }
  const { data: profiles } = await admin.from('profiles').select('id,email,full_name,phone,is_admin').order('created_at', { ascending: false }).limit(1000)
  const normalized = q.toLowerCase()
  const rows = (profiles ?? []).filter((p) => (!ids.length || ids.includes(p.id)) && (!q || [p.id, p.email, p.full_name, p.phone].some((value) => String(value || '').toLowerCase().includes(normalized)))).slice(0, 100).map((p) => ({ id: p.id, email: p.email, name: p.full_name, phone: p.phone, isAdmin: p.is_admin }))
  return NextResponse.json({ recipients: rows, transactionUserId: ids[0] || null })
}
