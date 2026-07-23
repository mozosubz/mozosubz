"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

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
        className="w-4 h-4"
      />
    )
  }
  
  if (platformName === "telegram") {
    return (
      <img 
        src="https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/telegram/default.svg" 
        alt="Telegram" 
        className="w-4 h-4"
      />
    )
  }
  
  return null
}

export function BotConnectionsClient({ initialUser, initialConnections }: BotConnectionsClientProps) {
  const router = useRouter()

  // Create a map of connected platforms for quick lookup
  const connectedMap = new Map(
    initialConnections.map((conn) => [conn.platform.toLowerCase(), conn])
  )

  // Always show both platforms
  const platforms = [
    {
      name: "telegram",
      displayName: "Telegram",
      connectUrl: "https://t.me/mozosubz_bot",
    },
    {
      name: "whatsapp",
      displayName: "WhatsApp",
      connectUrl: "https://wa.me/09056458312",
    },
  ]

  const handleConnect = (url: string) => {
    window.open(url, "_blank")
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
        <div className="px-3 py-2 flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h1 className="text-sm font-bold text-gray-900">Bots</h1>
        </div>
      </header>

      {/* Content */}
      <main className="px-3 py-2 space-y-1.5 pb-20">
        {/* Platform Cards */}
        {platforms.map((platform) => {
          const connected = connectedMap.has(platform.name)
          const connection = connectedMap.get(platform.name)

          return (
            <div
              key={platform.name}
              className="bg-white border border-gray-200 rounded-lg p-2.5 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2.5">
                {/* Logo */}
                <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <PlatformLogo platform={platform.name} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h3 className="text-xs font-bold text-gray-900">{platform.displayName}</h3>
                    {connected && (
                      <span className="inline-flex text-xs font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                        Connected
                      </span>
                    )}
                  </div>

                  {connected && connection ? (
                    <p className="text-xs text-gray-600">
                      {new Date(connection.last_active || connection.connected_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">Not connected</p>
                  )}
                </div>

                {/* Action Button */}
                {!connected && (
                  <button
                    onClick={() => handleConnect(platform.connectUrl)}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors flex-shrink-0 whitespace-nowrap"
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
