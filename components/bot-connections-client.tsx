"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Trash2, Plus, Loader2, AlertCircle, Phone, User } from "lucide-react"
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

const PlatformLogo = ({ platform }: { platform: string }) => {
  const platformName = platform.toLowerCase()
  
  if (platformName === "whatsapp") {
    return (
      <img 
        src="https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/whatsapp/default.svg" 
        alt="WhatsApp" 
        className="w-6 h-6"
      />
    )
  }
  
  if (platformName === "telegram") {
    return (
      <img 
        src="https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/telegram/default.svg" 
        alt="Telegram" 
        className="w-6 h-6"
      />
    )
  }
  
  return null
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
        setError(`Error loading connections: ${err.message}`)
      }
    }

    // Fetch immediately on mount
    fetchConnections()
    
    // Then set up interval for periodic refresh
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
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-2xl p-12 text-center">
              <div className="flex justify-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-xl">📱</div>
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-xl">💬</div>
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-xl">🤖</div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">No connected bots yet</h3>
              <p className="text-sm text-gray-600 mb-6">
                Connect your WhatsApp or Telegram bot to start receiving instant deposit notifications
              </p>
              <Button
                onClick={() => router.push("/bot-connect")}
                className="mx-auto h-11 rounded-xl bg-[#1a56db] hover:bg-[#1a56db]/90 text-white font-semibold text-sm px-6"
              >
                <Plus className="w-4 h-4 mr-2" />
                Connect Your First Bot
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Logo and Platform Info */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <PlatformLogo platform={connection.platform} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-sm font-bold capitalize text-gray-900">{connection.platform}</h3>
                          <span
                            className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
                              connection.status === "active"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {connection.status === "active" ? "Active" : "Inactive"}
                          </span>
                        </div>

                        {/* Platform Details */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700 font-medium">{connection.identifier}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <User className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Connected on {formatDate(connection.connected_at)}</span>
                          </div>

                          {connection.last_active && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <div className="w-3.5 h-3.5 rounded-full bg-green-400 flex-shrink-0" />
                              <span>Last active: {formatDate(connection.last_active)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Delete Button */}
                    <button
                      onClick={() => handleDisconnect(connection.id)}
                      disabled={deleting === connection.id}
                      className="p-2.5 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                      aria-label="Disconnect"
                      title="Disconnect bot"
                    >
                      {deleting === connection.id ? (
                        <Loader2 className="w-5 h-5 text-red-600 animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5 text-gray-400 hover:text-red-600" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info Section */}
          <div className="mt-8 bg-gradient-to-r from-[#f0f5ff] to-[#f7faff] border border-[#1a56db]/20 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">💡 How Bot Connections Work</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-[#1a56db] font-bold mt-0.5">•</span>
                <span><strong>Connect bots</strong> - Link WhatsApp or Telegram accounts</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#1a56db] font-bold mt-0.5">•</span>
                <span><strong>Get notifications</strong> - Receive instant alerts when deposits arrive</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#1a56db] font-bold mt-0.5">•</span>
                <span><strong>Manage easily</strong> - Disconnect anytime from this page</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#1a56db] font-bold mt-0.5">•</span>
                <span><strong>Secure</strong> - Each connection uses unique API credentials</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
