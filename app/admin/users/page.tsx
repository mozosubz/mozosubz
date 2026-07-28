'use client'

import { useState, useEffect } from 'react'
import { getUsers } from '@/lib/actions/admin'
import { UserTable } from '@/components/admin/user-table'
import { Search, Users as UsersIcon, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react'
import {
  USER_SORT_OPTIONS,
  DEFAULT_USER_SORT,
  type UserSortKey,
} from '@/lib/utils/admin-sort'

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<UserSortKey>(DEFAULT_USER_SORT)
  const [totalPages, setTotalPages] = useState(1)

  // Typing used to fire one full query per keystroke. Debouncing the term the
  // query actually depends on collapses a burst of typing into a single request.
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    // Guards against out-of-order responses: a slow earlier request resolving
    // after a newer one would otherwise overwrite the table with stale rows.
    let cancelled = false

    const fetchUsers = async () => {
      setLoading(true)
      const result = await getUsers(page, 10, debouncedSearch, sortBy)
      if (cancelled) return
      if (!result.error) {
        setUsers(result.users)
        setTotalPages(result.totalPages)
      }
      setLoading(false)
    }
    fetchUsers()

    return () => {
      cancelled = true
    }
  }, [page, debouncedSearch, sortBy])

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-row">
          <div>
            <h1>User Management</h1>
            <p>Manage users, credit/debit wallets, and assign roles</p>
          </div>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by name, username, email, phone, or user ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <div className="admin-sort">
          <ArrowUpDown size={16} aria-hidden="true" />
          <label htmlFor="user-sort" className="sr-only">
            Sort users
          </label>
          <select
            id="user-sort"
            className="admin-select"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as UserSortKey)
              // Page 1 of the new ordering — staying on page 4 of the old sort
              // would land the admin in an arbitrary slice of a different list.
              setPage(1)
            }}
          >
            {USER_SORT_OPTIONS.map((option) => (
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
          <span>Loading users...</span>
        </div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <UsersIcon size={32} />
          </div>
          <h3>No users found</h3>
          <p>
            {searchTerm
              ? 'Try a different search term'
              : 'No users have signed up yet'}
          </p>
        </div>
      ) : (
        <>
          <UserTable users={users} />
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
