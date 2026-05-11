'use client'

import { useState } from 'react'
import { Copy, Loader2, CheckCircle2, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function WhatsAppConnection() {
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const generateToken = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/whatsapp/connect-token', {
        method: 'POST',
      })

      const data = await res.json()

      if (data.success) {
        setToken(data.token)
        toast({
          title: 'Token Generated',
          description: 'Copy the token and send it to the WhatsApp bot',
        })
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to generate token',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate token',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(`LINK ${token}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        title: 'Copied',
        description: 'Command copied to clipboard',
      })
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">WhatsApp Connection</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your WhatsApp to access Mozosubz services directly from WhatsApp
        </p>
      </div>

      {!token ? (
        <button
          onClick={generateToken}
          disabled={loading}
          className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Connection Token'
          )}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="bg-muted p-3 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-2">Send this to WhatsApp bot:</p>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono flex-1 text-foreground">LINK {token}</code>
              <button
                onClick={copyToken}
                className="p-1 hover:bg-background rounded transition-colors"
              >
                {copied ? (
                  <CheckCircle2 size={16} className="text-green-500" />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Token expires in 10 minutes</p>
          <button
            onClick={() => setToken(null)}
            className="w-full text-sm text-muted-foreground hover:text-foreground py-2"
          >
            Generate New Token
          </button>
        </div>
      )}

      <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3 text-xs text-blue-700 dark:text-blue-200">
        <p className="font-semibold mb-1">How it works:</p>
        <ol className="space-y-1 ml-2">
          <li>1. Generate a token here</li>
          <li>2. Send the command to the Mozosubz WhatsApp bot</li>
          <li>3. Your WhatsApp will be connected to your account</li>
          <li>4. Start using Mozosubz services on WhatsApp</li>
        </ol>
      </div>
    </div>
  )
}
