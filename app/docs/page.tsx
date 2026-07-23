import { ArrowLeft, Download, FileText } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Documentation",
  description: "Download API documentation and guides",
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Documentation</h1>
          <p className="text-gray-600 mt-2">Download API guides and implementation documentation</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-4">
          {/* Bot Auth API Documentation */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Bot Authentication API</h2>
                  <p className="text-sm text-gray-600 mt-2">
                    Complete documentation for all bot authentication endpoints including connect, disconnect, list connections, and unlink accounts.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                      ✓ 6 Endpoints
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                      ✓ Connect Key Auth
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                      ✓ curl Examples
                    </span>
                  </div>
                </div>
              </div>
              <a
                href="/BOT_AUTH_API.md"
                download="BOT_AUTH_API.md"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex-shrink-0 whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-4">
            <h3 className="font-bold text-gray-900 mb-3">Available Endpoints</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• <strong>POST /api/v1/bot-auth/connect</strong> - Connect a new bot account</li>
              <li>• <strong>DELETE /api/v1/bot-auth/disconnect</strong> - Disconnect a bot account</li>
              <li>• <strong>GET /api/v1/bot-auth/connections</strong> - List all connected bots</li>
              <li>• <strong>DELETE /api/v1/bot-auth/unlink?platform=telegram</strong> - Unlink bot by platform</li>
              <li>• <strong>POST /api/v1/bot-auth/status</strong> - Get bot status and info</li>
              <li>• <strong>GET /api/v1/bot-auth/settings</strong> - Get bot settings</li>
            </ul>
          </div>

          {/* Authentication Info */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mt-4">
            <h3 className="font-bold text-gray-900 mb-3">Authentication</h3>
            <p className="text-sm text-gray-700 mb-3">All endpoints require the <code className="bg-gray-200 px-2 py-1 rounded">X-Connect-Key</code> header:</p>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`curl -X GET \\
  "https://api.mozosubz.xyz/api/v1/bot-auth/connections" \\
  -H "X-Connect-Key: your_connect_key"`}
            </pre>
          </div>
        </div>
      </main>
    </div>
  )
}
