"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, RefreshCw } from "lucide-react"

interface BotConnection {
  id: string
  platform: string
  identifier: string
  status: string
  connected_at: string
  last_active: string | null
}

interface BotConnectionsClientProps {
  userId: string
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
        className="w-7 h-7"
      />
    )
  }
  
  if (platformName === "telegram") {
    return (
      <img 
        src="https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/telegram/default.svg" 
        alt="Telegram" 
        className="w-7 h-7"
      />
    )
  }
  
  return null
}

export function BotConnectionsClient({ userId, initialUser, initialConnections }: BotConnectionsClientProps) {
  const router = useRouter()
  const [connections, setConnections] = useState(initialConnections)
  const [refreshing, setRefreshing] = useState(false)

  // Refresh connections periodically to check for disconnections
  useEffect(() => {
    console.log("[v0] Bot connections component mounted, starting auto-refresh")
    const interval = setInterval(refreshConnections, 3000) // Refresh every 3 seconds
    return () => clearInterval(interval)
  }, [])

  const refreshConnections = async () => {
    try {
      console.log("[v0] Fetching bot connections from API...")
      const res = await fetch("/api/bot-connections")
      
      if (!res.ok) {
        console.error("[v0] API returned status:", res.status)
        return
      }
      
      const data = await res.json()
      console.log("[v0] Got connections from API:", data.connections)
      setConnections(data.connections || [])
    } catch (err) {
      console.error("[v0] Failed to refresh connections:", err)
    }
  }

  const handleRefresh = async () => {
    console.log("[v0] Manual refresh triggered")
    setRefreshing(true)
    await refreshConnections()
    setRefreshing(false)
  }

  // Create a map of connected platforms for quick lookup
  const connectedMap = new Map(
    connections.map((conn) => [conn.platform.toLowerCase(), conn])
  )

  // Always show both platforms
  const platforms = [
    {
      name: "telegram",
      displayName: "Telegram",
      directUrl: "tg://resolve?domain=mozosubz_bot&start=start",
    },
    {
      name: "whatsapp",
      displayName: "WhatsApp",
      directUrl: "https://wa.me/09056458312?text=/start",
    },
  ]

  const handleConnect = (url: string) => {
    window.location.href = url
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Bot Connections</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 py-4 space-y-3 pb-20">
        {/* Platform Cards */}
        {platforms.map((platform) => {
          const connected = connectedMap.has(platform.name)
          const connection = connectedMap.get(platform.name)

          return (
            <div
              key={platform.name}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Logo */}
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <PlatformLogo platform={platform.name} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-gray-900">{platform.displayName}</h3>
                      {connected && (
                        <span className="inline-flex text-sm font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                          Connected
                        </span>
                      )}
                    </div>

                    {connected && connection ? (
                      <p className="text-sm text-gray-600">
                        {formatDate(connection.last_active || connection.connected_at)}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">Not connected</p>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                {!connected && (
                  <button
                    onClick={() => handleConnect(platform.directUrl)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors flex-shrink-0 whitespace-nowrap"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </main>
    </div>
  )
}
