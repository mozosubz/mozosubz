"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Unplug,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  connected: boolean
  maskedPhone: string | null
  verifiedAt: string | null
}

export function WhatsAppConnectClient({
  connected: initialConnected,
  maskedPhone: initialMaskedPhone,
  verifiedAt: initialVerifiedAt,
}: Props) {
  const router = useRouter()

  const [connected, setConnected] = useState(initialConnected)
  const [maskedPhone, setMaskedPhone] = useState(initialMaskedPhone)
  const [verifiedAt, setVerifiedAt] = useState(initialVerifiedAt)

  const [token, setToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateToken = async () => {
    setError(null)
    setGenerating(true)
    try {
      const res = await fetch("/api/whatsapp/connect-token", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Failed to generate token")
      }
      if (data.already_connected) {
        setConnected(true)
        setMaskedPhone(data.whatsapp_phone_masked ?? null)
        setVerifiedAt(data.verified_at ?? null)
        return
      }
      setToken(data.token)
      setExpiresAt(data.expires_at)
    } catch (err: any) {
      setError(err?.message ?? "Failed to generate token")
    } finally {
      setGenerating(false)
    }
  }

  const copyMessage = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(`CONNECT ${token}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore — user can copy manually
    }
  }

  const disconnect = async () => {
    if (!confirm("Disconnect WhatsApp from your account?")) return
    setError(null)
    setDisconnecting(true)
    try {
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Failed to disconnect")
      }
      setConnected(false)
      setMaskedPhone(null)
      setVerifiedAt(null)
      setToken(null)
      setExpiresAt(null)
      router.refresh()
    } catch (err: any) {
      setError(err?.message ?? "Failed to disconnect")
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-gray-100 transition"
            type="button"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900">WhatsApp</h1>
            <p className="text-xs text-gray-500">Use Mozosubz from chat</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Hero card */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-lg bg-[#25d366]/10 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="#25d366"
                className="w-6 h-6"
                aria-hidden="true"
              >
                <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-gray-900">
                {connected ? "Connected" : "Connect your WhatsApp"}
              </h2>
              <p className="text-xs text-gray-500">
                {connected
                  ? "Buy airtime, data and more by chatting with our bot."
                  : "Link once, then transact from WhatsApp securely."}
              </p>
            </div>
            {connected && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified
              </div>
            )}
          </div>

          {connected && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">WhatsApp number</span>
                <span className="font-medium text-gray-900">{maskedPhone}</span>
              </div>
              {verifiedAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Linked on</span>
                  <span className="font-medium text-gray-900">
                    {new Date(verifiedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
              <Button
                onClick={disconnect}
                disabled={disconnecting}
                variant="outline"
                className="w-full mt-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                {disconnecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Unplug className="w-4 h-4 mr-2" />
                )}
                Disconnect WhatsApp
              </Button>
            </div>
          )}
        </div>

        {/* Connect flow */}
        {!connected && (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              How to connect
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Generate a one-time code, then send it to the Mozosubz bot on
              WhatsApp.
            </p>

            <ol className="space-y-3 mb-5">
              <Step n={1} text="Tap “Generate code” below" />
              <Step
                n={2}
                text="Open WhatsApp and start a chat with the Mozosubz bot"
              />
              <Step
                n={3}
                text="Send the exact message we give you. Your account links instantly."
              />
            </ol>

            {!token ? (
              <Button
                onClick={generateToken}
                disabled={generating}
                className="w-full bg-[#1a56db] hover:bg-[#1748b8] text-white"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate code"
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-gray-900 text-gray-100 p-4 font-mono text-sm break-all">
                  CONNECT {token}
                </div>
                <Button
                  onClick={copyMessage}
                  variant="outline"
                  className="w-full"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2 text-emerald-600" />
                      Copied to clipboard
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy message
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  Code expires in 10 minutes
                  {expiresAt
                    ? ` · at ${new Date(expiresAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : ""}
                  .
                </p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Docs link */}
        <Link
          href="/docs/whatsapp"
          className="block bg-white rounded-xl border border-gray-100 p-4 hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#f0f5ff] flex items-center justify-center">
              <ExternalLink className="w-4 h-4 text-[#1a56db]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">
                WhatsApp API documentation
              </p>
              <p className="text-xs text-gray-500">
                For developers integrating the Mozosubz WhatsApp bot.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-[#f0f5ff] text-[#1a56db] text-xs font-semibold flex items-center justify-center flex-shrink-0">
        {n}
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
    </li>
  )
}
