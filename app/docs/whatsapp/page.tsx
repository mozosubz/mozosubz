import { Lock, Zap, FileText } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { Footer } from "@/components/footer"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "WhatsApp API Documentation - Mozosubz",
  description: "Complete Mozosubz API documentation for WhatsApp integration",
}

export default function WhatsAppDocsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col">
      <SiteHeader />

      {/* Hero */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-16 pb-14 md:pt-24 md:pb-20 overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{
          backgroundImage: "radial-gradient(circle at 20% 0%, rgba(37,99,235,0.08), transparent 50%), radial-gradient(circle at 85% 20%, rgba(16,185,129,0.05), transparent 55%)",
        }} />
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-700 mb-6">
            WhatsApp Integration
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-[1.08]">
            WhatsApp + <span className="text-blue-600">Mozosubz</span> API
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Complete API documentation for building WhatsApp bots that handle airtime, data, cable, electricity, and more.
          </p>
        </div>
      </section>

      {/* Architecture */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-12">How It Works</h2>
          <div className="rounded-2xl bg-white border border-slate-200 p-8 overflow-x-auto mb-10">
            <pre className="text-sm font-mono text-slate-700">{`WhatsApp Bot + AI
        ↓
Mozosubz WhatsApp Auth Layer
        ↓
Mozosubz Service APIs
(Airtime, Data, Cable, Electricity, Pins)
        ↓
Database / Service Providers`}</pre>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-xl bg-white border border-slate-200 p-6">
              <Lock className="w-5 h-5 text-blue-600 mb-4" />
              <h3 className="font-bold text-slate-900 mb-2">Auth</h3>
              <p className="text-sm text-slate-600">Link WhatsApp securely with temporary tokens</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-6">
              <Zap className="w-5 h-5 text-blue-600 mb-4" />
              <h3 className="font-bold text-slate-900 mb-2">Resolve</h3>
              <p className="text-sm text-slate-600">Get user_id from WhatsApp number</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-6">
              <FileText className="w-5 h-5 text-blue-600 mb-4" />
              <h3 className="font-bold text-slate-900 mb-2">Proxy</h3>
              <p className="text-sm text-slate-600">Call existing Mozosubz APIs directly</p>
            </div>
          </div>
        </div>
      </section>

      {/* Complete API Reference */}
      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-3">Complete API Reference</h2>
          <p className="text-slate-600 mb-12">All Mozosubz endpoints for WhatsApp integration. All FormData POST endpoints use multipart/form-data.</p>

          {/* WhatsApp Auth */}
          <div className="mb-12">
            <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">WhatsApp Authentication</h3>
            <div className="space-y-3">
              <EndpointCard method="POST" path="/api/whatsapp/connect-token" desc="Generate linking token" code={`Authorization: Bearer <jwt>

{ "token": "MZ_xxx", "expires_in_minutes": 10 }`} />
              <EndpointCard method="POST" path="/api/whatsapp/connect" desc="Link WhatsApp to account" code={`whatsapp_number: "+2349056458312"
token: "MZ_xxx"

{ "success": true, "user_id": "uuid" }`} />
              <EndpointCard method="POST" path="/api/whatsapp/authenticate" desc="Resolve WhatsApp to user_id" code={`whatsapp_number: "+2349056458312"

{ "success": true, "authenticated": true, "user_id": "uuid" }`} />
              <EndpointCard method="POST" path="/api/whatsapp/balance" desc="Get wallet balance" code={`whatsapp_number: "+2349056458312"

{ "success": true, "user_id": "uuid", "wallet_balance": 15000, "user_name": "Name" }`} />
              <EndpointCard method="POST" path="/api/whatsapp/deposit" desc="Initiate deposit" code={`whatsapp_number: "+2349056458312"
amount: "5000"

{ "success": true, "user_id": "uuid", "amount": 5000 }`} />
              <EndpointCard method="POST" path="/api/whatsapp/disconnect" desc="Unlink WhatsApp" code={`Authorization: Bearer <jwt>

{ "success": true }`} />
            </div>
          </div>

          {/* Service APIs */}
          <div className="mb-12">
            <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Mozosubz Service APIs</h3>
            <div className="space-y-3">
              <EndpointCard method="GET" path="/api/gsubz/plans" desc="Get all plan variants (different sizes/prices)" code={`?service=MTN&type=DATA

{ "plans": [
  { "displayName": "500MB", "value": "500MB", "price": "100" },
  { "displayName": "1GB (30d)", "value": "1GB_30D", "price": "250" },
  { "displayName": "1GB (7d)", "value": "1GB_7D", "price": "200" }
] }`} />
              <EndpointCard method="POST" path="/api/gsubz/data/purchase" desc="Buy data (use value from plans)" code={`network: "MTN|AIRTEL|GLO|9MOBILE"
phone: "09056458312"
plan: "1GB_30D"
amount: "250"

{ "success": true, "transactionId": "TXN_123" }`} />
              <EndpointCard method="POST" path="/api/gsubz/airtime/purchase" desc="Buy airtime" code={`network: "MTN|AIRTEL|GLO|9MOBILE"
phone: "09056458312"
amount: "500"

{ "success": true, "transactionId": "TXN_456" }`} />
              <EndpointCard method="POST" path="/api/gsubz/cable/subscribe" desc="Subscribe to cable TV" code={`provider: "DSTV|GOTV|STARTIMES"
customerID: "12345678"
plan: "dstv_starter"
amount: "2500"

PLANS: DSTV(Starter,Family,Premium,SuperFamily), GOTV(Max,Plus,Standard), STARTIMES(SmartMax,SmartPlus)

{ "success": true, "transactionId": "TXN_789" }`} />
              <EndpointCard method="POST" path="/api/gsubz/electricity/purchase" desc="Buy electricity tokens" code={`provider: "IKEDC|KEDCO|EEDC|BEDC|AEDC|PHED|YEDC"
customerID: "12345678"
amount: "5000"
variation_code: "POSTPAID"

{ "success": true, "token": "1234567890123456" }`} />
              <EndpointCard method="POST" path="/api/gsubz/recharge-pins/purchase" desc="Generate recharge pins" code={`network: "MTN|AIRTEL|GLO|9MOBILE"
value: "500"
quantity: "5"

VALUES: 100,200,500,1000,2000,5000

{ "success": true, "pins": ["1234-5678-9101-1121", ...] }`} />
            </div>
          </div>

          {/* Payment APIs */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Payment APIs</h3>
            <div className="space-y-3">
              <EndpointCard method="POST" path="/api/deposit/start" desc="Initiate wallet deposit" code={`Authorization: Bearer <jwt>
amount: "5000"

{ "success": true, "payment_reference": "ref_123" }`} />
              <EndpointCard method="GET" path="/api/payments/verify" desc="Verify payment status" code={`?reference=ref_123

{ "success": true, "status": "PAID", "amount": 5000 }`} />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

function EndpointCard({ method, path, desc, code }: { method: string; path: string; desc: string; code: string }) {
  const bgColor = method === "GET" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
  return (
    <div className="rounded-lg bg-white border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
        <span className={`px-2 py-1 text-xs font-mono font-bold rounded ${bgColor}`}>{method}</span>
        <code className="text-sm font-mono font-semibold text-slate-900">{path}</code>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-slate-600 mb-2">{desc}</p>
        <div className="bg-slate-900 rounded p-3 overflow-x-auto">
          <pre className="text-xs font-mono text-slate-100 whitespace-pre-wrap break-words">{code}</pre>
        </div>
      </div>
    </div>
  )
}
