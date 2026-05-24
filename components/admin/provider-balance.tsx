'use client'

import { useEffect, useState, useCallback } from 'react'
import { Wallet, RefreshCw } from 'lucide-react'

export function ProviderBalance() {
  const [balance, setBalance] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/admin/provider-balance?t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      })
      
      const data = await response.json()

      if (data.success) {
        setBalance(data.formatted)
      } else {
        setError(data.message || 'Failed to load balance')
      }
    } catch (err) {
      setError('Error fetching balance')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  // Poll every 5 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBalance()
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchBalance])

  return (
    <div className="stat-card">
      <div className="stat-header">
        <h3 className="stat-title">Provider Balance</h3>
        <div className="stat-icon">
          <Wallet size={18} />
        </div>
      </div>
      
      {error ? (
        <div className="stat-value text-red-500 text-sm">{error}</div>
      ) : loading ? (
        <div className="stat-value text-gray-400">Loading...</div>
      ) : balance ? (
        <div className="stat-value">{balance}</div>
      ) : (
        <div className="stat-value text-gray-400">—</div>
      )}
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
        <p className="stat-trend">Live balance • Updated every 5s</p>
        <button
          onClick={() => fetchBalance()}
          disabled={loading}
          className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          title="Refresh balance"
          type="button"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  )
}
