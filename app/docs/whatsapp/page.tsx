import { SiteHeader } from "@/components/site-header"
import { Footer } from "@/components/footer"

export const metadata = {
  title: "WhatsApp Integration - Mozosubz",
  description: "Complete guide for calling Mozosubz APIs via WhatsApp",
}

export default function WhatsAppDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Mozosubz on WhatsApp</h1>
          <p className="text-xl text-slate-600">
            Complete integration guide for WhatsApp bots to access all Mozosubz services
          </p>
        </div>

        {/* Quick Start */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Quick Start</h2>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-4">
            <h3 className="font-semibold">1. Authenticate User</h3>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded overflow-x-auto text-sm">
{`POST /api/whatsapp/authenticate
{
  "whatsapp_phone": "+2349056458312"
}

Response:
{
  "success": true,
  "authenticated": true,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "profile": {
    "id": "...",
    "email": "user@example.com",
    "full_name": "John Doe",
    "wallet_balance": 50000
  }
}`}
            </pre>
            
            <h3 className="font-semibold mt-6">2. Call Any Mozosubz API</h3>
            <p className="text-slate-600">
              Use the returned <code className="bg-slate-100 px-2 py-1 rounded">user_id</code> in the request body
            </p>
          </div>
        </section>

        {/* API Flow */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">How It Works</h2>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4 py-2">
              <h3 className="font-semibold">Step 1: User sends WhatsApp message</h3>
              <p className="text-slate-600">User says: "Buy 500MB MTN"</p>
            </div>
            <div className="border-l-4 border-blue-500 pl-4 py-2">
              <h3 className="font-semibold">Step 2: Bot authenticates user</h3>
              <p className="text-slate-600">Bot calls <code className="bg-slate-100 px-2 py-1 rounded">POST /api/whatsapp/authenticate</code> with phone number</p>
            </div>
            <div className="border-l-4 border-blue-500 pl-4 py-2">
              <h3 className="font-semibold">Step 3: Bot calls Mozosubz API</h3>
              <p className="text-slate-600">Bot calls any service (airtime, data, cable, etc) with user_id</p>
            </div>
            <div className="border-l-4 border-blue-500 pl-4 py-2">
              <h3 className="font-semibold">Step 4: Send result to user</h3>
              <p className="text-slate-600">Bot sends transaction result via WhatsApp</p>
            </div>
          </div>
        </section>

        {/* WhatsApp Endpoints */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">WhatsApp Endpoints</h2>
          
          {/* Authenticate */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-blue-50 px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold">POST /api/whatsapp/authenticate</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="font-semibold text-sm mb-2">Resolve WhatsApp phone → user_id</p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
{`Request:
{
  "whatsapp_phone": "+2349056458312"
}

Response (linked):
{
  "success": true,
  "authenticated": true,
  "user_id": "uuid",
  "profile": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "phone_number": "09056458312",
    "wallet_balance": 50000,
    "is_admin": false
  }
}

Response (not linked):
{
  "success": true,
  "authenticated": false
}`}
                </pre>
              </div>
            </div>
          </div>

          {/* Connect */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-blue-50 px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold">POST /api/whatsapp/connect</h3>
            </div>
            <div className="p-4 space-y-4">
              <p className="font-semibold text-sm">Link WhatsApp to Mozosubz account</p>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
{`Request:
{
  "whatsapp_phone": "+2349056458312",
  "token": "MZ_ABC123XYZ"
}

Response:
{
  "success": true,
  "user_id": "uuid",
  "whatsapp_phone": "+2349056458312",
  "verified_at": "2024-05-11T10:30:00Z"
}`}
              </pre>
            </div>
          </div>

          {/* Disconnect */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-blue-50 px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold">POST /api/whatsapp/disconnect</h3>
            </div>
            <div className="p-4 space-y-4">
              <p className="font-semibold text-sm">Unlink WhatsApp from account</p>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
{`Body: { } (empty)

Response:
{
  "success": true
}`}
              </pre>
            </div>
          </div>
        </section>

        {/* All Services */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Call All Mozosubz Services</h2>
          <p className="text-slate-600 mb-6">
            After authenticating, use the <code className="bg-slate-100 px-2 py-1 rounded">user_id</code> to call any existing Mozosubz API:
          </p>

          {/* Airtime */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-green-50 px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold">POST /api/gsubz/airtime/purchase</h3>
            </div>
            <div className="p-4">
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
{`FormData:
  network: "MTN" | "AIRTEL" | "GLO" | "9MOBILE"
  phone: "09056458312"
  amount: "500"
  
Example:
form.append("network", "MTN")
form.append("phone", "09056458312")
form.append("amount", "500")

Response:
{
  "success": true,
  "transactionId": "TXN_123",
  "amount": 500,
  "newBalance": 49500
}`}
              </pre>
            </div>
          </div>

          {/* Data */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-green-50 px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold">POST /api/gsubz/data/purchase</h3>
            </div>
            <div className="p-4">
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
{`FormData:
  network: "MTN" | "AIRTEL" | "GLO" | "9MOBILE"
  phone: "09056458312"
  plan: "500mb" | "1gb" | "2gb" (depends on network)
  amount: "100"

First call GET /api/gsubz/data/plans?service=MTN
to see available plans and values

Response:
{
  "success": true,
  "transactionId": "TXN_456",
  "plan": "1GB",
  "duration": "30 days",
  "amount": 250,
  "newBalance": 49250
}`}
              </pre>
            </div>
          </div>

          {/* Cable */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-green-50 px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold">POST /api/gsubz/cable/subscribe</h3>
            </div>
            <div className="p-4">
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
{`FormData:
  provider: "DSTV" | "GOTV" | "STARTIMES"
  customerID: "12345678"
  plan: "dstv_starter" | "gotv_max" | etc
  amount: "2500"

Providers & Plans:
  DSTV: Starter, Family, Premium, SuperFamily
  GOTV: Max, Plus, Standard, Lite
  STARTIMES: SmartMax, SmartPlus, Smart, Basic

Response:
{
  "success": true,
  "transactionId": "TXN_789",
  "provider": "DSTV",
  "plan": "Starter",
  "amount": 2500
}`}
              </pre>
            </div>
          </div>

          {/* Electricity */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-green-50 px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold">POST /api/gsubz/electricity/purchase</h3>
            </div>
            <div className="p-4">
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
{`FormData:
  provider: "IKEDC" | "KEDCO" | "EEDC" | etc
  customerID: "12345678"
  amount: "5000"

Providers:
  IKEDC, KEDCO, EEDC, BEDC, AEDC, PHED, YEDC

Response:
{
  "success": true,
  "transactionId": "TXN_101",
  "provider": "IKEDC",
  "token": "1234567890123456",
  "amount": 5000
}`}
              </pre>
            </div>
          </div>

          {/* Wallet */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-green-50 px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold">GET /api/wallet/balance</h3>
            </div>
            <div className="p-4">
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
{`Query: ?user_id=550e8400-e29b-41d4-a716-446655440000

Response:
{
  "balance": 49250,
  "currency": "NGN",
  "lastUpdated": "2024-05-11T10:30:00Z"
}`}
              </pre>
            </div>
          </div>

          {/* Deposit */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-green-50 px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold">POST /api/deposit/start</h3>
            </div>
            <div className="p-4">
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
{`FormData:
  user_id: "550e8400-e29b-41d4-a716-446655440000"
  amount: "5000"

Response:
{
  "success": true,
  "paymentReference": "ref_ABC123",
  "amount": 5000,
  "paymentLink": "https://..."
}`}
              </pre>
            </div>
          </div>

          {/* Payment Verify */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="bg-green-50 px-4 py-3 border-b border-slate-200">
              <h3 className="font-semibold">GET /api/payments/verify</h3>
            </div>
            <div className="p-4">
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
{`Query: ?reference=ref_ABC123

Response:
{
  "success": true,
  "status": "PAID",
  "amount": 5000,
  "timestamp": "2024-05-11T10:30:00Z"
}`}
              </pre>
            </div>
          </div>
        </section>

        {/* Complete Example */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Complete Workflow Example</h2>
          <pre className="bg-slate-900 text-slate-100 p-4 rounded overflow-x-auto text-sm">
{`// 1. Authenticate User
const authRes = await fetch('https://mozosubz.com/api/whatsapp/authenticate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    whatsapp_phone: '+2349056458312'
  })
})

const { authenticated, user_id, profile } = await authRes.json()
// { authenticated: true, user_id: 'uuid-123', profile: {...} }

if (!authenticated) {
  sendWhatsApp('Please link your WhatsApp first')
  return
}

// 2. Get user's wallet balance
const balanceRes = await fetch(
  'https://mozosubz.com/api/wallet/balance?user_id=' + user_id
)
const { balance } = await balanceRes.json()
// { balance: 50000 }

// 3. User buys MTN airtime
const form = new FormData()
form.append('network', 'MTN')
form.append('phone', '09056458312')
form.append('amount', '500')

const buyRes = await fetch('https://mozosubz.com/api/gsubz/airtime/purchase', {
  method: 'POST',
  body: form
})

const { success, newBalance } = await buyRes.json()
// { success: true, newBalance: 49500 }

// 4. Send result to user
sendWhatsApp(\`✓ Airtime bought! New balance: ₦\${newBalance}\`)
`}
          </pre>
        </section>

        {/* Error Handling */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Error Handling</h2>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-4">
            <h3 className="font-semibold">All errors follow this format:</h3>
            <pre className="bg-slate-900 text-slate-100 p-3 rounded text-sm overflow-x-auto">
{`{
  "success": false,
  "error": "Human-readable error message"
}

Common errors:
- "Insufficient balance" → User needs to deposit
- "Invalid phone number" → Wrong format
- "Service unavailable" → Temporary service issue
- "User not found" → WhatsApp not linked
`}
            </pre>
          </div>
        </section>

        {/* Best Practices */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Best Practices</h2>
          <ul className="space-y-3">
            <li className="flex gap-3">
              <span className="text-blue-500 font-bold">•</span>
              <span>Always authenticate before making API calls</span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-500 font-bold">•</span>
              <span>Check balance before requesting transactions</span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-500 font-bold">•</span>
              <span>Catch errors and explain to user in plain language</span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-500 font-bold">•</span>
              <span>Use FormData for file uploads and form submissions</span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-500 font-bold">•</span>
              <span>Confirm transactions with user before processing</span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-500 font-bold">•</span>
              <span>Store user_id for the session to avoid re-authenticating</span>
            </li>
          </ul>
        </section>
      </div>

      <Footer />
    </div>
  )
}
