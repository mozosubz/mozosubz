# WhatsApp Bot API Documentation

> Complete API reference for integrating with Mozosubz WhatsApp bot services

## Base URL
```
https://mozosubz.xyz/api/whatsapp
```

---

## Endpoints Overview

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/authenticate` | POST | No | Resolve WhatsApp phone to user account |
| `/balance` | POST | No | Get current wallet balance |
| `/connect-token` | POST | Yes | Generate connection token (requires session) |
| `/connect` | POST | No | Connect WhatsApp number to account (called by bot) |
| `/disconnect` | POST | Yes | Disconnect WhatsApp number |
| `/data/plans` | POST | No | Get available data plans |
| `/data/purchase` | POST | No | Purchase data plan |
| `/cable/plans` | POST | No | Get available cable TV plans |
| `/cable/purchase` | POST | No | Subscribe to cable TV |
| `/electricity/plans` | POST | No | Get available electricity DISCOs |
| `/electricity/purchase` | POST | No | Purchase electricity tokens |
| `/deposit/initiate` | POST | No | Initiate wallet deposit |

---

## 1. Authenticate User
**POST** `/authenticate`

Resolve a WhatsApp phone number to a Mozosubz user account.

### Request
```json
{
  "whatsapp_phone": "2349056458312"
}
```

### Response (Success - 200)
```json
{
  "success": true,
  "user_id": "50f1dbfb-fb37-4a5f-b120-46e51f438d78",
  "email": "user@example.com",
  "firstName": "Wisdom",
  "isConnected": true
}
```

### Response (Not Found - 400)
```json
{
  "success": false,
  "error": "User not found with this WhatsApp number"
}
```

### Example
```bash
curl -X POST https://mozosubz.xyz/api/whatsapp/authenticate \
  -H "Content-Type: application/json" \
  -d '{"whatsapp_phone": "2349056458312"}'
```

---

## 2. Get Wallet Balance
**POST** `/balance`

Retrieve current wallet balance for a WhatsApp user.

### Request
```json
{
  "whatsapp_phone": "2349056458312"
}
```

### Response (Success - 200)
```json
{
  "success": true,
  "balance": 6750.50,
  "formatted": "₦6,750.50",
  "user_id": "50f1dbfb-fb37-4a5f-b120-46e51f438d78"
}
```

### Response (Not Found - 400)
```json
{
  "success": false,
  "error": "User not found"
}
```

### Example
```bash
curl -X POST https://mozosubz.xyz/api/whatsapp/balance \
  -H "Content-Type: application/json" \
  -d '{"whatsappPhone": "2349056458312"}'
```

---

## 3. Get Data Plans
**POST** `/data/plans`

Retrieve available data plans for all networks or a specific network.

### Request
```json
{
  "whatsappPhone": "2349056458312"
}
```

Networks: `MTN`, `GLO`, `AIRTEL`, `ETISALAT`

### Response (Success - 200)
```json
{
  "success": true,
  "network": "MTN",
  "planTypes": [
    {
      "type": "sme",
      "label": "SME Plans",
      "plans": [
        {
          "id": "mtn_sme_500",
          "name": "500MB - 7 Days",
          "dataSizeMB": 500,
          "validity": "7 days",
          "price": 500
        }
      ]
    }
  ]
}
```

### Example
```bash
curl -X POST https://mozosubz.xyz/api/whatsapp/data/plans \
  -H "Content-Type: application/json" \
  -d '{"network": "MTN"}'
```

---

## 4. Purchase Data Plan
**POST** `/data/purchase`

Buy a data plan for a WhatsApp user.

### Request
```json
{
  "whatsappPhone": "2349056458312",
  "network": "MTN",
  "plan_id": "mtn_sme_500",
  "recipient_phone": "09056458312"
}
```

### Response (Success - 200)
```json
{
  "success": true,
  "transaction_reference": "TXN_20260512_abc123",
  "network": "MTN",
  "plan": "500MB - 7 Days",
  "amount_debited": 500,
  "balance_before": 7250.50,
  "balance_after": 6750.50,
  "status": "PROCESSING"
}
```

### Example
```bash
curl -X POST https://mozosubz.xyz/api/whatsapp/data/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "whatsappPhone": "2349056458312",
    "network": "MTN",
    "plan_id": "mtn_sme_500",
    "recipient_phone": "09056458312"
  }'
```

---

## 5. Get Cable Plans
**POST** `/cable/plans`

Retrieve available cable TV subscription plans.

### Request
```json
{}
```

### Response (Success - 200)
```json
{
  "success": true,
  "plans": [
    {
      "id": "dstv_01",
      "provider": "DSTV",
      "name": "DSTV Padi",
      "price": 3500,
      "validity": "1 month"
    },
    {
      "id": "gotv_01",
      "provider": "GOTV",
      "name": "GOTV Plus",
      "price": 3000,
      "validity": "1 month"
    }
  ]
}
```

### Example
```bash
curl -X POST https://mozosubz.xyz/api/whatsapp/cable/plans \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 6. Purchase Cable Plan
**POST** `/cable/purchase`

Subscribe to a cable TV plan.

### Request
```json
{
  "whatsappPhone": "2349056458312",
  "plan_id": "dstv_01",
  "smartcard_number": "1234567890"
}
```

### Response (Success - 200)
```json
{
  "success": true,
  "transaction_reference": "TXN_CABLE_20260512_xyz",
  "provider": "DSTV",
  "plan": "DSTV Padi",
  "smartcard": "1234567890",
  "amount_debited": 3500,
  "status": "SUCCESS"
}
```

### Example
```bash
curl -X POST https://mozosubz.xyz/api/whatsapp/cable/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "whatsappPhone": "2349056458312",
    "plan_id": "dstv_01",
    "smartcard_number": "1234567890"
  }'
```

---

## 7. Get Electricity DISCOs
**POST** `/electricity/plans`

Retrieve available electricity distribution companies (DISCOs).

### Request
```json
{}
```

### Response (Success - 200)
```json
{
  "success": true,
  "discos": [
    {
      "id": "abuja",
      "name": "Abuja Electricity Distribution Company (AEDC)",
      "short_name": "AEDC"
    },
    {
      "id": "benin",
      "name": "Benin Electricity Distribution Company (BEDC)",
      "short_name": "BEDC"
    }
  ]
}
```

### Example
```bash
curl -X POST https://mozosubz.xyz/api/whatsapp/electricity/plans \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 8. Purchase Electricity Tokens
**POST** `/electricity/purchase`

Buy electricity tokens from a DISCO.

### Request
```json
{
  "whatsappPhone": "2349056458312",
  "disco_id": "abuja",
  "meter_number": "12345678",
  "amount": 5000
}
```

### Response (Success - 200)
```json
{
  "success": true,
  "transaction_reference": "TXN_ELEC_20260512_abc",
  "disco": "AEDC",
  "meter_number": "12345678",
  "amount": 5000,
  "token": "1234123412341234",
  "status": "SUCCESS"
}
```

### Example
```bash
curl -X POST https://mozosubz.xyz/api/whatsapp/electricity/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "whatsappPhone": "2349056458312",
    "disco_id": "abuja",
    "meter_number": "12345678",
    "amount": 5000
  }'
```

---

## 9. Initiate Wallet Deposit
**POST** `/deposit/initiate`

Start a wallet deposit transaction.

### Request
```json
{
  "whatsappPhone": "2349056458312",
  "amount": 5000,
  "description": "Wallet topup"
}
```

### Response (Success - 200)
```json
{
  "success": true,
  "paymentReference": "MOZO_50f1dbfb_1778609136084_7dqe",
  "amount": 5000,
  "processingFee": 50,
  "amountYouReceive": 4950,
  "accountNumber": "6704244255",
  "bankName": "Moniepoint Microfinance Bank",
  "accountName": "Monnify Checkout",
  "bankCode": "50515"
}
```

### Example
```bash
curl -X POST https://mozosubz.xyz/api/whatsapp/deposit/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "whatsappPhone": "2349056458312",
    "amount": 5000,
    "description": "Wallet topup"
  }'
```

---

## 10. Generate Connection Token (Authenticated)
**POST** `/connect-token`

Generate a token for WhatsApp connection. Requires user authentication.

### Headers
```
Authorization: Bearer <user_session_token>
```

### Response (Success - 200)
```json
{
  "success": true,
  "token": "MZ_UQFMYE322HFLFZT2D83RJY4URPQHSQML",
  "expiresIn": 600,
  "instructions": "Send 'CONNECT MZ_UQFMYE322HFLFZT2D83RJY4URPQHSQML' to the WhatsApp bot"
}
```

### Example (via Web UI)
```javascript
const response = await fetch('/api/whatsapp/connect-token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
});
const data = await response.json();
console.log(`Send this to WhatsApp: CONNECT ${data.token}`);
```

---

## 11. Connect WhatsApp (Called by Bot)
**POST** `/connect`

Link a WhatsApp number to a Mozosubz account. Called by the external WhatsApp bot.

### Request
```json
{
  "whatsapp_phone": "2349056458312",
  "token": "MZ_UQFMYE322HFLFZT2D83RJY4URPQHSQML"
}
```

### Response (Success - 200)
```json
{
  "success": true,
  "user_id": "50f1dbfb-fb37-4a5f-b120-46e51f438d78",
  "whatsapp_phone": "2349056458312",
  "verified_at": "2026-05-13T04:25:00.000Z"
}
```

### Response (Token Expired - 400)
```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

### Example (from WhatsApp Bot)
```bash
curl -X POST https://mozosubz.xyz/api/whatsapp/connect \
  -H "Content-Type: application/json" \
  -d '{
    "whatsapp_phone": "2349056458312",
    "token": "MZ_UQFMYE322HFLFZT2D83RJY4URPQHSQML"
  }'
```

---

## 12. Disconnect WhatsApp (Authenticated)
**POST** `/disconnect`

Unlink a WhatsApp number from the user account.

### Headers
```
Authorization: Bearer <user_session_token>
```

### Request
```json
{}
```

### Response (Success - 200)
```json
{
  "success": true,
  "message": "WhatsApp disconnected successfully",
  "cooldownUntil": "2026-05-14T04:25:00.000Z"
}
```

### Example
```javascript
const response = await fetch('/api/whatsapp/disconnect', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
});
const data = await response.json();
console.log(data.message);
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid request parameters"
}
```

### 401 Unauthorized (for authenticated endpoints)
```json
{
  "success": false,
  "error": "Authentication required"
}
```

### 409 Conflict
```json
{
  "success": false,
  "error": "This WhatsApp number is already connected to another account"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Integration Flow

### For Web Users (Profile Connection)

1. User visits profile page → clicks "Connect WhatsApp"
2. UI calls `POST /api/whatsapp/connect-token` (requires auth)
3. Backend returns token (e.g., `MZ_UQFMYE322HFLFZT2D83RJY4URPQHSQML`)
4. UI displays: "Send this message to WhatsApp: `CONNECT MZ_UQFMYE322HFLFZT2D83RJY4URPQHSQML`"
5. User sends message to bot
6. Bot receives message, extracts token
7. Bot calls `POST /api/whatsapp/connect` with token + user's phone
8. Connection verified ✅

### For WhatsApp Users (Bot Transactions)

1. User sends "BAL" to bot
2. Bot extracts phone number from message
3. Bot calls `POST /api/whatsapp/balance` with phone
4. Returns wallet balance
5. Bot formats and sends response back to user

---

## Rate Limiting

- General endpoints: 60 requests per minute per IP
- Sensitive endpoints (deposit, purchase): 20 requests per minute per IP
- Connection endpoints: 5 requests per minute per IP

---

## Security Notes

- Phone numbers must be 10 digits (Nigerian format without country code)
- All transactions are immutable and logged
- WhatsApp numbers can only be connected to one account
- Connection tokens expire after 10 minutes
- Disconnection has a 24-hour cooldown period
- All API responses include transaction reference numbers for tracking

---

## Support

For issues or integration help:
- Email: support@mozosubz.xyz
- Documentation: https://docs.mozosubz.xyz/whatsapp
- Status: https://status.mozosubz.xyz
