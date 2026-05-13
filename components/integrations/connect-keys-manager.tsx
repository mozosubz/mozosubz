'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Copy, Eye, EyeOff, Trash2, Plus } from 'lucide-react'

interface ConnectKey {
  id: string
  name: string
  keyPreview: string
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
  expiresAt: string
}

export function ConnectKeysManager() {
  const [keys, setKeys] = useState<ConnectKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<{
    key: string
    keyPreview: string
    keyId: string
    name: string
    createdAt: string
  } | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchKeys()
  }, [])

  async function fetchKeys() {
    try {
      const res = await fetch('/api/integrations/keys/list')
      const data = await res.json()
      if (data.success) {
        setKeys(data.keys)
      }
    } catch (err) {
      console.error('Failed to fetch keys:', err)
    }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) {
      setError('Key name is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/integrations/keys/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Failed to create key')
        return
      }

      setGeneratedKey({
        key: data.key,
        keyPreview: data.keyPreview,
        keyId: data.keyId,
        name: data.name,
        createdAt: data.createdAt,
      })

      setNewKeyName('')
      setSuccess('Key created successfully! Save it now - you won\'t see it again.')
      await fetchKeys()
    } catch (err) {
      setError('Failed to create key')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRevokeKey(keyId: string) {
    if (!confirm('Are you sure? This action cannot be undone.')) return

    try {
      const res = await fetch('/api/integrations/keys/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId }),
      })

      const data = await res.json()

      if (data.success) {
        setSuccess('Key revoked successfully')
        await fetchKeys()
      } else {
        setError(data.error || 'Failed to revoke key')
      }
    } catch (err) {
      setError('Failed to revoke key')
      console.error(err)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setSuccess('Copied to clipboard!')
    setTimeout(() => setSuccess(''), 2000)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Generated Key Alert */}
      {generatedKey && (
        <Card className="border-green-200 bg-green-50 p-4">
          <h3 className="font-semibold text-green-900 mb-3">Your API Key</h3>
          <div className="bg-white p-3 rounded border border-green-200 mb-3 font-mono text-sm break-all flex items-center justify-between">
            <span className="flex-1">
              {showKey ? generatedKey.key : '•'.repeat(generatedKey.key.length)}
            </span>
            <button onClick={() => setShowKey(!showKey)} className="ml-2 p-1 hover:bg-gray-100 rounded">
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => copyToClipboard(generatedKey.key)} className="gap-2">
              <Copy size={16} /> Copy Key
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              const element = document.createElement('a')
              element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(generatedKey.key)}`)
              element.setAttribute('download', `${generatedKey.name}-key.txt`)
              element.style.display = 'none'
              document.body.appendChild(element)
              element.click()
              document.body.removeChild(element)
            }}>
              Download
            </Button>
          </div>
          <p className="text-sm text-green-700 mt-3">⚠️ Save your key securely. You won\'t be able to see it again!</p>
        </Card>
      )}

      {/* Error/Success Messages */}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}
      {success && <div className="p-3 bg-blue-50 text-blue-700 rounded">{success}</div>}

      {/* Create New Key Form */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Generate New API Key</h3>
        <div className="flex gap-2">
          <Input
            placeholder="Key name (e.g., 'Production', 'Testing')"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            disabled={loading}
          />
          <Button onClick={handleCreateKey} disabled={loading} className="gap-2">
            <Plus size={16} /> Generate
          </Button>
        </div>
        <p className="text-sm text-gray-600 mt-2">When you create a new key, your previous key becomes invalid.</p>
      </Card>

      {/* Active Keys List */}
      <div>
        <h3 className="font-semibold mb-3">Your API Keys</h3>
        {keys.length === 0 ? (
          <Card className="p-6 text-center text-gray-600">
            <p>No API keys yet. Create one to get started.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <Card key={key.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{key.name}</p>
                    <p className="text-sm text-gray-600 font-mono">{key.keyPreview}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Created: {new Date(key.createdAt).toLocaleDateString()}
                      {key.lastUsedAt && ` • Last used: ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${key.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {key.isActive ? 'Active' : 'Revoked'}
                    </span>
                    {key.isActive && (
                      <Button size="sm" variant="outline" onClick={() => handleRevokeKey(key.id)} className="text-red-600">
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
