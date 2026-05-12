'use client'

import { useEffect, useState } from 'react'
import { Wallet, RefreshCw } from 'lucide-react'

export function GSubzBalance() {
  const [balance, setBalance] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/admin/gsubz-balance', {
        method: 'GET',
        cache: 'no-store',
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
  }

  // Fetch on mount
  useEffect(() => {
    fetchBalance()
  }, [])

  // Poll every 30 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBalance()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="stat-card">
      <div className="stat-header">
        <h3 className="stat-title">gSubz Wallet</h3>
        <div className="stat-icon">
          <Wallet size={18} />
        </div>
      </div>
      
      {loading && !balance ? (
        <div className="stat-value text-gray-400">Loading...</div>
      ) : error ? (
        <div className="stat-value text-red-500 text-sm">{error}</div>
      ) : (
        <div className="stat-value">{balance}</div>
      )}
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
        <p className="stat-trend">Live balance • Updated every 30s</p>
        <button
          onClick={fetchBalance}
          disabled={loading}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="Refresh balance"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  )
}
