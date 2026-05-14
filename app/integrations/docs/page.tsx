export const metadata = {
  title: 'Integration API Documentation',
  description: 'Complete API documentation for integrating services',
}

export default function IntegrationDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12 border-b pb-8">
          <h1 className="text-4xl font-bold mb-2">Integration API Documentation</h1>
          <p className="text-xl text-gray-600">
            Access all our services programmatically with secure API keys
          </p>
        </div>

        {/* Authentication */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Authentication</h2>
          <p className="text-gray-700 mb-4">
            All API requests require a Connect Key in the <code className="bg-gray-100 px-2 py-1 rounded">X-Connect-Key</code> header.
          </p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto">
            <pre>{`curl -X POST https://www.mozosubz.xyz/api/mozosubz/v1/services/data/plans \\
  -H "X-Connect-Key: your_connect_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"serviceID": "mtn_sme"}'`}</pre>
            </div>
        </section>

        {/* Data Services */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Data Services</h2>
          
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-3">Get Data Plans</h3>
            <div className="bg-gray-50 p-4 rounded mb-4">
              <p className="font-mono text-sm text-gray-700 mb-2">POST /api/mozosubz/v1/services/data/plans</p>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold mb-1">Request Body:</p>
                <pre className="bg-gray-100 p-3 rounded overflow-x-auto text-xs">{`{
  "serviceID": "mtn_sme" | "mtn_datashare" | "mtn_gifting" | "mtn_awoof" | "glo_data" | "glo_sme" | "airtel_sme" | "etisalat_data"
}`}</pre>
              </div>
              <div>
                <p className="font-semibold mb-1">Response:</p>
                <pre className="bg-gray-100 p-3 rounded overflow-x-auto text-xs">{`{
  "service": "mtn_sme",
  "PlanName": "MTN SME Data Plans",
  "fixedPrice": true,
  "plans": [
    {
      "displayName": "500MB",
      "value": "500",
      "price": "155"
    },
    {
      "displayName": "1GB",
      "value": "1024",
      "price": "310"
    },
    {
      "displayName": "2GB",
      "value": "2048",
      "price": "620"
    }
  ]
}`}</pre>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-3">Purchase Data</h3>
            <div className="bg-gray-50 p-4 rounded mb-4">
              <p className="font-mono text-sm text-gray-700 mb-2">POST /api/mozosubz/v1/services/data/purchase</p>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold mb-1">Request:</p>
                <pre className="bg-gray-100 p-3 rounded overflow-x-auto">{`{
  "network": "MTN",
  "plan_id": "mtn_sme_500",
  "recipient_phone": "09056458312"
}`}</pre>
              </div>
            </div>
          </div>
        </section>

        {/* Airtime Services */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Airtime Services</h2>
          <div className="bg-gray-50 p-4 rounded mb-4">
            <p className="font-mono text-sm text-gray-700 mb-2">POST /api/mozosubz/v1/services/airtime/purchase</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold mb-1">Request:</p>
            <pre className="bg-gray-100 p-3 rounded overflow-x-auto">{`{
  "network": "MTN",
  "plan_id": "mtn_airtime_500",
  "recipient_phone": "09056458312"
}`}</pre>
          </div>
        </section>

        {/* Cable Services */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Cable Services</h2>
          
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-3">Get Cable Plans</h3>
            <div className="bg-gray-50 p-4 rounded mb-4">
              <p className="font-mono text-sm text-gray-700 mb-2">POST /api/mozosubz/v1/services/cable/plans</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold mb-1">Request:</p>
              <pre className="bg-gray-100 p-3 rounded overflow-x-auto">{`{
  "provider": "DSTV" | "GOTV" | "STARTIMES"
}`}</pre>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-3">Subscribe to Cable</h3>
            <div className="bg-gray-50 p-4 rounded mb-4">
              <p className="font-mono text-sm text-gray-700 mb-2">POST /api/mozosubz/v1/services/cable/subscribe</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold mb-1">Request:</p>
              <pre className="bg-gray-100 p-3 rounded overflow-x-auto">{`{
  "plan_id": "dstv_01",
  "smartcard_number": "1234567890"
}`}</pre>
            </div>
          </div>
        </section>

        {/* Electricity Services */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Electricity Services</h2>
          
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-3">Get Electricity Plans (DISCOs)</h3>
            <div className="bg-gray-50 p-4 rounded mb-4">
              <p className="font-mono text-sm text-gray-700 mb-2">POST /api/mozosubz/v1/services/electricity/plans</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold mb-1">Response includes available DISCOs and purchase options</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-3">Purchase Electricity</h3>
            <div className="bg-gray-50 p-4 rounded mb-4">
              <p className="font-mono text-sm text-gray-700 mb-2">POST /api/mozosubz/v1/services/electricity/purchase</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold mb-1">Request:</p>
              <pre className="bg-gray-100 p-3 rounded overflow-x-auto">{`{
  "disco_id": "abuja",
  "meter_number": "12345678",
  "amount": 5000
}`}</pre>
            </div>
          </div>
        </section>

        {/* Deposits & Account */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Account & Deposits</h2>
          
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-3">Check Balance</h3>
            <div className="bg-gray-50 p-4 rounded mb-4">
              <p className="font-mono text-sm text-gray-700 mb-2">GET /api/mozosubz/v1/services/balance</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold mb-1">Response:</p>
              <pre className="bg-gray-100 p-3 rounded overflow-x-auto text-xs">{`{
  "success": true,
  "balance": 50000
}`}</pre>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-3">Get Transactions</h3>
            <div className="bg-gray-50 p-4 rounded mb-4">
              <p className="font-mono text-sm text-gray-700 mb-2">GET /api/mozosubz/v1/services/transactions</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-3">Initiate Deposit</h3>
            <div className="bg-gray-50 p-4 rounded mb-4">
              <p className="font-mono text-sm text-gray-700 mb-2">POST /api/mozosubz/v1/deposit/start</p>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold mb-1">Request:</p>
                <pre className="bg-gray-100 p-3 rounded overflow-x-auto text-xs">{`{
  "amount": 10000,
  "description": "Wallet deposit"
}`}</pre>
              </div>
              <div>
                <p className="font-semibold mb-1">Response Success:</p>
                <pre className="bg-gray-100 p-3 rounded overflow-x-auto text-xs">{`{
  "success": true,
  "paymentReference": "MZ20250514090534UAB1234",
  "transactionId": "trx_abc123xyz",
  "checkoutUrl": "/checkout/MZ20250514090534UAB1234"
}`}</pre>
              </div>
              <div className="mt-3">
                <p className="font-semibold mb-1">Response Error:</p>
                <pre className="bg-gray-100 p-3 rounded overflow-x-auto text-xs">{`{
  "success": false,
  "error": "Valid amount is required"
}`}</pre>
              </div>
            </div>
          </div>
        </section>

        {/* Error Handling */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Error Handling</h2>
          <div className="text-sm">
            <p className="font-semibold mb-2">All error responses follow this format:</p>
            <pre className="bg-gray-100 p-3 rounded overflow-x-auto">{`{
  "success": false,
  "error": "Description of what went wrong"
}`}</pre>
            <div className="mt-4 space-y-2">
              <p><strong>401:</strong> Invalid or missing Connect Key</p>
              <p><strong>403:</strong> Insufficient permissions for this operation</p>
              <p><strong>400:</strong> Invalid request parameters</p>
              <p><strong>500:</strong> Server error</p>
            </div>
          </div>
        </section>

        {/* Rate Limiting */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Rate Limiting</h2>
          <div className="text-sm">
            <p>Each API key has the following limits:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>10,000 requests per day</li>
              <li>Rate limit resets daily at 00:00 UTC</li>
              <li>Requests exceeding the limit will receive a 429 response</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  )
}
