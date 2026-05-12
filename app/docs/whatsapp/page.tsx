import { SiteHeader } from "@/components/site-header"
import { Footer } from "@/components/footer"
import { WhatsAppDocsDownload } from "@/components/whatsapp-docs-download"
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
        {/* Header with Download */}
        <div className="mb-12">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-4">Mozosubz WhatsApp API</h1>
              <p className="text-lg text-gray-600">
                Complete documentation for WhatsApp bot integration with Mozosubz services.
              </p>
            </div>
            <WhatsAppDocsDownload />
          </div>
          
          {/* Base URL */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-sm font-semibold text-gray-600 mb-2">BASE URL</p>
            <code className="text-lg font-mono text-blue-600">api.mozosubz.xyz</code>
          </div>
        </div>

        {/* Authentication Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Authentication Flow</h2>
          
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
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
          
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-bold">POST</span>
                <code className="font-mono text-gray-800">/api/whatsapp/data/plans</code>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Get all data plans with prices</p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold mb-3 text-sm">Request</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "serviceID": "mtn_sme"
}

Supported:
- mtn_sme, mtn_datashare
- mtn_gifting, mtn_awoof
- glo_data, glo_sme
- airtel_sme, airtel_gifting
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
    }
  ]
}`}</pre>
                </div>
              </div>
            </div>
          </div>

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

Providers:
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
    }
  ]
}`}</pre>
                </div>
              </div>
            </div>
          </div>

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
  "amount": 2000
}`}</pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ELECTRICITY SERVICES */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Electricity Services</h2>
          
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-bold">POST</span>
                <code className="font-mono text-gray-800">/api/whatsapp/electricity/plans</code>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Get available DISCOs (amount-based pricing)</p>
              
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
    }
  ]
}`}</pre>
                </div>
              </div>
            </div>
          </div>

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
  "token": "1234567890123456"
}`}</pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WALLET & BALANCE */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Wallet & Balance</h2>
          
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-bold">POST</span>
                <code className="font-mono text-gray-800">/api/whatsapp/balance</code>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Check user's wallet balance</p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold mb-3 text-sm">Request</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "whatsappPhone": "+2349056458312"
}`}</pre>
                </div>
                
                <div>
                  <h4 className="font-bold mb-3 text-sm">Response</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "success": true,
  "authenticated": true,
  "balance": 15000,
  "currency": "NGN",
  "formatted": "₦15,000.00",
  "message": "Your wallet balance is ₦15,000.00"
}`}</pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DEPOSIT SERVICES */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Deposit Services</h2>
          
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-bold">POST</span>
                <code className="font-mono text-gray-800">/api/whatsapp/deposit/initiate</code>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Initiate a wallet deposit with transparent fee breakdown. Bot can show user exactly how much they'll receive.</p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold mb-3 text-sm">Request</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "whatsappPhone": "+2349056458312",
  "amount": "10000",
  "description": "Fund wallet"
}`}</pre>
                </div>
                
                <div>
                  <h4 className="font-bold mb-3 text-sm">Response (Transparent Breakdown)</h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">{`{
  "success": true,
  "paymentReference": "MZ_...",
  "transferDetails": {
    "grossAmount": 10000,
    "description": "Amount to transfer"
  },
  "feeBreakdown": {
    "processingFee": 100,
    "feePercentage": "1%"
  },
  "amountYouReceive": {
    "amount": 9900,
    "description": "Added to wallet"
  },
  "bankAccount": {
    "accountNumber": "0123456789",
    "bankName": "GTBank",
    "accountName": "Mozosubz",
    "bankCode": "058"
  },
  "ussdCode": "*737*...*10000#",
  "summary": "Transfer ₦10,000 → Receive ₦9,900"
}`}</pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Start */}
        <section className="mb-16 bg-gray-50 p-8 rounded-lg">
          <h2 className="text-2xl font-bold mb-6">Quick Start</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-bold mb-2">Step 1: Authenticate</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded text-sm">{`POST /api/whatsapp/authenticate
{"whatsapp_phone": "+2349056458312"}`}</pre>
            </div>
            <div>
              <h3 className="font-bold mb-2">Step 2: Get Plans</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded text-sm">{`POST /api/whatsapp/data/plans
{"serviceID": "mtn_sme"}`}</pre>
            </div>
            <div>
              <h3 className="font-bold mb-2">Step 3: Purchase</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded text-sm">{`POST /api/whatsapp/data/purchase
{
  "whatsappPhone": "+2349056458312",
  "serviceID": "mtn_sme",
  "phone": "09056458312",
  "value": "1GB",
  "amount": 250
}`}</pre>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
