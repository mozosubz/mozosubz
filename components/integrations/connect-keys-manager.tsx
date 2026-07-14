'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, Check, Eye, EyeOff, Loader2, KeyRound, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ActiveKey {
  id: string
  name: string
  keyPreview: string
  createdAt: string
  lastUsedAt: string | null
}

export function ConnectKeysManager() {
  const router = useRouter()

  const [activeKey, setActiveKey] = useState<ActiveKey | null>(null)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchActiveKey()
  }, [])

  async function fetchActiveKey() {
    setLoadingList(true)
    try {
      const res = await fetch('/api/connect-keys/list')
      const data = await res.json()
      if (data.success && Array.isArray(data.keys) && data.keys.length > 0) {
        const k = data.keys[0]
        setActiveKey({
          id: k.id,
          name: k.name,
          keyPreview: k.keyPreview ?? k.key_preview ?? '',
          createdAt: k.createdAt ?? k.created_at,
          lastUsedAt: k.lastUsedAt ?? k.last_used_at ?? null,
        })
      } else {
        setActiveKey(null)
      }
    } catch {
      setError('Failed to load your key')
    } finally {
      setLoadingList(false)
    }
  }

  async function handleGenerate() {
    if (
      activeKey &&
      !confirm('Generating a new key will invalidate your current one. Continue?')
    ) {
      return
    }

    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/connect-keys/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'default' }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Failed to generate key')
        return
      }

      setGeneratedKey(data.key)
      setShowKey(true)
      await fetchActiveKey()
    } catch {
      setError('Failed to generate key. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Could not copy to clipboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with back */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-gray-100 transition"
            type="button"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-gray-900">Connect Key</h1>
            <p className="text-xs text-gray-500">Your API key for Mozosubz services</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Newly generated key callout — shown once after generation */}
        {generatedKey && (
          <div className="bg-white rounded-xl border border-emerald-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-emerald-900">Your new Connect Key</h2>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Copy it now. We will not show it again.
            </p>
            <div className="bg-gray-900 text-gray-100 font-mono text-xs sm:text-sm break-all rounded-lg p-3 flex items-start gap-2">
              <span className="flex-1">
                {showKey ? generatedKey : '•'.repeat(32)}
              </span>
              <button
                onClick={() => setShowKey((s) => !s)}
                className="text-gray-400 hover:text-white p-1 rounded"
                aria-label={showKey ? 'Hide key' : 'Show key'}
                type="button"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                onClick={() => handleCopy(generatedKey)}
                className="flex-1 bg-[#1a56db] hover:bg-[#1748b8] text-white"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" /> Copy key
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setGeneratedKey(null)}
                className="text-gray-600"
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Current active key */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-lg bg-[#f0f5ff] flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-[#1a56db]" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-gray-900">Active key</h2>
              <p className="text-xs text-gray-500">
                One key per account. Use it in the <code className="font-mono">X-Connect-Key</code> header.
              </p>
            </div>
          </div>

          {loadingList ? (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading
            </div>
          ) : activeKey ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
                  Key preview
                </p>
                <p className="font-mono text-sm text-gray-900 break-all">{activeKey.keyPreview}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-400">Created</p>
                  <p className="text-gray-900 font-medium">
                    {new Date(activeKey.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Last used</p>
                  <p className="text-gray-900 font-medium">
                    {activeKey.lastUsedAt
                      ? new Date(activeKey.lastUsedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Never'}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={generating}
                variant="outline"
                className="w-full mt-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" /> Generate new key
                  </>
                )}
              </Button>
              <p className="text-[11px] text-gray-400 text-center">
                Generating a new key will immediately invalidate this one.
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-600 mb-4">You don&apos;t have a Connect Key yet.</p>
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="bg-[#1a56db] hover:bg-[#1748b8] text-white"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 mr-2" /> Generate Connect Key
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Quick-start endpoints */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">v1 API — quick reference</h2>
          <p className="text-xs text-gray-500">
            Pass your Connect Key in every request as{' '}
            <code className="font-mono bg-gray-100 px-1 rounded">X-Connect-Key</code>.
          </p>
          <div className="space-y-2">
            {[
              { method: 'GET', path: '/api/v1/data/plans?service=mtn_sme', label: 'List data plans' },
              { method: 'POST', path: '/api/v1/data/purchase', label: 'Buy data' },
              { method: 'POST', path: '/api/v1/airtime/purchase', label: 'Buy airtime' },
            ].map((e) => (
              <div
                key={e.path}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100"
              >
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    e.method === 'GET'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {e.method}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-500">{e.label}</p>
                  <p className="font-mono text-[11px] text-gray-800 truncate">{e.path}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Docs link */}
        <Link
          href="/doc"
          className="block bg-white rounded-xl border border-gray-100 p-4 hover:bg-gray-50 transition"
        >
          <p className="text-sm font-semibold text-gray-900">Full API documentation</p>
          <p className="text-xs text-gray-500">
            Request/response examples, error codes, and rate limits.
          </p>
        </Link>
      </div>
    </div>
  )
}
