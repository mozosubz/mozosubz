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

      {/* API Reference - Complete Postman Style */}
      <section className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <p className="text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wider">API Reference</p>
            <h2 className="text-2xl font-bold text-slate-900">All Endpoints</h2>
            <p className="text-sm text-slate-600 mt-2">Complete Mozosubz API documentation. Use these for WhatsApp bot integration.</p>
          </div>

          {/* WhatsApp Auth Endpoints */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase">WhatsApp Authentication</h3>
            <div className="space-y-3">
              {/* Connect Token */}
              <div className="rounded-lg bg-white border border-slate-200 overflow-hidden hover:border-blue-300 transition">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-mono font-bold rounded">POST</span>
                    <code className="text-sm font-mono font-semibold text-slate-900">/api/whatsapp/connect-token</code>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-600 mb-2">Generate 10-minute token for linking WhatsApp</p>
                  <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-100">{`Authorization: Bearer <jwt>

{
  "token": "MZ_3A7B9C2F",
  "expires_in_minutes": 10
}`}</pre>
                  </div>
                </div>
              </div>

              {/* Connect */}
              <div className="rounded-lg bg-white border border-slate-200 overflow-hidden hover:border-blue-300 transition">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-mono font-bold rounded">POST</span>
                    <code className="text-sm font-mono font-semibold text-slate-900">/api/whatsapp/connect</code>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-600 mb-2">Link WhatsApp to account</p>
                  <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-100">{`{
  "whatsapp_number": "+2349056458312",
  "token": "MZ_3A7B9C2F"
}

{
  "success": true,
  "user_id": "uuid"
}`}</pre>
                  </div>
                </div>
              </div>

              {/* Authenticate */}
              <div className="rounded-lg bg-white border border-slate-200 overflow-hidden hover:border-blue-300 transition">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-mono font-bold rounded">POST</span>
                    <code className="text-sm font-mono font-semibold text-slate-900">/api/whatsapp/authenticate</code>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-600 mb-2">Resolve WhatsApp number to user_id</p>
                  <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-100">{`{
  "whatsapp_number": "+2349056458312"
}

{
  "success": true,
  "authenticated": true,
  "user_id": "uuid"
}`}</pre>
                  </div>
                </div>
              </div>

              {/* Balance */}
              <div className="rounded-lg bg-white border border-slate-200 overflow-hidden hover:border-blue-300 transition">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-mono font-bold rounded">POST</span>
                    <code className="text-sm font-mono font-semibold text-slate-900">/api/whatsapp/balance</code>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-600 mb-2">Get wallet balance</p>
                  <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-100">{`{
  "whatsapp_number": "+2349056458312"
}

{
  "success": true,
  "user_id": "uuid",
  "wallet_balance": 15000,
  "user_name": "Igangan Godspower"
}`}</pre>
                  </div>
                </div>
              </div>

              {/* Deposit */}
              <div className="rounded-lg bg-white border border-slate-200 overflow-hidden hover:border-blue-300 transition">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-mono font-bold rounded">POST</span>
                    <code className="text-sm font-mono font-semibold text-slate-900">/api/whatsapp/deposit</code>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-600 mb-2">Initiate deposit</p>
                  <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-100">{`{
  "whatsapp_number": "+2349056458312",
  "amount": 5000
}

{
  "success": true,
  "user_id": "uuid",
  "amount": 5000
}`}</pre>
                  </div>
                </div>
              </div>

              {/* Disconnect */}
              <div className="rounded-lg bg-white border border-slate-200 overflow-hidden hover:border-blue-300 transition">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-mono font-bold rounded">POST</span>
                    <code className="text-sm font-mono font-semibold text-slate-900">/api/whatsapp/disconnect</code>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-600 mb-2">Unlink WhatsApp from account</p>
                  <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-100">{`Authorization: Bearer <jwt>

{
  "success": true
}`}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Service Endpoints */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase">Services - All Networks & Plans</h3>
            <div className="space-y-3">
              {/* Get Plans */}
              <div className="rounded-lg bg-white border border-slate-200 overflow-hidden hover:border-blue-300 transition">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-mono font-bold rounded">GET</span>
                    <code className="text-sm font-mono font-semibold text-slate-900">/api/gsubz/plans</code>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-600 mb-2">Get all available plans for any service/network</p>
                  <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-100 whitespace-pre-wrap break-words">{`GET /api/gsubz/plans?service=MTN

Response Example:
{
  "success": true,
  "plans": [
    {
      "id": "mtn_500mb",
      "displayName": "500MB",
      "value": "500MB",
      "price": 100,
      "duration": "7 days"
    },
    {
      "id": "mtn_1gb",
      "displayName": "1GB",
      "value": "1GB",
      "price": 200,
      "duration": "30 days"
    },
    {
      "id": "mtn_2gb",
      "displayName": "2GB",
      "value": "2GB",
      "price": 300,
      "duration": "30 days"
    }
  ]
}

SERVICES: MTN, AIRTEL, GLO, 9MOBILE
CABLE: DSTV, GOTV, STARTIMES
DATA PLANS: 100MB, 200MB, 500MB, 750MB, 1GB, 2GB, 3GB, 5GB, 10GB
CABLE PLANS: Starter, Family, Premium, SuperFamily`}</pre>
                  </div>
                </div>
              </div>

              {/* Airtime Purchase */}
              <div className="rounded-lg bg-white border border-slate-200 overflow-hidden hover:border-blue-300 transition">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-mono font-bold rounded">POST</span>
                    <code className="text-sm font-mono font-semibold text-slate-900">/api/gsubz/airtime/purchase</code>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-600 mb-2">Buy airtime for any network (any amount)</p>
                  <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-100">{`{
  "network": "MTN|AIRTEL|GLO|9MOBILE",
  "phone": "09056458312",
  "amount": 100
}

{
  "success": true,
  "transactionId": "TXN_123",
  "network": "MTN",
  "amount": 100,
  "phone": "09056458312"
}`}</pre>
                  </div>
                </div>
              </div>

              {/* Data Purchase */}
              <div className="rounded-lg bg-white border border-slate-200 overflow-hidden hover:border-blue-300 transition">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-mono font-bold rounded">POST</span>
                    <code className="text-sm font-mono font-semibold text-slate-900">/api/gsubz/data/purchase</code>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-600 mb-2">Buy data for MTN, Airtel, Glo, 9Mobile (with plan variants)</p>
                  <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-100">{`REQUEST:
{
  "network": "MTN|AIRTEL|GLO|9MOBILE",
  "phone": "09056458312",
  "plan_id": "mtn_1gb",
  "amount": 250
}

RESPONSE:
{
  "success": true,
  "transactionId": "TXN_456",
  "network": "MTN",
  "plan": "1GB",
  "duration": "30 days",
  "amount": 250,
  "phone": "09056458312",
  "activated_at": "2024-01-15T10:30:00Z"
}

NOTE: Use /api/gsubz/plans?service=MTN to get 
all available plan IDs with different sizes/prices`}</pre>
                  </div>
                </div>
              </div>

              {/* Cable Subscribe */}
              <div className="rounded-lg bg-white border border-slate-200 overflow-hidden hover:border-blue-300 transition">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-mono font-bold rounded">POST</span>
                    <code className="text-sm font-mono font-semibold text-slate-900">/api/gsubz/cable/subscribe</code>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-600 mb-2">Subscribe to cable TV (DSTV, GOTV, Startimes)</p>
                  <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-100">{`REQUEST:
{
  "provider": "DSTV|GOTV|STARTIMES",
  "customer_id": "12345678",
  "plan_id": "dstv_starter",
  "amount": 2500
}

RESPONSE:
{
  "success": true,
  "transactionId": "TXN_789",
  "provider": "DSTV",
  "customer_id": "12345678",
  "plan": "Starter Pack",
  "amount": 2500,
  "expiry": "2024-02-15T00:00:00Z"
}

PLANS:
DSTV: Starter, Family, Premium, SuperFamily, MaxFamily
GOTV: Max, Plus, Standard, Lite
STARTIMES: SmartMax, SmartPlus, Smart, Basic`}</pre>
                  </div>
                </div>
              </div>

              {/* Electricity */}
              <div className="rounded-lg bg-white border border-slate-200 overflow-hidden hover:border-blue-300 transition">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-mono font-bold rounded">POST</span>
                    <code className="text-sm font-mono font-semibold text-slate-900">/api/gsubz/electricity/purchase</code>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-600 mb-2">Pay for electricity (IKEDC, KEDCO, EEDC, etc)</p>
                  <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-100">{`REQUEST:
{
  "provider": "IKEDC|KEDCO|EEDC|BEDC|AEDC|PHED|YEDC",
  "customer_id": "12345678",
  "amount": 5000
}

RESPONSE:
{
  "success": true,
  "transactionId": "TXN_101",
  "provider": "IKEDC",
  "customer_id": "12345678",
  "customer_name": "John Doe",
  "amount_paid": 5000,
  "tokens_generated": 1234567890123456,
  "paid_at": "2024-01-15T10:30:00Z"
}

PROVIDERS: IKEDC, KEDCO, EEDC, BEDC, AEDC, PHED, YEDC`}</pre>
                  </div>
                </div>
              </div>

              {/* Recharge Pins */}
              <div className="rounded-lg bg-white border border-slate-200 overflow-hidden hover:border-blue-300 transition">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-mono font-bold rounded">POST</span>
                    <code className="text-sm font-mono font-semibold text-slate-900">/api/gsubz/recharge-pins/purchase</code>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-600 mb-2">Generate recharge pins for any network</p>
                  <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-100">{`REQUEST:
{
  "network": "MTN|AIRTEL|GLO|9MOBILE",
  "value": 500,
  "quantity": 5
}

RESPONSE:
{
  "success": true,
  "pins": [
    "1234-5678-9101-1121",
    "1314-1516-1718-1920",
    "2122-2324-2526-2728",
    "2930-3132-3334-3536",
    "3738-3940-4142-4344"
  ],
  "network": "MTN",
  "value_per_pin": 500,
  "total_cost": 2500
}

PIN VALUES: 100, 200, 500, 1000, 2000, 5000`}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Endpoints */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase">Payments</h3>
            <div className="space-y-3">
              {/* Deposit Start */}
              <div className="rounded-lg bg-white border border-slate-200 overflow-hidden hover:border-blue-300 transition">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-mono font-bold rounded">POST</span>
                    <code className="text-sm font-mono font-semibold text-slate-900">/api/deposit/start</code>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-600 mb-2">Initiate wallet deposit payment</p>
                  <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-100">{`Authorization: Bearer <jwt>

{
  "amount": 5000
}

{
  "success": true,
  "payment_reference": "ref_123"
}`}</pre>
                  </div>
                </div>
              </div>

              {/* Payment Verify */}
              <div className="rounded-lg bg-white border border-slate-200 overflow-hidden hover:border-blue-300 transition">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-mono font-bold rounded">GET</span>
                    <code className="text-sm font-mono font-semibold text-slate-900">/api/payments/verify</code>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-slate-600 mb-2">Verify payment status</p>
                  <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                    <pre className="text-xs font-mono text-slate-100">{`GET /api/payments/verify?reference=ref_123

{
  "success": true,
  "status": "PAID",
  "amount": 5000
}`}</pre>
                  </div>
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
