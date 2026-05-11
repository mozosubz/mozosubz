import { SiteHeader } from "@/components/site-header"
import { Footer } from "@/components/footer"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "WhatsApp API Documentation - Mozosubz",
  description: "Complete Mozosubz WhatsApp API documentation with all services and examples",
}

export default function WhatsAppDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Mozosubz WhatsApp API</h1>
          <p className="text-lg text-gray-600">
            Complete documentation for integrating Mozosubz services via WhatsApp
          </p>
        </div>

        {/* Base URL */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-12">
          <h2 className="text-xl font-bold mb-2">Base URL</h2>
          <code className="text-lg font-mono bg-white px-3 py-2 rounded border">
            api.mozosubz.xyz
          </code>
        </div>

        {/* Authentication */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Authentication</h2>
          <div className="bg-gray-50 p-6 rounded-lg mb-4">
            <h3 className="font-bold mb-2">Step 1: Generate Connect Token</h3>
            <code className="block bg-white p-3 rounded font-mono text-sm mb-3 whitespace-pre-wrap break-words">
{`POST /api/whatsapp/connect-token
Authorization: Bearer <user_jwt>

Response:
{
  "success": true,
  "token": "MZ_abc123xyz",
  "expires_in_minutes": 10,
  "instructions": "Send 'CONNECT MZ_abc123xyz' to WhatsApp bot"
}`}
            </code>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="font-bold mb-2">Step 2: WhatsApp Bot Completes Link</h3>
            <code className="block bg-white p-3 rounded font-mono text-sm whitespace-pre-wrap break-words">
{`POST /api/whatsapp/connect
Content-Type: application/json

{
  "whatsapp_phone": "+2349056458312",
  "token": "MZ_abc123xyz"
}

Response:
{
  "success": true,
  "user_id": "uuid",
  "whatsapp_phone": "+2349056458312",
  "verified_at": "2024-01-15T10:30:00Z"
}`}
            </code>
          </div>
        </section>

        {/* User Authenticate */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Authenticate WhatsApp User</h2>
          <p className="text-gray-600 mb-4">
            Before any transaction, resolve the WhatsApp number to user profile:
          </p>
          <code className="block bg-gray-900 text-white p-6 rounded-lg font-mono text-sm overflow-x-auto mb-4 whitespace-pre-wrap break-words">
{`POST /api/whatsapp/authenticate
Content-Type: application/json

{
  "whatsapp_phone": "+2349056458312"
}

Response (Linked):
{
  "success": true,
  "authenticated": true,
  "user_id": "uuid",
  "profile": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "phone_number": "09056458312",
    "wallet_balance": 15000,
    "is_admin": false
  }
}

Response (Not Linked):
{
  "success": true,
  "authenticated": false
}`}
          </code>
        </section>

        {/* Data Plans */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Data Service</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-3">Get Data Plans</h3>
            <p className="text-gray-600 mb-4">
              Each network has multiple plan types. Get all plans with markup already applied:
            </p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <h4 className="font-bold mb-2">MTN Plan Types:</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li><code className="bg-gray-100 px-2 py-1 rounded">mtn_sme</code> - SME Plans</li>
                  <li><code className="bg-gray-100 px-2 py-1 rounded">mtn_datashare</code> - Data Share</li>
                  <li><code className="bg-gray-100 px-2 py-1 rounded">mtn_gifting</code> - Gift Plans</li>
                  <li><code className="bg-gray-100 px-2 py-1 rounded">mtn_awoof</code> - Promo Plans</li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-2">Other Networks:</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li><code className="bg-gray-100 px-2 py-1 rounded">glo_data</code> - Glo Data</li>
                  <li><code className="bg-gray-100 px-2 py-1 rounded">glo_sme</code> - Glo SME</li>
                  <li><code className="bg-gray-100 px-2 py-1 rounded">airtel_sme</code> - Airtel SME</li>
                  <li><code className="bg-gray-100 px-2 py-1 rounded">airtel_gifting</code> - Airtel Gift</li>
                  <li><code className="bg-gray-100 px-2 py-1 rounded">etisalat_data</code> - Etisalat</li>
                </ul>
              </div>
            </div>

            <code className="block bg-gray-900 text-white p-6 rounded-lg font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words">
{`POST /api/whatsapp/data/plans
Content-Type: application/json

{
  "network": "MTN"
}

Response:
{
  "success": true,
  "network": "MTN",
  "planTypes": [
    {
      "id": "mtn_sme",
      "label": "SME",
      "plans": [
        {
          "displayName": "500MB",
          "value": "500MB",
          "price": 500,          // <-- INCLUDES MARKUP
          "validity": "30 days"
        },
        {
          "displayName": "1GB",
          "value": "1GB",
          "price": 1000,
          "validity": "30 days"
        },
        {
          "displayName": "2GB",
          "value": "2GB",
          "price": 2000,
          "validity": "30 days"
        }
      ]
    },
    {
      "id": "mtn_gifting",
      "label": "Gifting",
      "plans": [
        {
          "displayName": "500MB Gift",
          "value": "500MB_GIFT",
          "price": 450,
          "validity": "7 days"
        },
        ...
      ]
    },
    {
      "id": "mtn_awoof",
      "label": "Awoof Promo",
      "plans": [...]
    },
    {
      "id": "mtn_datashare",
      "label": "Data Share",
      "plans": [...]
    }
  ]
}`}
            </code>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-bold mb-3">Purchase Data</h3>
            <code className="block bg-gray-900 text-white p-6 rounded-lg font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words">
{`POST /api/whatsapp/data/purchase
Content-Type: application/json

{
  "whatsappPhone": "+2349056458312",
  "network": "MTN",
  "planType": "mtn_sme",
  "amount": "1000"
}

Response:
{
  "success": true,
  "transactionId": "txn_12345abc",
  "amount": "1000",
  "network": "MTN",
  "planType": "mtn_sme",
  "message": "Data purchased successfully"
}`}
            </code>
          </div>
        </section>

        {/* Cable Plans */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Cable Service</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-3">Get Cable Plans</h3>
            <p className="text-gray-600 mb-4">
              Each cable provider has different plan packages:
            </p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <h4 className="font-bold mb-2">DSTV Plans:</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Starter</li>
                  <li>Family</li>
                  <li>Premium</li>
                  <li>SuperFamily</li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-2">GOTV Plans:</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Max</li>
                  <li>Plus</li>
                  <li>Standard</li>
                  <li>Lite</li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-2">Startimes Plans:</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>SmartMax</li>
                  <li>SmartPlus</li>
                  <li>Smart</li>
                  <li>Basic</li>
                </ul>
              </div>
            </div>

            <code className="block bg-gray-900 text-white p-6 rounded-lg font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words">
{`POST /api/whatsapp/cable/plans
Content-Type: application/json

{
  "provider": "DSTV"
}

Response:
{
  "success": true,
  "provider": "DSTV",
  "plans": [
    {
      "id": "dstv_starter",
      "label": "Starter",
      "price": 2500,            // <-- INCLUDES MARKUP
      "channels": 45,
      "period": "1 month"
    },
    {
      "id": "dstv_family",
      "label": "Family",
      "price": 5000,
      "channels": 100,
      "period": "1 month"
    },
    {
      "id": "dstv_premium",
      "label": "Premium",
      "price": 7500,
      "channels": 150,
      "period": "1 month"
    },
    {
      "id": "dstv_superfamily",
      "label": "SuperFamily",
      "price": 10000,
      "channels": 200,
      "period": "1 month"
    }
  ]
}`}
            </code>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-bold mb-3">Subscribe to Cable</h3>
            <code className="block bg-gray-900 text-white p-6 rounded-lg font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words">
{`POST /api/whatsapp/cable/purchase
Content-Type: application/json

{
  "whatsappPhone": "+2349056458312",
  "provider": "DSTV",
  "plan": "dstv_family",
  "customerId": "12345678",
  "amount": "5000"
}

Response:
{
  "success": true,
  "transactionId": "txn_67890def",
  "amount": "5000",
  "provider": "DSTV",
  "plan": "dstv_family",
  "customerId": "12345678",
  "message": "Cable subscription successful"
}`}
            </code>
          </div>
        </section>

        {/* Electricity */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Electricity Service</h2>
          <p className="text-gray-600 mb-4">
            Electricity has ONE plan type (amount-based). Available DISCOs:
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <h4 className="font-bold mb-2">North DISCOs:</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>KEDCO</li>
                <li>PHED</li>
                <li>YEDC</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-2">South DISCOs:</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>IKEDC</li>
                <li>EEDC</li>
                <li>BEDC</li>
                <li>AEDC</li>
              </ul>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-bold mb-3">Get Electricity Info</h3>
            <code className="block bg-gray-900 text-white p-6 rounded-lg font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words">
{`POST /api/whatsapp/electricity/plans
Content-Type: application/json

{}

Response:
{
  "success": true,
  "discos": [
    {
      "code": "IKEDC",
      "name": "Ikeja Electric",
      "minAmount": 500,
      "maxAmount": 50000
    },
    {
      "code": "EEDC",
      "name": "Enugu Electric",
      "minAmount": 500,
      "maxAmount": 50000
    },
    {
      "code": "KEDCO",
      "name": "Kano Electricity",
      "minAmount": 500,
      "maxAmount": 50000
    },
    ...
  ],
  "info": "Electricity has one plan type: amount-based purchase. Any amount from min to max per DISCO."
}`}
            </code>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-bold mb-3">Buy Electricity Token</h3>
            <code className="block bg-gray-900 text-white p-6 rounded-lg font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words">
{`POST /api/whatsapp/electricity/purchase
Content-Type: application/json

{
  "whatsappPhone": "+2349056458312",
  "disco": "IKEDC",
  "customerId": "87654321",
  "amount": "5000"
}

Response:
{
  "success": true,
  "transactionId": "txn_abc12345",
  "amount": "5000",
  "disco": "IKEDC",
  "customerId": "87654321",
  "token": "1234-5678-9012-3456",
  "message": "Electricity token purchased successfully"
}`}
            </code>
          </div>
        </section>

        {/* Error Handling */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Error Handling</h2>
          <code className="block bg-gray-900 text-white p-6 rounded-lg font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words">
{`All error responses follow this format:

{
  "success": false,
  "error": "Error message here"
}

Common Status Codes:
- 400: Invalid request (missing fields, invalid network, etc)
- 401: WhatsApp not linked to account
- 500: Server error`}
          </code>
        </section>

        {/* Quick Start */}
        <section className="mb-12 bg-green-50 p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Quick Start Example</h2>
          <code className="block bg-white p-4 rounded font-mono text-sm overflow-x-auto whitespace-pre-wrap break-words">
{`// 1. Authenticate user
const authRes = await fetch('https://api.mozosubz.xyz/api/whatsapp/authenticate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ whatsapp_phone: '+2349056458312' })
})
const auth = await authRes.json()

if (!auth.authenticated) return 'User not linked'

// 2. Get available plans
const plansRes = await fetch('https://api.mozosubz.xyz/api/whatsapp/data/plans', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ network: 'MTN' })
})
const plans = await plansRes.json()

// 3. Purchase
const purchaseRes = await fetch('https://api.mozosubz.xyz/api/whatsapp/data/purchase', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    whatsappPhone: '+2349056458312',
    network: 'MTN',
    planType: 'mtn_sme',
    amount: '1000'
  })
})
const result = await purchaseRes.json()`}
          </code>
        </section>
      </main>
      <Footer />
    </div>
  )
}
