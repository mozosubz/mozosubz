'use client'

import { useMemo, useState } from 'react'
import { ImageIcon, Send, Users, ShieldCheck, Eye, Megaphone, CheckCircle2 } from 'lucide-react'

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

export default function AnnouncementsPage() {
  const [title, setTitle] = useState(defaultTitle)
  const [message, setMessage] = useState(defaultMessage)
  const [imageUrl, setImageUrl] = useState(announcementImage)
  const [link, setLink] = useState('/dashboard/services/data')
  const [audience, setAudience] = useState<'all' | 'users' | 'admins'>('all')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const characters = useMemo(() => message.length, [message])

  async function sendAnnouncement() {
    setSending(true)
    setResult(null)
    const response = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, message, imageUrl, link, audience, dedupeKey: `mtn-awoof-update-${new Date().toISOString().slice(0, 10)}` }) })
    const data = await response.json()
    setResult(response.ok ? `Delivered to ${data.delivered} accounts.` : data.error || 'Delivery failed.')
    setSending(false)
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-row"><div><h1>Announcement Studio</h1><p>Compose, preview, and broadcast rich in-site notifications.</p></div><div className="admin-header-actions"><span className="admin-badge"><Megaphone size={14} /> Broadcast center</span></div></div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="admin-card p-6 space-y-5">
          <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-[var(--admin-text)]">Create announcement</h2><p className="text-sm text-[var(--admin-text-secondary)]">The same message and image will be shown to the selected audience.</p></div><ShieldCheck className="text-[var(--primary)]" size={22} /></div>
          <label className="block text-sm font-semibold text-[var(--admin-text)]">Headline<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="admin-input mt-2" /></label>
          <label className="block text-sm font-semibold text-[var(--admin-text)]">Message<textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={5000} rows={12} className="admin-input mt-2 resize-y" /><span className="mt-1 block text-xs text-[var(--admin-text-muted)]">{characters}/5000 characters</span></label>
          <label className="block text-sm font-semibold text-[var(--admin-text)]">Image URL<input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="admin-input mt-2" /></label>
          <label className="block text-sm font-semibold text-[var(--admin-text)]">Action link<input value={link} onChange={(e) => setLink(e.target.value)} className="admin-input mt-2" /></label>
          <div><p className="mb-2 text-sm font-semibold text-[var(--admin-text)]">Audience</p><div className="grid grid-cols-3 gap-2">{(['all', 'users', 'admins'] as const).map((item) => <button key={item} onClick={() => setAudience(item)} className={`rounded-lg border px-3 py-3 text-sm font-semibold capitalize ${audience === item ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-[var(--admin-border)] text-[var(--admin-text-secondary)]'}`}><Users size={16} className="mx-auto mb-1" />{item}</button>)}</div></div>
          <button onClick={sendAnnouncement} disabled={sending || !title.trim() || !message.trim()} className="admin-btn admin-btn-primary w-full justify-center"><Send size={16} />{sending ? 'Delivering...' : 'Broadcast announcement'}</button>
          {result && <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-500"><CheckCircle2 size={16} />{result}</div>}
        </section>
        <section className="space-y-6">
          <div className="admin-card overflow-hidden"><div className="flex items-center gap-2 border-b border-[var(--admin-border)] p-4"><Eye size={16} className="text-[var(--primary)]" /><h2 className="font-bold text-[var(--admin-text)]">Live preview</h2></div><div className="bg-[var(--admin-bg)] p-5"><div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"><img src={imageUrl || announcementImage} alt="Announcement preview" className="aspect-[4/3] w-full object-cover" /><div className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-[var(--primary)]">Mozosubz announcement</p><h3 className="mt-2 text-lg font-bold text-[var(--admin-text)]">{title || 'Announcement title'}</h3><p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--admin-text-secondary)]">{message || 'Your announcement message will appear here.'}</p></div></div></div></div>
          <div className="admin-card p-5"><div className="flex items-start gap-3"><ImageIcon className="mt-0.5 text-[var(--primary)]" size={20} /><div><h3 className="font-bold text-[var(--admin-text)]">Rich notification support</h3><p className="mt-1 text-sm leading-6 text-[var(--admin-text-secondary)]">Images, deep links, audience targeting, duplicate protection, character limits, and delivery feedback are all handled in one place.</p></div></div></div>
        </section>
      </div>
    </div>
  )
}
