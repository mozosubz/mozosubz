'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Eye, ImageIcon, Megaphone, Search, Send, ShieldCheck, Users } from 'lucide-react'

const announcementImage = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG-20260813-WA0002-HOY2h9gjoDaWYWjBtiyHXiKw6fDArC.jpg'
const defaultTitle = 'ANNOUNCEMENT: MTN AWOOF PLANS'
const defaultMessage = `MTN has updated the prices and validity periods of all Awoof data plans.

Please take note of the new changes before placing your next order.

Updated Awoof Plans:
• 1GB — ₦249.74 — 30 Days
• 2GB — ₦520 — 30 Days
• 3GB — ₦800 — 30 Days
• 5GB — ₦1,245 — 30 Days

Purchase your data on Mozosubz.

Thank you for your understanding and continued patronage.`

type Recipient = { id: string; email?: string; name?: string; phone?: string; isAdmin?: boolean }

export default function AnnouncementsPage() {
  const [title, setTitle] = useState(defaultTitle), [message, setMessage] = useState(defaultMessage)
  const [imageUrl, setImageUrl] = useState(announcementImage), [link, setLink] = useState('')
  const [linkEnabled, setLinkEnabled] = useState(false)
  const [audience, setAudience] = useState<'all' | 'users' | 'admins' | 'selected'>('selected')
  const [query, setQuery] = useState(''), [transactionId, setTransactionId] = useState(''), [recipients, setRecipients] = useState<Recipient[]>([])
  const [selected, setSelected] = useState<string[]>([]), [loading, setLoading] = useState(false), [sending, setSending] = useState(false), [result, setResult] = useState<string | null>(null)
  const characters = useMemo(() => message.length, [message])
  const displayMessage = message.replace(/\\n/g, '\n')

  async function searchRecipients() {
    setLoading(true)
    const params = new URLSearchParams(); if (query) params.set('q', query); if (transactionId) params.set('transactionId', transactionId)
    const response = await fetch(`/api/notifications/recipients?${params}`); const data = await response.json()
    setRecipients(data.recipients || []); if (data.transactionUserId) { setAudience('selected'); setSelected([data.transactionUserId]) }; setLoading(false)
  }
  useEffect(() => { const timer = setTimeout(() => { if (query.length > 1) searchRecipients() }, 350); return () => clearTimeout(timer) }, [query])
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }
  async function sendAnnouncement() {
    setSending(true); setResult(null)
    const response = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, message: displayMessage, imageUrl, link: linkEnabled && link.trim() ? link.trim() : null, audience, recipientIds: audience === 'selected' ? selected : undefined, dedupeKey: `announcement-${Date.now()}` }) })
    const data = await response.json(); setResult(response.ok ? `Delivered to ${data.delivered} selected recipient${data.delivered === 1 ? '' : 's'}.` : data.error || 'Delivery failed.'); setSending(false)
  }

  return <div className="admin-page"><div className="admin-header"><div className="admin-header-row"><div><h1>Announcement Studio</h1><p>Target the right people before you send.</p></div><span className="admin-badge"><Megaphone size={14} /> Controlled delivery</span></div></div>
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="admin-card space-y-5 p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-[var(--admin-text)]">Compose notification</h2><p className="text-sm text-[var(--admin-text-secondary)]">No broadcast happens unless you explicitly choose an audience.</p></div><ShieldCheck className="text-[var(--primary)]" size={22} /></div>
        <label className="block text-sm font-semibold text-[var(--admin-text)]">Headline<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="admin-input mt-2" /></label>
        <label className="block text-sm font-semibold text-[var(--admin-text)]">Message<textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={5000} rows={11} className="admin-input mt-2 resize-y" /><span className="mt-1 block text-xs text-[var(--admin-text-muted)]">{characters}/5000 characters</span></label>
        <label className="block text-sm font-semibold text-[var(--admin-text)]">Image URL<input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="admin-input mt-2" /></label>
        <div className="rounded-lg border border-[var(--admin-border)] p-3"><label className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-text)]"><input type="checkbox" checked={linkEnabled} onChange={(e) => setLinkEnabled(e.target.checked)} />Enable quick link for this notification</label>{linkEnabled && <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/dashboard/services/data" className="admin-input mt-3" />}</div>
        <div><p className="mb-2 text-sm font-semibold text-[var(--admin-text)]">Audience</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(['selected', 'users', 'admins', 'all'] as const).map((item) => <button key={item} onClick={() => setAudience(item)} className={`rounded-lg border px-3 py-3 text-sm font-semibold capitalize ${audience === item ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-[var(--admin-border)] text-[var(--admin-text-secondary)]'}`}><Users size={16} className="mx-auto mb-1" />{item === 'selected' ? 'Selected' : item === 'all' ? 'Everyone' : item}</button>)}</div></div>
        <button onClick={sendAnnouncement} disabled={sending || !title.trim() || !message.trim() || (audience === 'selected' && selected.length === 0)} className="admin-btn admin-btn-primary w-full justify-center"><Send size={16} />{sending ? 'Delivering...' : 'Send notification'}</button>{result && <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-500"><CheckCircle2 size={16} />{result}</div>}
      </section>
      <section className="space-y-6"><div className="admin-card p-5"><div className="mb-4 flex items-center gap-2"><Search size={17} className="text-[var(--primary)]" /><h2 className="font-bold text-[var(--admin-text)]">Find recipients</h2></div><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user ID, email, name, phone" className="admin-input" /><input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Transaction ID" className="admin-input" /><button onClick={searchRecipients} className="admin-btn admin-btn-secondary">{loading ? 'Searching...' : 'Search'}</button></div><div className="mt-4 flex items-center justify-between text-xs text-[var(--admin-text-muted)]"><span>{selected.length} selected</span><button onClick={() => setSelected(recipients.map((r) => r.id))} className="font-semibold text-[var(--primary)]">Select visible</button></div><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{recipients.map((recipient) => <label key={recipient.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--admin-border)] p-3"><input type="checkbox" checked={selected.includes(recipient.id)} onChange={() => toggle(recipient.id)} /><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[var(--admin-text)]">{recipient.name || recipient.email || recipient.id}</strong><span className="block truncate text-xs text-[var(--admin-text-muted)]">{recipient.email || recipient.id}{recipient.isAdmin ? ' · Admin' : ''}</span></span></label>)}{!recipients.length && <p className="py-5 text-center text-sm text-[var(--admin-text-muted)]">Search for a user or transaction owner.</p>}</div></div>
        <div className="admin-card overflow-hidden"><div className="flex items-center gap-2 border-b border-[var(--admin-border)] p-4"><Eye size={16} className="text-[var(--primary)]" /><h2 className="font-bold text-[var(--admin-text)]">Live preview</h2></div><div className="bg-[var(--admin-bg)] p-5"><div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"><img src={imageUrl || announcementImage} alt="Announcement preview" className="aspect-[4/3] w-full object-cover" /><div className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-[var(--primary)]">Mozosubz announcement</p><h3 className="mt-2 text-lg font-bold text-[var(--admin-text)]">{title || 'Announcement title'}</h3><p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-[var(--admin-text-secondary)]">{displayMessage || 'Your announcement message will appear here.'}</p></div></div></div></div><div className="admin-card p-5"><div className="flex items-start gap-3"><ImageIcon className="mt-0.5 text-[var(--primary)]" size={20} /><p className="text-sm leading-6 text-[var(--admin-text-secondary)]">Transaction ID targeting resolves the owner automatically and sends only to that user. Admins and everyone are explicit audience choices.</p></div></div></section>
    </div></div>
}
