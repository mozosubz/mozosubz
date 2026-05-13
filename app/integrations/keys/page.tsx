import { ConnectKeysManager } from '@/components/integrations/connect-keys-manager'

export const metadata = {
  title: 'API Keys | Integration Settings',
  description: 'Manage your API keys for service integrations',
}

export default function ConnectKeysPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12">
      <div className="container max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">API Keys</h1>
          <p className="text-slate-600">
            Generate and manage Connect Keys to integrate our services into your application
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Manager */}
          <div className="lg:col-span-2">
            <ConnectKeysManager />
          </div>

          {/* Right Column - Documentation */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <h3 className="font-semibold mb-3">Quick Start</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-blue-600 mb-1">1. Generate a Key</p>
                  <p className="text-slate-600">Create a new API key from the form on the left.</p>
                </div>
                <div>
                  <p className="font-medium text-blue-600 mb-1">2. Copy the Key</p>
                  <p className="text-slate-600">Save your key securely. It won't be shown again.</p>
                </div>
                <div>
                  <p className="font-medium text-blue-600 mb-1">3. Start Integrating</p>
                  <p className="text-slate-600">Use the key with the X-Connect-Key header.</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <h3 className="font-semibold mb-3">Security Tips</h3>
              <ul className="text-sm space-y-2 text-slate-600">
                <li>• Keep keys private and secure</li>
                <li>• Never commit keys to git</li>
                <li>• Use environment variables</li>
                <li>• Rotate keys regularly</li>
                <li>• Revoke unused keys</li>
              </ul>
            </div>

            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h3 className="font-semibold mb-3 text-blue-900">Base URL</h3>
              <code className="text-xs font-mono bg-white p-2 rounded block text-blue-600 break-all">
                https://mozosubz.xyz/api/integrations
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
