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
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#25D366" }}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-4.99 1.513.498.498 0 00-.276.694l.75 2.311a.507.507 0 00.644.324 8.877 8.877 0 015.07-1.64.507.507 0 00.51-.491l-.009-2.4a.505.505 0 00-.508-.506z" />
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" fill="none" />
      </svg>
    )
  }
  
  if (platformName === "telegram") {
    return (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#0088cc" }}>
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.82-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.332-.373-.119l-6.869 4.326-2.96-.924c-.643-.204-.658-.643.135-.953l11.566-4.461c.538-.196 1.006.128.832.941z" />
      </svg>
    )
  }
  
  if (platformName === "discord") {
    return (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#5865F2" }}>
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.445.865-.608 1.25a18.27 18.27 0 0 0-5.487 0c-.163-.39-.398-.875-.609-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.042-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.294.075.075 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.075.075 0 0 1 .079.009c.12.098.246.198.373.295a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.076.076 0 0 0-.041.107c.36.698.77 1.364 1.225 1.994a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-4.718-.838-8.812-3.54-12.46a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-.965-2.157-2.156 0-1.193.964-2.157 2.157-2.157 1.193 0 2.157.964 2.157 2.157 0 1.191-.964 2.156-2.157 2.156zm7.975 0c-1.183 0-2.157-.965-2.157-2.156 0-1.193.965-2.157 2.157-2.157 1.192 0 2.157.964 2.157 2.157 0 1.191-.965 2.156-2.157 2.156z" />
      </svg>
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
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-2xl p-12 text-center">
              <div className="flex justify-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-xl">📱</div>
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-xl">💬</div>
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-xl">🤖</div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">No connected bots yet</h3>
              <p className="text-sm text-gray-600 mb-6">
                Connect your WhatsApp, Telegram, or Discord bot to start receiving instant deposit notifications
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
                <span><strong>Connect bots</strong> - Link WhatsApp, Telegram, or Discord accounts</span>
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
