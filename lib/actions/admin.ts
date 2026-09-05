'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isValidUUID, isValidAmount, validateBalanceCalculation } from '@/lib/utils/input-validation'
import {
  resolveSort,
  USER_SORT_OPTIONS,
  DEFAULT_USER_SORT,
  TRANSACTION_SORT_OPTIONS,
  DEFAULT_TRANSACTION_SORT,
} from '@/lib/utils/admin-sort'

// SECURITY: every function below reads or writes through the service-role
// client, which bypasses RLS entirely. Next.js Server Actions are exposed as
// directly callable POST endpoints regardless of which page imports them, so
// without this check any authenticated (non-admin) user could invoke these
// actions straight from a crafted request and read every user's PII/wallet
// balance/transaction history, or mutate wallets and admin roles. Every
// exported function in this file MUST call requireAdmin() first.
async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'Not authenticated' }
  }

  const adminSupabase = createAdminClient()
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return { ok: false, error: 'Admin access required' }
  }

  return { ok: true, userId: user.id }
}

// Get all users with pagination, search and sorting - uses admin client to bypass RLS
export async function getUsers(
  page: number = 1,
  limit: number = 10,
  searchTerm?: string,
  sortBy?: string
) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return { users: [], count: 0, error: guard.error, totalPages: 0 }
  }

  try {
    const supabase = createAdminClient()

    const offset = (page - 1) * limit

    let query = supabase
      .from('profiles')
      .select('id, full_name, email, phone_number, username, wallet_balance, is_admin, created_at')

    // Add search filters only if searchTerm exists and is not empty after trimming
    const trimmedSearch = searchTerm?.trim()
    if (trimmedSearch && trimmedSearch.length > 0) {
      const lowerSearchTerm = trimmedSearch.toLowerCase()
      // UUID regex — when the term matches, do an exact eq on id instead of
      // ilike (which Postgres rejects on uuid columns).
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (UUID_RE.test(trimmedSearch)) {
        query = query.eq('id', trimmedSearch)
      } else {
        query = query.or(
          `username.ilike.%${lowerSearchTerm}%,full_name.ilike.%${lowerSearchTerm}%,email.ilike.%${lowerSearchTerm}%,phone_number.ilike.%${trimmedSearch}%`
        )
      }
    }

    // Sort column/direction come from a fixed allowlist, never from the raw
    // input, so `sortBy` can't be used to probe unexposed columns.
    const sort = resolveSort(USER_SORT_OPTIONS, sortBy, DEFAULT_USER_SORT)

    const { data: users, error: usersError } = await query
      .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
      // Stable tiebreaker. full_name and wallet_balance are non-unique, and
      // without a deterministic second key Postgres may order ties differently
      // between page requests — which silently duplicates rows on one page and
      // drops them from another.
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1)

    // Get total count for pagination
    let countQuery = supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })

    if (trimmedSearch && trimmedSearch.length > 0) {
      const lowerSearchTerm = trimmedSearch.toLowerCase()
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (UUID_RE.test(trimmedSearch)) {
        countQuery = countQuery.eq('id', trimmedSearch)
      } else {
        countQuery = countQuery.or(
          `username.ilike.%${lowerSearchTerm}%,full_name.ilike.%${lowerSearchTerm}%,email.ilike.%${lowerSearchTerm}%,phone_number.ilike.%${trimmedSearch}%`
        )
      }
    }

    const { count, error: countError } = await countQuery

    if (usersError) {
      console.error('[v0] Error fetching users:', usersError)
      return { users: [], count: 0, error: usersError.message, totalPages: 0 }
    }

    const totalPages = Math.ceil((count || 0) / limit)

    console.log('[v0] getUsers - Real data:', { totalCount: count, usersReturned: users?.length, page, totalPages, searchTerm: trimmedSearch })

    return { users: users || [], count: count || 0, error: null, totalPages }
  } catch (err) {
    console.error('[v0] getUsers exception:', err)
    return { users: [], count: 0, error: 'Failed to fetch users', totalPages: 0 }
  }
}

// Get user details
export async function getUserDetails(userId: string) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return { user: null, transactions: [], error: guard.error }
  }

  const supabase = createAdminClient()

  const { data: user, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    return { user: null, transactions: [], error: error.message }
  }

  // Get user transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  return { user, transactions: transactions || [], error: null }
}

// Credit user wallet
export async function creditUserWallet(userId: string, amount: number, reason: string) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return { error: guard.error }
  }

  // SECURITY: Validate all inputs to prevent injection
  if (!isValidUUID(userId)) {
    return { error: 'Invalid user ID format' }
  }

  // Amount must be positive (not zero) for transactions
  if (typeof amount !== 'number' || amount <= 0 || isNaN(amount)) {
    return { error: 'Invalid amount' }
  }

  const adminUserId = guard.userId

  // Get current wallet balance - use admin client for profile read
  const adminSupabase = createAdminClient()
  const { data: userProfile, error: profileError } = await adminSupabase
    .from('profiles')
    .select('wallet_balance')
    .eq('id', userId)
    .single()

  if (profileError) {
    return { error: 'User not found' }
  }

  const balanceBefore = userProfile.wallet_balance || 0
  
  // SECURITY: Use validated balance calculation to prevent injection
  let newBalance: number
  try {
    newBalance = validateBalanceCalculation(balanceBefore, amount, 'ADD')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid balance calculation' }
  }

  // Update wallet - use admin client for profile update
  const { error: updateError } = await adminSupabase
    .from('profiles')
    .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Log transaction - create EXACT same transaction record as Monnify deposit
  // Use admin client to bypass RLS
  const { error: txError } = await adminSupabase.from('transactions').insert({
    user_id: userId,
    transaction_id: `ADMIN_${Date.now()}`,
    category: 'WALLET_FUND',
    service_id: 'admin_credit',
    service_name: 'Admin Credit',
    amount,
    phone: '',
    status: 'SUCCESS',
    description: reason || 'Wallet funded via admin credit',
    balance_before: balanceBefore,
    balance_after: newBalance,
    api_response: JSON.stringify({ admin_id: adminUserId }),
    created_at: new Date().toISOString(),
    payment_method: 'ADMIN',
  })

  revalidatePath('/admin/users')
  revalidatePath('/admin/transactions')
  
  return { success: true, newBalance }
}

// Debit user wallet - only updates balance and logs, does NOT create transaction receipt
export async function debitUserWallet(userId: string, amount: number, reason: string) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return { error: guard.error }
  }

  // SECURITY: Validate all inputs to prevent injection
  if (!isValidUUID(userId)) {
    return { error: 'Invalid user ID format' }
  }

  // Amount must be positive (not zero) for transactions
  if (typeof amount !== 'number' || amount <= 0 || isNaN(amount)) {
    return { error: 'Invalid amount' }
  }

  // Get current wallet balance - use admin client for profile read
  const adminSupabase = createAdminClient()
  const { data: userProfile, error: profileError } = await adminSupabase
    .from('profiles')
    .select('wallet_balance')
    .eq('id', userId)
    .single()

  if (profileError) {
    return { error: 'User not found' }
  }

  const balanceBefore = userProfile.wallet_balance || 0
  
  // SECURITY: Use validated balance calculation to prevent injection and ensure funds available
  let newBalance: number
  try {
    newBalance = validateBalanceCalculation(balanceBefore, amount, 'SUBTRACT')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid balance calculation' }
  }

  // Update wallet - use admin client for profile update
  const { error: updateError } = await adminSupabase
    .from('profiles')
    .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (updateError) {
    console.error('[v0] Error updating wallet:', updateError)
    return { error: updateError.message }
  }

  revalidatePath('/admin/users')
  revalidatePath('/admin/transactions')
  return { success: true, newBalance }
}

// Toggle admin role
export async function toggleAdminRole(userId: string, isAdmin: boolean) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return { error: guard.error }
  }

  // SECURITY: Validate user ID format to prevent injection
  if (!isValidUUID(userId)) {
    return { error: 'Invalid user ID format' }
  }

  const adminUserId = guard.userId

  // Use admin client for profile update to bypass RLS
  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase.from('profiles').update({ is_admin: isAdmin }).eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  // Log action
  await adminSupabase.from('admin_logs').insert({
    admin_id: adminUserId,
    action: 'TOGGLE_ADMIN',
    target_user: userId,
    details: { isAdmin },
  })

  revalidatePath('/admin/users')
  return { success: true }
}

// Get all transactions with pagination - uses admin client to bypass RLS
export async function getTransactions(
  page: number = 1,
  limit: number = 20,
  statusFilter?: string,
  sortBy?: string,
  userId?: string
) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return { transactions: [], count: 0, error: guard.error, totalPages: 0 }
  }

  try {
    const supabase = createAdminClient()

    const offset = (page - 1) * limit

    // Step 1: fetch transactions (no FK join — transactions.user_id has no
    // formal FK constraint so PostgREST can't auto-resolve the relationship).
    let query = supabase
      .from('transactions')
      .select('*')

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    if (userId && userId.trim()) {
      query = query.eq('user_id', userId.trim())
    }

    const sort = resolveSort(TRANSACTION_SORT_OPTIONS, sortBy, DEFAULT_TRANSACTION_SORT)

    const { data: rawTransactions, error: txError } = await query
      .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1)

    // Count query with the same filters
    let countQuery = supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })

    if (statusFilter && statusFilter !== 'all') {
      countQuery = countQuery.eq('status', statusFilter)
    }

    if (userId && userId.trim()) {
      countQuery = countQuery.eq('user_id', userId.trim())
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('[v0] Error counting transactions:', countError)
    }

    if (txError) {
      console.error('[v0] Error fetching transactions:', txError)
      return { transactions: [], count: 0, error: txError.message, totalPages: 0 }
    }

    // Step 2: collect unique user IDs from this page, then fetch their
    // profiles in a single query and build a lookup map.
    const rows = rawTransactions || []
    const userIds = [...new Set(rows.map((tx: any) => tx.user_id).filter(Boolean))]

    let profileMap: Record<string, { full_name: string | null; email: string | null }> = {}

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)

      if (profiles) {
        for (const p of profiles) {
          profileMap[p.id] = { full_name: p.full_name ?? null, email: p.email ?? null }
        }
      }
    }

    const transactions = rows.map((tx: any) => ({
      ...tx,
      user_full_name: profileMap[tx.user_id]?.full_name ?? null,
      user_email: profileMap[tx.user_id]?.email ?? null,
    }))

    const totalPages = Math.ceil((count || 0) / limit)

    console.log('[v0] getTransactions - Real data:', { totalCount: count, txReturned: transactions.length, page, totalPages })

    return { transactions, count: count || 0, error: null, totalPages }
  } catch (err) {
    console.error('[v0] getTransactions exception:', err)
    return { transactions: [], count: 0, error: 'Failed to fetch transactions', totalPages: 0 }
  }
}

// Get transaction details
export async function getTransactionDetails(transactionId: string) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return { transaction: null, error: guard.error }
  }

  const supabase = createAdminClient()

  const { data: transaction, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single()

  if (error) {
    return { transaction: null, error: error.message }
  }

  return { transaction, error: null }
}

// Create pricing rule
export async function createPricingRule(
  network: string,
  serviceType: string,
  ruleType: 'FIXED' | 'PERCENT',
  value: number,
  minAmount?: number,
  maxAmount?: number
) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return { error: guard.error }
  }

  const adminUserId = guard.userId
  const supabase = createAdminClient()

  const { data, error } = await supabase.from('pricing_rules').insert({
    network,
    service_type: serviceType,
    rule_type: ruleType,
    value,
    min_amount: minAmount,
    max_amount: maxAmount,
    is_active: true,
  })

  if (error) {
    return { error: error.message }
  }

  // Log action
  await supabase.from('admin_logs').insert({
    admin_id: adminUserId,
    action: 'CREATE_PRICING_RULE',
    details: { network, serviceType, ruleType, value },
  })

  revalidatePath('/admin/pricing')
  return { success: true, data }
}

// Update pricing rule
export async function updatePricingRule(
  ruleId: string,
  updates: Record<string, any>
) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return { error: guard.error }
  }

  const adminUserId = guard.userId
  const supabase = createAdminClient()

  const { error } = await supabase.from('pricing_rules').update(updates).eq('id', ruleId)

  if (error) {
    return { error: error.message }
  }

  // Log action
  await supabase.from('admin_logs').insert({
    admin_id: adminUserId,
    action: 'UPDATE_PRICING_RULE',
    details: { ruleId, updates },
  })

  revalidatePath('/admin/pricing')
  return { success: true }
}

// Get all admin logs
export async function getAdminLogs(page: number = 1, limit: number = 50) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return { logs: [], count: 0, error: guard.error, totalPages: 0 }
  }

  const supabase = createAdminClient()

  const offset = (page - 1) * limit

  const [{ data: logs, error }, { count }] = await Promise.all([
    supabase
      .from('admin_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    supabase.from('admin_logs').select('id', { count: 'exact' }).then((res) => ({ count: res.count || 0 })),
  ])

  if (error) {
    return { logs: [], count: 0, error: error.message }
  }

  return { logs, count, totalPages: Math.ceil(count / limit) }
}
