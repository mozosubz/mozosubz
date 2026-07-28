/**
 * Central sort registry for the admin tables.
 *
 * The dropdown options and the server-side `.order()` calls are both derived
 * from these maps, so a label can never drift from the column it sorts by.
 *
 * `column` values are hardcoded here and never taken from user input — the
 * incoming sort key is looked up in this map and anything unrecognised falls
 * back to the default. That keeps the value out of the query string entirely.
 */

export interface SortOption<K extends string> {
  value: K
  label: string
  column: string
  ascending: boolean
  /** Rows with NULL in `column` sort last instead of leading the list. */
  nullsFirst?: boolean
}

export type UserSortKey =
  | 'newest'
  | 'oldest'
  | 'name_asc'
  | 'name_desc'
  | 'balance_desc'
  | 'balance_asc'

export const USER_SORT_OPTIONS: readonly SortOption<UserSortKey>[] = [
  { value: 'newest', label: 'Newest first', column: 'created_at', ascending: false },
  { value: 'oldest', label: 'Oldest first', column: 'created_at', ascending: true },
  { value: 'name_asc', label: 'Name (A–Z)', column: 'full_name', ascending: true },
  { value: 'name_desc', label: 'Name (Z–A)', column: 'full_name', ascending: false },
  { value: 'balance_desc', label: 'Balance (high to low)', column: 'wallet_balance', ascending: false },
  { value: 'balance_asc', label: 'Balance (low to high)', column: 'wallet_balance', ascending: true },
] as const

export const DEFAULT_USER_SORT: UserSortKey = 'newest'

export type TransactionSortKey =
  | 'newest'
  | 'oldest'
  | 'amount_desc'
  | 'amount_asc'

export const TRANSACTION_SORT_OPTIONS: readonly SortOption<TransactionSortKey>[] = [
  { value: 'newest', label: 'Newest first', column: 'created_at', ascending: false },
  { value: 'oldest', label: 'Oldest first', column: 'created_at', ascending: true },
  { value: 'amount_desc', label: 'Amount (high to low)', column: 'amount', ascending: false },
  { value: 'amount_asc', label: 'Amount (low to high)', column: 'amount', ascending: true },
] as const

export const DEFAULT_TRANSACTION_SORT: TransactionSortKey = 'newest'

/**
 * Resolve an untrusted sort key to a known-safe column/direction pair.
 * Unrecognised keys resolve to the supplied default rather than throwing, so a
 * stale bookmark or hand-edited value degrades to the normal view.
 */
export function resolveSort<K extends string>(
  options: readonly SortOption<K>[],
  key: string | undefined,
  fallback: K
): SortOption<K> {
  return (
    options.find((option) => option.value === key) ??
    options.find((option) => option.value === fallback) ??
    options[0]
  )
}
