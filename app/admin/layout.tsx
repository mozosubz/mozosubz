import type React from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { isFallbackAdmin } from '@/lib/utils/hardcoded-admin'
import { AdminSidebar } from '@/components/admin/sidebar'
import { NotificationBell } from '@/components/notification-bell'
import '@/styles/admin.css'
import { notFound } from 'next/navigation'

export const metadata = {
  title: 'Admin Panel - Mozosubz',
  description: 'Admin dashboard for managing users, transactions, and pricing',
}

// Runs before first paint so hidden amounts never flash into view on load.
const PRIVACY_BOOTSTRAP = `try{document.documentElement.dataset.adminPrivacy=localStorage.getItem('adminPrivacyMode')==='true'?'on':'off'}catch(e){}`

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()

  // Use getUser() instead of getSession() - authenticates with Supabase server
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return notFound()
  }

  // Admin access = profiles.is_admin in the database, with the ADMIN_EMAILS
  // list as a fallback (lib/utils/hardcoded-admin.ts).
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin && !isFallbackAdmin(user.email)) {
    return notFound()
  }

  return (
    <div className="admin-container">
      <script dangerouslySetInnerHTML={{ __html: PRIVACY_BOOTSTRAP }} />
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-topbar"><NotificationBell /></div>
        {children}
      </main>
    </div>
  )
}
