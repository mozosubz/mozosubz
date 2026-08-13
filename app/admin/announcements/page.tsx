'use client'

import { useEffect, useState } from 'react'
import { getUsers } from '@/lib/actions/admin'
import { CheckCircle2, Eye, ImageIcon, Megaphone, Search, Send, ShieldCheck, Upload, X } from 'lucide-react'

type User = { id: string; full_name?: string | null; email?: string | null; phone_number?: string | null; username?: string | null; is_admin?: boolean }

const blankMessage = ''

export default function AnnouncementsPage() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState(blankMessage)
  const [imageUrl, setImageUrl] = useState('')
  const [link, setLink] = useState('')
  const [linkEnabled, setLinkEnabled] = useState(false)
  const [audience, setAudience] = useState<'selected' | 'users' | 'admins' | 'all'>('selected')
  const [users, setUsers] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      const response = await getUsers(page, 25, searchTerm)
      if (!cancelled) { setUsers(response.users || []); setTotalPages(response.totalPages || 1); setLoading(false) }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [page, searchTerm])

  async function uploadImage(file: File) {
    setUploading(true); setResult(null)
    const body = new FormData(); body.append('file', file)
    const response = await fetch('/api/notifications/upload', { method: 'POST', body })
    const data = await response.json()
    if (response.ok) setImageUrl(data.url); else setResult(data.error || 'Image upload failed')
    setUploading(false)
  }

  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]) }
  function selectVisible() { setSelected((current) => [...new Set([...current, ...users.map((user) => user.id)])]) }
  function clearSelection() { setSelected([]) }

  async function sendNotification() {
    setSending(true); setResult(null)
    const response = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, message, imageUrl: imageUrl || null, link: linkEnabled && link.trim() ? link.trim() : null, audience, recipientIds: audience === 'selected' ? selected : undefined, dedupeKey: `notification-${Date.now()}` }) })
    const data = await response.json()
    setResult(response.ok ? (data.delivered ? `Delivered to ${data.delivered} recipient${data.delivered === 1 ? '' : 's'}.` : `Already delivered to the selected recipient${data.requested === 1 ? '' : 's'}.`) : data.error || 'Delivery failed.')
    setSending(false)
  }

  const visibleSelected = users.filter((user) => selected.includes(user.id)).length
  return <div className="admin-page">
    <div className="admin-header"><div className="admin-header-row"><div><h1>Notification Studio</h1><p>Compose and deliver targeted in-site notifications.</p></div><span className="admin-badge"><Megaphone size={14} /> Controlled delivery</span></div></div>
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <section className="admin-card min-w-0 space-y-5 p-6">
        <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-[var(--admin-text)]">Compose notification</h2><p className="text-sm text-[var(--admin-text-secondary)]">Nothing is pre-filled. Choose recipients before sending.</p></div><ShieldCheck className="text-[var(--primary)]" size={22} /></div>
        <label className="block text-sm font-semibold text-[var(--admin-text)]">Title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className="admin-input mt-2" placeholder="e.g. Service update" /></label>
        <label className="block text-sm font-semibold text-[var(--admin-text)]">Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={5000} rows={10} className="admin-input mt-2 resize-y" placeholder="Write your notification..." /><span className="mt-1 block text-xs text-[var(--admin-text-muted)]">{message.length}/5000 characters</span></label>
        <div><p className="mb-2 text-sm font-semibold text-[var(--admin-text)]">Image attachment</p><div className="flex items-center gap-3"><label className="admin-btn admin-btn-secondary cursor-pointer"><Upload size={16} />{uploading ? 'Uploading...' : 'Upload from device'}<input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadImage(file) }} /></label>{imageUrl && <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setImageUrl('')}><X size={16} />Remove</button>}</div>{imageUrl && <img src={imageUrl} alt="Selected notification attachment" className="mt-3 max-h-48 w-full rounded-xl object-cover" />}</div>
        <div className="rounded-lg border border-[var(--admin-border)] p-3"><label className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-text)]"><input type="checkbox" checked={linkEnabled} onChange={(event) => setLinkEnabled(event.target.checked)} />Enable optional quick link</label>{linkEnabled && <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="/dashboard/services/data" className="admin-input mt-3" />}</div>
        <div><p className="mb-2 text-sm font-semibold text-[var(--admin-text)]">Audience</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(['selected', 'users', 'admins', 'all'] as const).map((item) => <button type="button" key={item} onClick={() => setAudience(item)} className={`rounded-lg border px-3 py-3 text-sm font-semibold capitalize ${audience === item ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-[var(--admin-border)] text-[var(--admin-text-secondary)]'}`}>{item === 'selected' ? `${selected.length} selected` : item === 'all' ? 'Everyone' : item}</button>)}</div></div>
        <button type="button" onClick={sendNotification} disabled={sending || uploading || !title.trim() || !message.trim() || (audience === 'selected' && selected.length === 0)} className="admin-btn admin-btn-primary w-full justify-center"><Send size={16} />{sending ? 'Delivering...' : 'Send notification'}</button>{result && <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-500"><CheckCircle2 size={16} />{result}</div>}
      </section>
      <section className="space-y-6">
        <div className="admin-card p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><Search size={17} className="text-[var(--primary)]" /><h2 className="font-bold text-[var(--admin-text)]">Select users</h2></div><span className="text-xs text-[var(--admin-text-muted)]">{selected.length} selected</span></div><div className="flex flex-col gap-3 sm:flex-row"><input value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setPage(1) }} placeholder="Search name, email, phone, username, or ID" className="admin-input" /><button type="button" onClick={selectVisible} className="admin-btn admin-btn-secondary whitespace-nowrap">Select visible</button><button type="button" onClick={clearSelection} className="admin-btn admin-btn-secondary">Clear</button></div><div className="mt-3 flex items-center justify-between text-xs text-[var(--admin-text-muted)]"><span>{loading ? 'Loading users...' : `${users.length} users on this page`}</span><span>{visibleSelected} visible selected</span></div><div className="mt-3 max-h-[27rem] space-y-2 overflow-y-auto">{users.map((user) => <label key={user.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--admin-border)] p-3"><input type="checkbox" checked={selected.includes(user.id)} onChange={() => toggle(user.id)} /><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[var(--admin-text)]">{user.full_name || user.username || user.email || user.id}</strong><span className="block truncate text-xs text-[var(--admin-text-muted)]">{user.email || user.phone_number || user.id}{user.is_admin ? ' · Admin' : ''}</span></span></label>)}{!loading && !users.length && <p className="py-5 text-center text-sm text-[var(--admin-text-muted)]">No users found.</p>}</div><div className="mt-4 flex items-center justify-between"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="admin-btn admin-btn-secondary">Previous</button><span className="text-xs text-[var(--admin-text-muted)]">Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="admin-btn admin-btn-secondary">Next</button></div></div>
        <div className="admin-card overflow-hidden"><div className="flex items-center gap-2 border-b border-[var(--admin-border)] p-4"><Eye size={16} className="text-[var(--primary)]" /><h2 className="font-bold text-[var(--admin-text)]">Live preview</h2></div><div className="bg-[var(--admin-bg)] p-5"><div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl">{imageUrl ? <img src={imageUrl} alt="Notification preview" className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center bg-[var(--admin-bg)] text-[var(--admin-text-muted)]"><ImageIcon size={30} /></div>}<div className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-[var(--primary)]">Mozosubz notification</p><h3 className="mt-2 break-words text-lg font-bold text-[var(--admin-text)]">{title || 'Notification title'}</h3><p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-[var(--admin-text-secondary)]">{message || 'Your message will appear here.'}</p></div></div></div></div>
      </section>
    </div>
  </div>
}
