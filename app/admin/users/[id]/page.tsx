import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { UserDetailsCard } from '@/components/admin/user-details-card'
import { UserTransactionsCard } from '@/components/admin/user-transactions-card'
import { ArrowLeft, User } from 'lucide-react'

// Columns actually rendered by UserDetailsCard. Selecting only these instead
// of `*` avoids pulling every profile column (and any large/unused ones)
// over the wire, which matters most on slow connections.
const PROFILE_COLUMNS =
  'id, full_name, email, phone_number, username, wallet_balance, is_admin, date_of_birth, bvn, monnify_account_number, monnify_account_name, monnify_bank_name, created_at'

// Columns actually rendered by UserTransactionsCard.
const TRANSACTION_COLUMNS =
  'id, category, service_name, phone, amount, status, created_at'

export default async function UserDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // The parent admin layout already verified the caller is an admin, so we
  // can safely use the admin (service-role) client here. This is what makes
  // the query fast: the normal RLS-bound client re-checks `is_admin` via a
  // subquery on every row-level policy evaluation, while the service-role
  // client skips RLS entirely. Running both queries in parallel (instead of
  // one after another) removes a second full network round trip, which is
  // the difference that matters most on slow/2G connections.
  const supabase = createAdminClient()

  const [{ data: user, error }, { data: transactions }] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).single(),
    supabase
      .from('transactions')
      .select(TRANSACTION_COLUMNS)
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (error || !user) {
    notFound()
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <Link
          href="/admin/users"
          className="btn btn-ghost btn-icon"
          style={{ marginBottom: 12, alignSelf: 'flex-start' }}
        >
          <ArrowLeft size={16} />
          <span>Back to users</span>
        </Link>
        <div>
          <h1 className="admin-page-title">
            <User
              size={22}
              style={{ display: 'inline', marginRight: 10, verticalAlign: '-3px' }}
            />
            {user.full_name || 'User profile'}
          </h1>
          <p className="admin-page-subtitle" style={{ wordBreak: 'break-all' }}>
            {user.email}
          </p>
        </div>
      </div>

      <div className="grid-2col" style={{ gap: 20 }}>
        <UserDetailsCard user={user} />
        <UserTransactionsCard transactions={transactions || []} />
      </div>
    </div>
  )
}
