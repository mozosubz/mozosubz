'use client'

import { useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { XCircle } from 'lucide-react'

export function ClearRateLimitForm() {
  const [identifier, setIdentifier] = useState('')
  const [identifierType, setIdentifierType] = useState<'ip' | 'email'>('ip')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!identifier.trim()) {
      toast({ title: 'Error', description: 'Please enter an IP or email', variant: 'destructive' })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/clear-rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          type: identifierType,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear rate limit')
      }

      toast({
        title: 'Success',
        description: `Rate limit cleared for ${identifier}. Previous attempts: ${data.previousCount}`,
        variant: 'default',
      })
      setIdentifier('')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to clear rate limit',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <div>
          <h2>Clear Rate Limits</h2>
          <p className="admin-card-subtitle">Unblock users or IPs from signup/login attempts</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-group">
          <label className="form-label">Identifier Type</label>
          <div className="form-radio-group">
            <label className="form-radio">
              <input
                type="radio"
                value="ip"
                checked={identifierType === 'ip'}
                onChange={(e) => setIdentifierType(e.target.value as 'ip' | 'email')}
              />
              <span>IP Address</span>
            </label>
            <label className="form-radio">
              <input
                type="radio"
                value="email"
                checked={identifierType === 'email'}
                onChange={(e) => setIdentifierType(e.target.value as 'ip' | 'email')}
              />
              <span>Email Address</span>
            </label>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            {identifierType === 'ip' ? 'IP Address' : 'Email Address'}
          </label>
          <input
            type="text"
            placeholder={identifierType === 'ip' ? '192.168.1.1' : 'user@example.com'}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="form-input"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary"
        >
          {isLoading ? 'Clearing...' : 'Clear Rate Limit'}
        </button>
      </form>
    </div>
  )
}
