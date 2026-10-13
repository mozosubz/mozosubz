'use client'

import { useState } from 'react'
import { X, AlertCircle, Ban, CheckCircle } from 'lucide-react'
import { ModalPortal } from './modal-portal'

interface BanUserModalProps {
  user: {
    id: string
    full_name: string
    email: string
    wallet_balance: number
  }
  onClose: () => void
  onBan: (userId: string, reason: string) => Promise<{ success?: boolean; error?: string }>
}

const QUICK_REASONS = [
  'Fraud / suspicious activity',
  'Abuse of payment disputes',
  'Multiple account farming',
  'Terms of service violation',
]

export function BanUserModal({ user, onClose, onBan }: BanUserModalProps) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmed = reason.trim()
    if (trimmed.length < 3) {
      setError('Please give a reason (at least 3 characters)')
      return
    }

    setLoading(true)
    try {
      const result = await onBan(user.id, trimmed)
      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }
      setSuccess(true)
      setLoading(false)
      setTimeout(() => {
        onClose()
        window.location.reload()
      }, 1600)
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <ModalPortal onClose={loading ? undefined : onClose}>
      <div className="modal-overlay" onClick={loading ? undefined : onClose} role="presentation">
        <div
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Ban user account"
        >
          <div className="modal-header">
            <h2>
              <Ban size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: '-3px' }} />
              Ban Account
            </h2>
            <button onClick={onClose} className="modal-close" disabled={loading} type="button">
              <X size={20} />
            </button>
          </div>

          {!success ? (
            <form onSubmit={handleSubmit} className="modal-body">
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--admin-text)' }}>
                  {user.full_name || 'Unnamed user'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--admin-text-secondary)', wordBreak: 'break-all' }}>
                  {user.email}
                </div>
                <div style={{ fontSize: 12, color: 'var(--admin-text-secondary)', marginTop: 6 }}>
                  Balance: ₦{user.wallet_balance.toLocaleString()}
                </div>
              </div>

              <p style={{ fontSize: 13, color: 'var(--admin-text-secondary)', marginTop: 0 }}>
                The user will be signed out, unable to sign back in, and their API keys will stop
                working. Their balance and transaction history are kept.
              </p>

              <div className="form-field">
                <label htmlFor="ban-reason" className="form-label">
                  Reason <span style={{ color: 'var(--admin-danger)' }}>*</span>
                </label>
                <input
                  id="ban-reason"
                  className="form-input"
                  type="text"
                  placeholder="Why is this account being banned?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  required
                  disabled={loading}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {QUICK_REASONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setReason(q)}
                      disabled={loading}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: 12,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 8,
                    color: '#fca5a5',
                    fontSize: 13,
                    marginBottom: 8,
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" disabled={loading}>
                  {loading ? 'Banning…' : 'Ban Account'}
                </button>
              </div>
            </form>
          ) : (
            <div
              className="modal-body"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
                padding: '36px 24px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle size={36} style={{ color: 'var(--admin-success)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--admin-text)', margin: 0 }}>
                  Account banned
                </h3>
                <p style={{ fontSize: 13, color: 'var(--admin-text-secondary)', margin: '6px 0 0 0' }}>
                  {user.email} can no longer sign in or use their API keys.
                </p>
              </div>
              <p style={{ fontSize: 12, color: 'var(--admin-text-tertiary)', margin: 0 }}>
                Closing automatically…
              </p>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}
