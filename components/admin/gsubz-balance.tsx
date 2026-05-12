'use client'

import { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'

interface BalanceData {
  balance: number | string
  formatted?: string
  error?: string
}

export function GSubzBalance() {
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true)
        const apiKey = process.env.NEXT_PUBLIC_GSUBZ_API_KEY
        
        if (!apiKey) {
          setBalance({ balance: 0, error: 'API key not configured' })
          setLoading(false)
          return
        }

        const formData = new FormData()
        formData.append('api', apiKey)

        const response = await fetch('https://api.gsubz.com/api/balance/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        const balanceAmount = parseFloat(data.balance || 0)
        const formatted = `₦${balanceAmount.toLocaleString('en-NG', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`

        setBalance({
          balance: balanceAmount,
          formatted,
        })
      } catch (err) {
        console.error('Failed to fetch gSubz balance:', err)
        setBalance({
          balance: 0,
          error: err instanceof Error ? err.message : 'Failed to fetch balance',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchBalance()
    // Refresh every 30 seconds
    const interval = setInterval(fetchBalance, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="stat-card">
        <div className="stat-header">
          <h3 className="stat-title">gSubz Wallet Balance</h3>
          <div className="stat-icon">
            <Wallet size={18} />
          </div>
        </div>
        <div className="stat-value">Loading...</div>
      </div>
    )
  }

  return (
    <div className="stat-card">
      <div className="stat-header">
        <h3 className="stat-title">gSubz Wallet Balance</h3>
        <div className="stat-icon">
          <Wallet size={18} />
        </div>
      </div>
      <div className="stat-value">{balance?.formatted || '₦0.00'}</div>
      <p className="stat-trend">
        {balance?.error ? `Error: ${balance.error}` : 'Current balance'}
      </p>
    </div>
  )
}
