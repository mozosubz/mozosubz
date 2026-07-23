"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, MessageCircle, Trash2, Plus, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BotConnection {
  id: string
  platform: string
  identifier: string
  status: string
  connected_at: string
  last_active: string | null
}

interface BotConnectionsClientProps {
  initialUser: { id: string; email: string | null }
  initialConnections: BotConnection[]
}

const platformIcons: Record<string, JSX.Element> = {
  whatsapp: <MessageCircle className="w-5 h-5 text-green-600" />,
  telegram: <MessageCircle className="w-5 h-5 text-blue-600" />,
  discord: <MessageCircle className="w-5 h-5 text-indigo-600" />,
}

export function BotConnectionsClient({ initialUser, initialConnections }: BotConnectionsClientProps) {
  const router = useRouter()
  const [connections, setConnections] = useState<BotConnection[]>(initialConnections)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await fetch("/api/v1/bot-auth/connections")
        if (!res.ok) throw new Error("Failed to fetch connections")
        const data = await res.json()
        setConnections(data.connections || [])
      } catch (err: any) {
        console.error("Error fetching connections:", err)
      }
    }

    const interval = setInterval(fetchConnections, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleDisconnect = async (connectionId: string) => {
    setDeleting(connectionId)
    setError(null)

    try {
      const res = await fetch(`/api/v1/bot-auth/connections/${connectionId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        throw new Error("Failed to disconnect bot")
      }

      setConnections(connections.filter((c) => c.id !== connectionId))
    } catch (err: any) {
      setError(err.message || "Failed to disconnect bot")
    } finally {
      setDeleting(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full md:max-w-2xl md:mx-auto lg:max-w-3xl">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/50">
          <div className="flex items-center gap-3 px-4 md:px-6 lg:px-8 py-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">Bot Connections</h1>
          </div>
        </div>

        <div className="px-4 md:px-6 lg:px-8 py-6 pb-20 md:pb-8">
          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Add Connection Button */}
          <div className="mb-6">
            <Button
              onClick={() => router.push("/bot-connect")}
              className="w-full h-13 rounded-2xl bg-[#1a56db] hover:bg-[#1a56db]/90 text-white font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Bot Connection
            </Button>
          </div>

          {/* Connections List */}
          {connections.length === 0 ? (
            <div className="bg-white border border-black/6 rounded-xl p-8 text-center">
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold mb-1">No bot connections</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Connect a bot to start receiving deposit notifications
              </p>
              <Button
                onClick={() => router.push("/bot-connect")}
                className="mx-auto h-10 rounded-lg bg-[#1a56db] hover:bg-[#1a56db]/90 text-white font-semibold text-xs px-4"
              >
                Connect a Bot
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="bg-white border border-black/6 rounded-xl p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-[#f0f5ff] flex items-center justify-center">
                      {platformIcons[connection.platform.toLowerCase()] || (
                        <MessageCircle className="w-5 h-5 text-[#1a56db]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold capitalize">{connection.platform}</span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            connection.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {connection.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{connection.identifier}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Connected {formatDate(connection.connected_at)}
                      </p>
                      {connection.last_active && (
                        <p className="text-xs text-muted-foreground">
                          Last active: {formatDate(connection.last_active)}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDisconnect(connection.id)}
                    disabled={deleting === connection.id}
                    className="ml-4 p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    aria-label="Disconnect"
                  >
                    {deleting === connection.id ? (
                      <Loader2 className="w-5 h-5 text-red-600 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5 text-red-600 hover:text-red-700" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Info Section */}
          <div className="mt-8 bg-[#f0f5ff] border border-[#1a56db]/20 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#1a56db] mb-2">About Bot Connections</h3>
            <ul className="text-xs text-[#1a56db]/80 space-y-1">
              <li>• Connect WhatsApp, Telegram, or Discord bots</li>
              <li>• Receive instant deposit notifications</li>
              <li>• Disconnect anytime from this page</li>
              <li>• Each connection uses a unique API key</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
