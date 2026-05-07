import { Metadata } from 'next'
import { Lock } from 'lucide-react'
import { ClearRateLimitForm } from '@/components/admin/clear-rate-limit-form'

export const metadata: Metadata = {
  title: 'Rate Limits - Admin Dashboard',
  description: 'Manage and clear user rate limits',
}

export default function RateLimitsPage() {
  return (
    <main className="admin-content">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-header-title">
            <Lock size={32} className="header-icon" />
            <div>
              <h1>Rate Limits</h1>
              <p>Manage and clear signup and login rate limits for users</p>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-page-content">
        {/* Rate Limit Management */}
        <ClearRateLimitForm />

        {/* Information Card */}
        <div className="card">
          <div className="card-header">
            <h2>Rate Limit Information</h2>
          </div>
          <div className="card-content">
            <div className="info-section">
              <h3>Current Limits</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Signup Attempts</span>
                  <span className="info-value">9 per hour</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Login Attempts</span>
                  <span className="info-value">5 per 60 seconds</span>
                </div>
              </div>
            </div>
            <div className="info-section">
              <h3>About Rate Limiting</h3>
              <p>
                Rate limits are applied per IP address to prevent abuse. Users who exceed the limit will receive an error message and must wait for the rate limit window to expire before retrying.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
