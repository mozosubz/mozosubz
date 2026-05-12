'use client'

export function WhatsAppDocsDownload() {
  const handleDownload = () => {
    const docContent = `MOZOSUBZ WHATSAPP API DOCUMENTATION
=====================================

Base URL: api.mozosubz.xyz

## AUTHENTICATION FLOW

### POST /api/whatsapp/authenticate
Resolve WhatsApp number to user profile (call before transactions)
Body: { "whatsapp_phone": "+2349056458312" }
Response: { "success": true, "authenticated": true, "user_id", "profile": {...} }

## DATA SERVICES

### POST /api/whatsapp/data/plans
Get all data plans with prices
Body: { "serviceID": "mtn_sme" }

Supported serviceIDs:
- MTN: mtn_sme, mtn_datashare, mtn_gifting, mtn_awoof
- Glo: glo_data, glo_sme
- Airtel: airtel_sme, airtel_gifting
- Etisalat: etisalat_data

Response: { "success": true, "serviceID": "mtn_sme", "plans": [...] }

### POST /api/whatsapp/data/purchase
Buy data for customer
Body: { "whatsappPhone": "+2349056458312", "serviceID": "mtn_sme", "phone": "09056458312", "value": "1GB", "amount": 250 }
Response: { "success": true, "transactionId": "TXN_123456", "phone": "09056458312", "data": "1GB", "amount": 250 }

## CABLE SERVICES

### POST /api/whatsapp/cable/plans
Get cable provider plans with prices
Body: { "provider": "DSTV" }

Supported providers: DSTV, GOTV, STARTIMES

Response: { "success": true, "provider": "DSTV", "plans": [...] }

### POST /api/whatsapp/cable/purchase
Subscribe customer to cable plan
Body: { "whatsappPhone": "+2349056458312", "provider": "DSTV", "plan": "dstv_starter", "customerId": "12345678", "amount": 2000 }
Response: { "success": true, "transactionId": "TXN_789012", "provider": "DSTV", "plan": "dstv_starter" }

## ELECTRICITY SERVICES

### POST /api/whatsapp/electricity/plans
Get available DISCOs (amount-based pricing)
Body: {}

DISCOs: IKEDC, EEDC, BEDC, AEDC, KEDCO, PHED, YEDC
Min: 500, Max: 50000

Response: { "success": true, "discos": [...] }

### POST /api/whatsapp/electricity/purchase
Buy electricity token
Body: { "whatsappPhone": "+2349056458312", "disco": "IKEDC", "customerId": "87654321", "amount": 5000 }
Response: { "success": true, "transactionId": "TXN_345678", "disco": "IKEDC", "token": "1234567890123456" }

## WALLET & BALANCE

### POST /api/whatsapp/balance
Check user's wallet balance
Body: { "whatsappPhone": "+2349056458312" }
Response: { "success": true, "authenticated": true, "balance": 15000, "currency": "NGN", "formatted": "₦15,000.00" }

## DEPOSIT SERVICES

### POST /api/whatsapp/deposit/initiate
Initiate deposit with transparent fee breakdown
Body: { "whatsappPhone": "+2349056458312", "amount": "10000", "description": "Fund wallet" }
Response: {
  "success": true,
  "transferDetails": { "grossAmount": 10000 },
  "feeBreakdown": { "processingFee": 100, "feePercentage": "1%" },
  "amountYouReceive": { "amount": 9900, "description": "Added to wallet" },
  "summary": "Transfer ₦10,000 → Receive ₦9,900"
}

## QUICK START

1. Authenticate:
   POST /api/whatsapp/authenticate
   { "whatsapp_phone": "+2349056458312" }

2. Get Plans:
   POST /api/whatsapp/data/plans
   { "serviceID": "mtn_sme" }

3. Purchase:
   POST /api/whatsapp/data/purchase
   { "whatsappPhone": "+2349056458312", "serviceID": "mtn_sme", "phone": "09056458312", "value": "1GB", "amount": 250 }

## ERROR HANDLING

All endpoints return status 200 with readable messages:
- "not connected to an active account" - WhatsApp not linked
- "has been disconnected" - WhatsApp was unlinked
- Success responses include all transaction details

## SECURITY

- Only WhatsApp numbers explicitly linked by users can authenticate
- 24-hour cooldown after disconnection before reconnection
- Numbers cannot be shared across accounts
- All requests logged for audit trail
- Emails sent on connect/disconnect events
    `

    const blob = new Blob([docContent], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "mozosubz-whatsapp-api-docs.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleDownload}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
    >
      Download Docs
    </button>
  )
}
