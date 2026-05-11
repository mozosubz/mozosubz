import { Code, ArrowRight, Check, Lock, Zap, FileText } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { Footer } from "@/components/footer"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "WhatsApp API Documentation - Mozosubz",
  description: "Learn how to integrate Mozosubz with WhatsApp. Secure authentication, user linking, and transaction proxying for WhatsApp bots.",
  keywords: "whatsapp api, whatsapp integration, whatsapp bot, mozosubz api, developer documentation",
  alternates: {
    canonical: "https://mozosubz.xyz/docs/whatsapp",
  },
}

export default function WhatsAppDocsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col">
      <SiteHeader />

      {/* Hero */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-16 pb-14 md:pt-24 md:pb-20 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 0%, rgba(37,99,235,0.08), transparent 50%), radial-gradient(circle at 85% 20%, rgba(16,185,129,0.05), transparent 55%)",
          }}
        />
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-700 mb-6">
            WhatsApp Integration
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-[1.08] text-balance">
            Connect WhatsApp to <span className="text-blue-600">Mozosubz</span>
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed text-pretty max-w-2xl mx-auto">
            Securely link your WhatsApp number to your Mozosubz account and use our API to build WhatsApp bots that can handle transactions without managing authentication.
          </p>
        </div>
      </section>

      {/* Architecture */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-semibold text-blue-600 mb-3 uppercase tracking-wider">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">Architecture Overview</h2>
            <p className="text-slate-600 leading-relaxed">
              The WhatsApp Integration API is a thin authentication and linking layer. It handles user verification and account linking — your bot handles everything else.
            </p>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-8 overflow-x-auto">
            <pre className="text-sm font-mono text-slate-700 whitespace-pre">
{`WhatsApp Bot + AI
        ↓
Mozosubz WhatsApp Auth/API Layer
        ↓
Existing Mozosubz APIs
(Airtime, Data, Cable, Electricity, etc.)
        ↓
Database / Service Providers`}
            </pre>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-10">
            <div className="rounded-xl bg-white border border-slate-200 p-6">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Authentication</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Users generate a temporary token from their profile, send it to your WhatsApp bot, and link their number securely.
              </p>
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-6">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Resolution</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Your bot calls our authenticate endpoint with the WhatsApp number to resolve the Mozosubz user ID.
              </p>
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-6">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Proxy</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Your bot makes standard requests to existing Mozosubz APIs using the resolved user ID. No changes to existing endpoints.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Endpoints */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-semibold text-blue-600 mb-3 uppercase tracking-wider">API Reference</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">Four Core Endpoints</h2>
          </div>

          <div className="space-y-6">
            {/* Generate Token */}
            <div className="rounded-2xl bg-white border border-slate-200 p-8 hover:border-blue-200 transition">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-mono font-bold text-sm">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 mb-2 font-mono">POST /api/whatsapp/connect-token</h3>
                  <p className="text-slate-600 mb-4 leading-relaxed">
                    Generate a temporary 10-minute token for WhatsApp linking. Called from the user's Mozosubz profile.
                  </p>
                  <div className="bg-slate-50 rounded-lg p-4 mb-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-700">{`Authorization: Bearer <user_jwt_token>

Response:
{
  "success": true,
  "token": "MZ_3A7B9C2F",
  "expires_in_minutes": 10
}`}</pre>
                  </div>
                  <p className="text-sm text-slate-600">
                    <strong>Security:</strong> Token is hashed before storage, one-use only, user must be authenticated.
                  </p>
                </div>
              </div>
            </div>

            {/* Connect WhatsApp */}
            <div className="rounded-2xl bg-white border border-slate-200 p-8 hover:border-blue-200 transition">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-mono font-bold text-sm">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 mb-2 font-mono">POST /api/whatsapp/connect</h3>
                  <p className="text-slate-600 mb-4 leading-relaxed">
                    Verify the token and link a WhatsApp number to the Mozosubz account. Called by your WhatsApp bot.
                  </p>
                  <div className="bg-slate-50 rounded-lg p-4 mb-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-700">{`Request:
{
  "whatsapp_number": "+2349056458312",
  "token": "MZ_3A7B9C2F"
}

Response:
{
  "success": true,
  "message": "WhatsApp connected successfully",
  "user_id": "user_id"
}`}</pre>
                  </div>
                  <p className="text-sm text-slate-600">
                    <strong>Validation:</strong> Token is verified, checked for expiry, and marked as used.
                  </p>
                </div>
              </div>
            </div>

            {/* Authenticate */}
            <div className="rounded-2xl bg-white border border-slate-200 p-8 hover:border-blue-200 transition">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-mono font-bold text-sm">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 mb-2 font-mono">POST /api/whatsapp/authenticate</h3>
                  <p className="text-slate-600 mb-4 leading-relaxed">
                    Resolve a WhatsApp number to a Mozosubz user ID. Called before executing any transaction.
                  </p>
                  <div className="bg-slate-50 rounded-lg p-4 mb-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-700">{`Request:
{
  "whatsapp_number": "+2349056458312"
}

Response (Linked):
{
  "success": true,
  "authenticated": true,
  "user_id": "user_id"
}

Response (Not Linked):
{
  "success": false,
  "authenticated": false
}`}</pre>
                  </div>
                  <p className="text-sm text-slate-600">
                    <strong>Important:</strong> Always call this before making transaction requests to ensure the user is linked.
                  </p>
                </div>
              </div>
            </div>

            {/* Disconnect */}
            <div className="rounded-2xl bg-white border border-slate-200 p-8 hover:border-blue-200 transition">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-mono font-bold text-sm">
                  4
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 mb-2 font-mono">POST /api/whatsapp/disconnect</h3>
                  <p className="text-slate-600 mb-4 leading-relaxed">
                    Unlink a WhatsApp number from a Mozosubz account. Called from the user's profile.
                  </p>
                  <div className="bg-slate-50 rounded-lg p-4 mb-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-700">{`Authorization: Bearer <user_jwt_token>

Response:
{
  "success": true
}`}</pre>
                  </div>
                  <p className="text-sm text-slate-600">
                    <strong>Effect:</strong> All future WhatsApp requests from this number are rejected until linked again.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Best Practices */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-semibold text-blue-600 mb-3 uppercase tracking-wider">Security</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">Best Practices</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl bg-white border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-600" />
                DO
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>• Authenticate before every transaction</li>
                <li>• Hash tokens on your end too</li>
                <li>• Validate WhatsApp numbers format</li>
                <li>• Handle rate limits gracefully</li>
                <li>• Log all failed authentications</li>
              </ul>
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 text-red-600 flex items-center justify-center">✕</span>
                DON'T
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>• Trust user_id from WhatsApp</li>
                <li>• Cache authentication indefinitely</li>
                <li>• Send tokens in cleartext</li>
                <li>• Bypass WhatsApp→user resolution</li>
                <li>• Store provider secrets in your code</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Integration Flow */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-semibold text-blue-600 mb-3 uppercase tracking-wider">Implementation</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">Full Integration Example</h2>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-6 py-4 border-b border-slate-200">
              <p className="text-sm font-mono font-bold text-slate-700">Workflow: Buy 1GB MTN via WhatsApp</p>
            </div>
            <div className="p-8 space-y-6">
              {[
                {
                  num: "1",
                  title: "User starts bot",
                  desc: "User texts your bot, requests 1GB MTN data",
                },
                {
                  num: "2",
                  title: "Bot authenticates",
                  desc: "Bot calls POST /api/whatsapp/authenticate with user's WhatsApp number",
                },
                {
                  num: "3",
                  title: "Bot gets user_id",
                  desc: "If authenticated, Mozosubz returns the linked user_id",
                },
                {
                  num: "4",
                  title: "Bot fetches plans",
                  desc: "Bot calls existing /api/gsubz/plans with user_id to get 1GB options",
                },
                {
                  num: "5",
                  title: "Bot selects plan",
                  desc: "Bot AI parses plans, asks user if multiple options exist, gets uniqueId",
                },
                {
                  num: "6",
                  title: "Bot purchases",
                  desc: "Bot calls existing /api/gsubz/data/purchase with user_id and plan uniqueId",
                },
                {
                  num: "7",
                  title: "User gets data",
                  desc: "Mozosubz handles entire transaction — bot never touches provider secrets",
                },
              ].map((step) => (
                <div key={step.num} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 font-mono font-bold text-sm">
                    {step.num}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">{step.title}</h4>
                    <p className="text-sm text-slate-600">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-20 bg-blue-50 border-y border-blue-100">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance text-slate-900">Ready to build?</h2>
          <p className="text-lg text-slate-700 mb-8 max-w-2xl mx-auto leading-relaxed">
            Start by connecting WhatsApp to your account, then integrate with the API in your WhatsApp bot project.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/dashboard/profile"
              className="inline-flex items-center justify-center px-7 py-3.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              Connect WhatsApp
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
            <a
              href="/docs/WHATSAPP_API.md"
              className="inline-flex items-center justify-center px-7 py-3.5 border border-blue-300 text-blue-700 font-semibold rounded-lg hover:bg-blue-100 transition"
            >
              <Code className="w-4 h-4 mr-2" />
              Full API Reference
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
