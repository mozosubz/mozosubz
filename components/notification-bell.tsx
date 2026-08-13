'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, ExternalLink } from 'lucide-react'

type Notification = {
  id: string
  title: string
  message: string
  type: string
  link: string | null
  image_url: string | null
  read_at: string | null
  created_at: string
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
    const interval = window.setInterval(loadNotifications, 30000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (panelRef.current && buttonRef.current && !panelRef.current.contains(target) && !buttonRef.current.contains(target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const unreadCount = notifications.filter((notification) => !notification.read_at).length
  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH' })
    setNotifications((current) => current.map((notification) => ({ ...notification, read_at: new Date().toISOString() })))
  }

  const formatMessage = (value: string) => value.replace(/\\n/g, '\n')

  return (
    <div className="relative">
      <button ref={buttonRef} onClick={() => setIsOpen(!isOpen)} className="notif-btn" aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}>
        <Bell style={{ width: 18, height: 18, color: '#475569' }} />
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 h-4 rounded-full bg-[var(--primary)] px-1 text-[10px] leading-4 text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <div ref={panelRef} className="absolute top-full right-0 mt-2 w-[340px] max-w-[calc(100vw-2rem)] bg-white rounded-[16px] border border-[rgba(0,0,0,0.08)] shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
            <span className="text-sm font-bold text-[var(--text-1)]">Notifications</span>
            {unreadCount > 0 && <button onClick={markAllRead} className="text-xs font-semibold text-[var(--primary)]">Mark all read</button>}
          </div>
          {loading && notifications.length === 0 ? <div className="py-8 text-center text-sm text-[var(--text-3)]">Loading notifications...</div> : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4"><BellOff style={{ width: 32, height: 32, color: '#cbd5e1' }} className="mb-3" /><p className="text-sm text-[var(--text-3)]">No notifications yet</p></div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {notifications.map((notification) => {
                const content = <>
                  {notification.image_url && <a href={notification.image_url} target="_blank" rel="noreferrer" onClick={() => !notification.read_at && markAllRead()}><img src={notification.image_url} alt="Notification attachment" className="mb-3 h-36 w-full rounded-lg object-cover" /></a>}
                  <div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-[var(--text-1)]">{notification.title}</p>{notification.link && <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />}</div>
                  <p className="mt-1 whitespace-pre-line break-words text-xs leading-5 text-[var(--text-3)]">{formatMessage(notification.message)}</p>
                  <time className="mt-2 block text-[10px] text-slate-400">{new Date(notification.created_at).toLocaleString()}</time>
                </>
                return notification.link ? <a key={notification.id} href={notification.link} onClick={() => !notification.read_at && markAllRead()} className={`block px-4 py-4 border-b border-[rgba(0,0,0,0.06)] hover:bg-slate-50 ${!notification.read_at ? 'bg-blue-50/50' : ''}`}>{content}</a> : <div key={notification.id} onClick={() => !notification.read_at && markAllRead()} className={`block px-4 py-4 border-b border-[rgba(0,0,0,0.06)] ${!notification.read_at ? 'bg-blue-50/50' : ''}`}>{content}</div>
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
