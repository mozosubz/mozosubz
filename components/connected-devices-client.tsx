'use client'

import { useEffect, useState } from 'react'

interface BotConnection {
  id: string
  platform: 'whatsapp' | 'telegram'
  identifier: string
  connected_at: string
  last_active_at: string | null
}

interface ConnectedDevicesClientProps {
  initialUser: { id: string; email: string | null }
  connectKey: string | null
}

export function ConnectedDevicesClient({
  initialUser,
  connectKey,
}: ConnectedDevicesClientProps) {
  const [connections, setConnections] = useState<BotConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)

  useEffect(() => {
    if (!connectKey) {
      setLoading(false)
      return
    }

    const fetchConnections = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/v1/bot-auth/connections', {
          method: 'GET',
          headers: {
            'X-Connect-Key': connectKey,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setConnections(data.connections || [])
        }
      } catch (error) {
        console.error('Failed to fetch connections:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchConnections()
  }, [connectKey])

  const handleDisconnect = async (connectionId: string, platform: string) => {
    if (!connectKey) return

    try {
      setDisconnectingId(connectionId)
      const response = await fetch('/api/v1/bot-auth/disconnect', {
        method: 'POST',
        headers: {
          'X-Connect-Key': connectKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ platform }),
      })

      if (response.ok) {
        setConnections(connections.filter((c) => c.id !== connectionId))
      } else {
        alert('Failed to disconnect')
      }
    } catch (error) {
      console.error('Failed to disconnect:', error)
      alert('Error disconnecting device')
    } finally {
      setDisconnectingId(null)
    }
  }

  const platformIcons: Record<string, string> = {
    whatsapp: '💬',
    telegram: '✈️',
  }

  const platformLabels: Record<string, string> = {
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Connected Devices</h1>
          <p className="text-foreground/60">
            Manage platforms connected to your account. Each connection allows you to use our services
            through WhatsApp or Telegram.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-foreground/60">Loading connections...</p>
          </div>
        ) : !connectKey ? (
          <div className="rounded-lg border border-border bg-background/50 p-8 text-center">
            <p className="text-foreground/60 mb-4">API key not found</p>
            <p className="text-sm text-foreground/40">Unable to load connected devices</p>
          </div>
        ) : connections.length === 0 ? (
          <div className="rounded-lg border border-border bg-background/50 p-8 text-center">
            <p className="text-foreground/60 mb-4">No connected devices yet</p>
            <p className="text-sm text-foreground/40">
              Start a conversation with our WhatsApp or Telegram bot to connect your account
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="rounded-lg border border-border bg-background/50 p-4 flex items-center justify-between hover:bg-background/75 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-2xl">{platformIcons[connection.platform]}</span>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {platformLabels[connection.platform]}
                    </p>
                    <p className="text-sm text-foreground/60">{connection.identifier}</p>
                    <p className="text-xs text-foreground/40 mt-1">
                      Connected {new Date(connection.connected_at).toLocaleDateString()}
                      {connection.last_active_at &&
                        ` • Last active ${new Date(
                          connection.last_active_at
                        ).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect(connection.id, connection.platform)}
                  disabled={disconnectingId === connection.id}
                  className="px-4 py-2 text-sm font-medium text-foreground/60 hover:text-foreground rounded-md border border-border hover:bg-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {disconnectingId === connection.id ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-border bg-blue-500/10 p-4">
          <p className="text-sm text-blue-600 font-medium">How to connect</p>
          <p className="text-sm text-foreground/60 mt-2">
            Message our bot on WhatsApp or Telegram with your email address to connect your account.
            You&apos;ll receive a one-time code to verify.
          </p>
        </div>
      </div>
    </div>
  )
}
