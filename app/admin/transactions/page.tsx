'use client'

import { useState, useEffect } from 'react'
import { getTransactions } from '@/lib/actions/admin'
import { TransactionTable } from '@/components/admin/transaction-table'
import { CreditCard, ChevronLeft, ChevronRight, ArrowUpDown, Search } from 'lucide-react'
import {
  TRANSACTION_SORT_OPTIONS,
  DEFAULT_TRANSACTION_SORT,
  type TransactionSortKey,
} from '@/lib/utils/admin-sort'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FAILED', label: 'Failed' },
]

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<TransactionSortKey>(DEFAULT_TRANSACTION_SORT)
  const [totalPages, setTotalPages] = useState(1)
  const [userIdSearch, setUserIdSearch] = useState('')
  const [debouncedUserId, setDebouncedUserId] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUserId(userIdSearch), 400)
    return () => clearTimeout(timer)
  }, [userIdSearch])

  useEffect(() => {
    // Discard a stale in-flight response so rapid filter/sort switching can't
    // leave the table showing the results of an older query.
    let cancelled = false

    const fetchTransactions = async () => {
      setLoading(true)
      const result = await getTransactions(page, 20, statusFilter || undefined, sortBy, debouncedUserId || undefined)
      if (cancelled) return
      if (!result.error) {
        setTransactions(result.transactions)
        setTotalPages(result.totalPages)
      }
      setLoading(false)
    }
    fetchTransactions()

    return () => {
      cancelled = true
    }
  }, [page, statusFilter, sortBy, debouncedUserId])

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-row">
          <div>
            <h1>Transactions</h1>
            <p>View and manage all platform transactions</p>
          </div>
        </div>
      </div>

      <div className="filter-chips">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            className={`filter-chip ${statusFilter === f.value ? 'active' : ''}`}
            onClick={() => {
              setStatusFilter(f.value)
              setPage(1)
            }}
            type="button"
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Kept outside .filter-chips, which scrolls horizontally — a select in
          that track would slide out of view on narrow screens. */}
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Filter by User ID..."
            value={userIdSearch}
            onChange={(e) => {
              setUserIdSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <div className="admin-sort">
          <ArrowUpDown size={16} aria-hidden="true" />
          <label htmlFor="transaction-sort" className="sr-only">
            Sort transactions
          </label>
          <select
            id="transaction-sort"
            className="admin-select"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as TransactionSortKey)
              setPage(1)
            }}
          >
            {TRANSACTION_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner" />
          <span>Loading transactions...</span>
        </div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <CreditCard size={32} />
          </div>
          <h3>No transactions found</h3>
          <p>
            {debouncedUserId
              ? 'No transactions found for that user ID'
              : statusFilter
              ? `No ${statusFilter.toLowerCase()} transactions yet`
              : 'No transactions have been recorded'}
          </p>
        </div>
      ) : (
        <>
          <TransactionTable transactions={transactions} />
          <div className="pagination">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              type="button"
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>
            <span className="page-info">
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              type="button"
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
