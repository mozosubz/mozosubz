import { SiteHeader } from "@/components/site-header"
import { Footer } from "@/components/footer"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Mozosubz WhatsApp API Documentation",
  description: "Complete API docs for Mozosubz WhatsApp integration",
}

export default function WhatsAppDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Mozosubz WhatsApp API</h1>
          <p className="text-lg text-gray-600 mb-6">
            Complete documentation for WhatsApp bot integration with Mozosubz services.
          </p>
          
          {/* Base URL */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mb-8">
            <p className="text-sm font-semibold text-gray-600 mb-2">BASE URL</p>
            <code className="text-lg font-mono text-blue-600">api.mozosubz.xyz</code>
          </div>
        </div>

        {/* Authentication Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Authentication Flow</h2>
          
          {/* Connect Token */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-bold">POST</span>
                <code className="font-mono text-gray-800">/api/whatsapp/connect-token</code>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Generate 10-minute connection token for user</p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold mb-3 text-sm">Request</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`Authorization: Bearer <jwt>

Headers:
Content-Type: application/json`}</pre>
                </div>
                
                <div>
                  <h4 className="font-bold mb-3 text-sm">Response</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "success": true,
  "token": "MZ_abc123xyz",
  "expires_in_minutes": 10,
  "instructions": "Send CONNECT MZ_abc123xyz"
}`}</pre>
                </div>
              </div>
            </div>
          </div>

          {/* Connect Endpoint */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-bold">POST</span>
                <code className="font-mono text-gray-800">/api/whatsapp/connect</code>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Called by bot to complete WhatsApp link</p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold mb-3 text-sm">Request</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "whatsapp_phone": "+2349056458312",
  "token": "MZ_abc123xyz"
}`}</pre>
                </div>
                
                <div>
                  <h4 className="font-bold mb-3 text-sm">Response</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "success": true,
  "user_id": "uuid",
  "whatsapp_phone": "+2349056458312"
}`}</pre>
                </div>
              </div>
            </div>
          </div>

          {/* Authenticate Endpoint */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-bold">POST</span>
                <code className="font-mono text-gray-800">/api/whatsapp/authenticate</code>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Resolve WhatsApp number to user profile. Call before transactions.</p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold mb-3 text-sm">Request</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "whatsapp_phone": "+2349056458312"
}`}</pre>
                </div>
                
                <div>
                  <h4 className="font-bold mb-3 text-sm">Response</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "success": true,
  "authenticated": true,
  "user_id": "uuid",
  "profile": {
    "email": "user@example.com",
    "full_name": "John Doe",
    "phone_number": "09056458312",
    "wallet_balance": 15000
  }
}`}</pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DATA SERVICES */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Data Services</h2>
          
          {/* Get Plans */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-bold">POST</span>
                <code className="font-mono text-gray-800">/api/whatsapp/data/plans</code>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Get all data plans with prices (includes markup)</p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold mb-3 text-sm">Request</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "serviceID": "mtn_sme"
}

Supported serviceIDs:
- mtn_sme
- mtn_datashare
- mtn_gifting
- mtn_awoof
- glo_data
- glo_sme
- airtel_sme
- airtel_gifting
- etisalat_data`}</pre>
                </div>
                
                <div>
                  <h4 className="font-bold mb-3 text-sm">Response</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "success": true,
  "serviceID": "mtn_sme",
  "plans": [
    {
      "id": "plan_1",
      "displayName": "500MB",
      "value": "500MB",
      "price": 100
    },
    {
      "id": "plan_2",
      "displayName": "1GB",
      "value": "1GB",
      "price": 250
    }
  ]
}`}</pre>
                </div>
              </div>
            </div>
          </div>

          {/* Purchase Data */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-bold">POST</span>
                <code className="font-mono text-gray-800">/api/whatsapp/data/purchase</code>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Buy data for customer</p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold mb-3 text-sm">Request</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "whatsappPhone": "+2349056458312",
  "serviceID": "mtn_sme",
  "phone": "09056458312",
  "value": "1GB",
  "amount": 250
}`}</pre>
                </div>
                
                <div>
                  <h4 className="font-bold mb-3 text-sm">Response</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "success": true,
  "transactionId": "TXN_123456",
  "phone": "09056458312",
  "data": "1GB",
  "amount": 250,
  "status": "successful"
}`}</pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CABLE SERVICES */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Cable Services</h2>
          
          {/* Get Plans */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-bold">POST</span>
                <code className="font-mono text-gray-800">/api/whatsapp/cable/plans</code>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Get cable provider plans with prices</p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold mb-3 text-sm">Request</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "provider": "DSTV"
}

Supported providers:
- DSTV
- GOTV
- STARTIMES`}</pre>
                </div>
                
                <div>
                  <h4 className="font-bold mb-3 text-sm">Response</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "success": true,
  "provider": "DSTV",
  "plans": [
    {
      "id": "dstv_starter",
      "displayName": "DSTV Starter",
      "value": "dstv_starter",
      "price": 2000
    },
    {
      "id": "dstv_family",
      "displayName": "DSTV Family",
      "value": "dstv_family",
      "price": 4000
    }
  ]
}`}</pre>
                </div>
              </div>
            </div>
          </div>

          {/* Subscribe Cable */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-bold">POST</span>
                <code className="font-mono text-gray-800">/api/whatsapp/cable/purchase</code>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Subscribe customer to cable plan</p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold mb-3 text-sm">Request</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "whatsappPhone": "+2349056458312",
  "provider": "DSTV",
  "plan": "dstv_starter",
  "customerId": "12345678",
  "amount": 2000
}`}</pre>
                </div>
                
                <div>
                  <h4 className="font-bold mb-3 text-sm">Response</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "success": true,
  "transactionId": "TXN_789012",
  "provider": "DSTV",
  "plan": "dstv_starter",
  "customerId": "12345678",
  "amount": 2000,
  "status": "successful"
}`}</pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ELECTRICITY SERVICES */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Electricity Services</h2>
          
          {/* Get DISCOs */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-bold">POST</span>
                <code className="font-mono text-gray-800">/api/whatsapp/electricity/plans</code>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Get available DISCOs (electricity has amount-based pricing)</p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold mb-3 text-sm">Request</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{}`}</pre>
                </div>
                
                <div>
                  <h4 className="font-bold mb-3 text-sm">Response</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
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
    }
  ],
  "info": "Any amount from min to max"
}`}</pre>
                </div>
              </div>
            </div>
          </div>

          {/* Purchase Electricity */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-bold">POST</span>
                <code className="font-mono text-gray-800">/api/whatsapp/electricity/purchase</code>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Buy electricity token</p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold mb-3 text-sm">Request</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "whatsappPhone": "+2349056458312",
  "disco": "IKEDC",
  "customerId": "87654321",
  "amount": 5000
}`}</pre>
                </div>
                
                <div>
                  <h4 className="font-bold mb-3 text-sm">Response</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "success": true,
  "transactionId": "TXN_345678",
  "disco": "IKEDC",
  "customerId": "87654321",
  "amount": 5000,
  "token": "1234567890123456",
  "status": "successful"
}`}</pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Start */}
        <section className="mb-16 bg-gray-50 p-8 rounded-lg">
          <h2 className="text-2xl font-bold mb-6">Quick Start Guide</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-bold mb-2">Step 1: Authenticate</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded text-sm">{`curl -X POST api.mozosubz.xyz/api/whatsapp/authenticate \\
  -H "Content-Type: application/json" \\
  -d '{
    "whatsapp_phone": "+2349056458312"
  }'`}</pre>
            </div>
            <div>
              <h3 className="font-bold mb-2">Step 2: Get Plans</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded text-sm">{`curl -X POST api.mozosubz.xyz/api/whatsapp/data/plans \\
  -H "Content-Type: application/json" \\
  -d '{
    "serviceID": "mtn_sme"
  }'`}</pre>
            </div>
            <div>
              <h3 className="font-bold mb-2">Step 3: Purchase</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded text-sm">{`curl -X POST api.mozosubz.xyz/api/whatsapp/data/purchase \\
  -H "Content-Type: application/json" \\
  -d '{
    "whatsappPhone": "+2349056458312",
    "serviceID": "mtn_sme",
    "phone": "09056458312",
    "value": "1GB",
    "amount": 250
  }'`}</pre>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
