# Mozosubb V1 API - Complete Endpoint Reference

Quick reference for all available V1 API endpoints.

---

## Authentication
All requests require the `X-Connect-Key` header:
```
X-Connect-Key: your_api_key_here
```

---

## Purchase Endpoints

### 1. Buy Data
```
POST /api/v1/data/purchase
Permission: data | all
Rate Limit: 50 req/min
```
**Body:**
```json
{
  "service": "mtn_sme",
  "plan_id": "1.0GB",
  "phone": "09123456789"
}
```
**Response (Success):**
```json
{
  "success": true,
  "transaction_id": "V1-DATA-ABC123",
  "amount": 250.00,
  "balance_after": 4750.00,
  "status": "SUCCESS",
  "message": "1.0GB data purchase successful"
}
```

---

### 2. Buy Airtime
```
POST /api/v1/airtime/purchase
Permission: airtime | all
Rate Limit: 50 req/min
```
**Body:**
```json
{
  "network": "mtn",
  "amount": 500,
  "phone": "09123456789"
}
```
**Response (Success):**
```json
{
  "success": true,
  "transaction_id": "V1-AIRTIME-ABC123",
  "amount": 500.00,
  "balance_after": 4250.00,
  "status": "SUCCESS",
  "message": "₦500.00 MTN airtime purchase successful"
}
```

---

### 3. Subscribe to Cable
```
POST /api/v1/cable/purchase
Permission: cable | all
Rate Limit: 50 req/min
```
**Body:**
```json
{
  "provider": "dstv",
  "package": "Compact",
  "smartcard": "1234567890",
  "phone": "09123456789"
}
```
**Response (Success):**
```json
{
  "success": true,
  "transaction_id": "V1-CABLE-ABC123",
  "amount": 7500.00,
  "balance_after": 2250.00,
  "status": "SUCCESS",
  "message": "Compact subscription successful"
}
```

---

### 4. Pay Electricity
```
POST /api/v1/electricity/purchase
Permission: electricity | all
Rate Limit: 50 req/min
```
**Body:**
```json
{
  "disco": "Ikeja Electric",
  "meter_type": "PREPAID",
  "meter_number": "12345678901",
  "amount": 5000,
  "phone": "09123456789"
}
```
**Response (Success):**
```json
{
  "success": true,
  "transaction_id": "V1-ELEC-ABC123",
  "amount": 5000.00,
  "balance_after": 750.00,
  "status": "SUCCESS",
  "message": "Electricity payment successful"
}
```

---

## Wallet Endpoints

### 5. Check Wallet Balance
```
GET /api/v1/wallet/balance
Permission: any
Rate Limit: 100 req/min
```
**Response:**
```json
{
  "success": true,
  "balance": 10000.00,
  "currency": "NGN"
}
```

---

### 6. Get Transactions
```
GET /api/v1/wallet/transactions
Permission: any
Rate Limit: 100 req/min
```
**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "transaction_id": "V1-DATA-ABC123",
      "type": "DATA",
      "amount": 250.00,
      "balance_before": 5000.00,
      "balance_after": 4750.00,
      "status": "SUCCESS",
      "created_at": "2026-05-01T10:30:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "pages": 3
}
```

---

### 7. Fund Wallet
```
POST /api/v1/wallet/deposit
Permission: any
Rate Limit: 10 req/min
```
**Body:**
```json
{
  "amount": 10000,
  "payment_method": "bank_transfer"
}
```
**Response:**
```json
{
  "success": true,
  "deposit_id": "DEP123456",
  "amount": 10000.00,
  "payment_url": "https://payment.example.com/pay/DEP123456",
  "status": "PENDING"
}
```

---

## Bot Auth Endpoints

### 8. Get Connected Bots
```
GET /api/v1/bot-auth/connections
Permission: any
```
**Response:**
```json
{
  "success": true,
  "connections": [
    {
      "platform": "telegram",
      "identifier": "7013439166",
      "connected_at": "2025-07-23T12:26:00Z"
    }
  ]
}
```

---

### 9. Request Bot OTP
```
POST /api/v1/bot-auth/request-otp
Permission: any
```
**Body:**
```json
{
  "platform": "telegram"
}
```
**Response:**
```json
{
  "success": true,
  "session_id": "sess_xxxxx"
}
```

---

### 10. Verify Bot OTP
```
POST /api/v1/bot-auth/verify-otp
Permission: any
```
**Body:**
```json
{
  "session_id": "sess_xxxxx",
  "otp": "123456"
}
```
**Response:**
```json
{
  "success": true,
  "connection": {
    "platform": "telegram",
    "identifier": "7013439166"
  }
}
```

---

### 11. Unlink Bot
```
DELETE /api/v1/bot-auth/unlink?platform=telegram
OR
POST /api/v1/bot-auth/unlink
```
**Body (POST):**
```json
{
  "platform": "telegram"
}
```
**Response:**
```json
{
  "success": true,
  "message": "telegram account unlinked successfully"
}
```

---

### 12. Validate API Key
```
POST /api/v1/bot-auth/validate-key
Permission: any
```
**Response:**
```json
{
  "success": true,
  "message": "API key is valid",
  "user": {
    "id": "user_xxxxx",
    "email": "user@example.com"
  }
}
```

---

## Endpoint Summary

| Endpoint | Method | Purpose | Rate Limit |
|----------|--------|---------|-----------|
| `/data/purchase` | POST | Buy data | 50/min |
| `/airtime/purchase` | POST | Buy airtime | 50/min |
| `/cable/purchase` | POST | Subscribe cable | 50/min |
| `/electricity/purchase` | POST | Pay electricity | 50/min |
| `/wallet/balance` | GET | Check balance | 100/min |
| `/wallet/transactions` | GET | View history | 100/min |
| `/wallet/deposit` | POST | Fund wallet | 10/min |
| `/bot-auth/connections` | GET | List bots | 100/min |
| `/bot-auth/request-otp` | POST | Start bot auth | 10/min |
| `/bot-auth/verify-otp` | POST | Complete auth | 10/min |
| `/bot-auth/unlink` | DELETE/POST | Disconnect bot | 10/min |
| `/bot-auth/validate-key` | POST | Verify key | 100/min |

---

## Common Parameters

### Network Values
- `mtn`, `glo`, `airtel`, `etisalat`

### Data Services
- `mtn_sme`, `mtn_corporate`, `glo_direct`, `airtel_direct`, `etisalat_direct`, `smile_direct`

### Cable Providers
- `dstv`, `gotv`, `startimes`

### DISCOs
- `Ikeja Electric`, `Eko Electric`, `Abuja Electric`, `Kano Electric`
- `Port Harcourt Electric`, `Jos Electric`, `Ibadan Electric`, `Kaduna Electric`
- `Enugu Electric`, `Benin Electric`, `Aba Electric`, `Yola Electric`

### Meter Types
- `PREPAID`, `POSTPAID`

### Phone Format
- Nigerian format: `09XXXXXXXXX` or `+2349XXXXXXXXX` or `2349XXXXXXXXX`
- 11 digits total

---

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": "Error message",
  "error_code": "ERROR_CODE"
}
```

### Status Codes
- `200` - Success
- `400` - Bad request
- `401` - Unauthorized
- `402` - Insufficient balance
- `403` - Forbidden
- `404` - Not found
- `429` - Rate limited
- `500` - Server error
- `502` - Provider error

### Common Error Codes
- `UNAUTHORIZED` - Invalid/missing API key
- `RATE_LIMITED` - Rate limit exceeded
- `FORBIDDEN` - Insufficient permissions
- `INSUFFICIENT_BALANCE` - Wallet too low
- `INVALID_PHONE` - Invalid phone number
- `INVALID_PLAN` - Invalid data plan
- `INVALID_AMOUNT` - Invalid amount
- `TIMEOUT_PENDING_VERIFICATION` - Request timed out (async)
- `PROVIDER_UNREACHABLE` - Provider error

---

## Examples

### JavaScript Example
```javascript
const API_KEY = 'your_api_key';

async function buyData() {
  const response = await fetch('https://api.mozosubz.xyz/api/v1/data/purchase', {
    method: 'POST',
    headers: {
      'X-Connect-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      service: 'mtn_sme',
      plan_id: '1.0GB',
      phone: '09123456789'
    })
  });
  
  const data = await response.json();
  console.log(data);
}

buyData();
```

### cURL Example
```bash
curl -X POST https://api.mozosubz.xyz/api/v1/data/purchase \
  -H "X-Connect-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "mtn_sme",
    "plan_id": "1.0GB",
    "phone": "09123456789"
  }'
```

---

## Documentation Links

- **Quick Start**: See [API_QUICK_START.md](./API_QUICK_START.md)
- **Full Guide**: See [API_PURCHASE_V1.md](./API_PURCHASE_V1.md)
- **Implementation Details**: See [V1_API_IMPLEMENTATION.md](./V1_API_IMPLEMENTATION.md)
- **Bot Auth**: See [BOT_AUTH_API.md](./BOT_AUTH_API.md)

---

**Last Updated**: May 1, 2026  
**API Version**: v1  
**Status**: Production Ready
