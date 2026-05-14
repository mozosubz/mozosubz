# Mozosubz Connect Key API - Accurate Documentation

## Base URL
The API base URL depends on your deployment:
- **Production**: `https://mozosubz.com` (or your domain set in NEXT_PUBLIC_APP_URL)
- **Local Development**: `http://localhost:3000`

All endpoints below use the base URL automatically.

## Authentication
All service endpoints require the `X-Connect-Key` header with your Connect Key (obtained from the Connect Keys management page).

**Example Header:**
```
X-Connect-Key: connect_96434b4c2f413f952c8d1e58651215423000078de3f6b4c9_19e258f7ec6
```

## Supported Service IDs

### MTN
- `mtn_sme` - SME (Standard Mobile Edition)
- `mtn_datashare` - Data Share plans
- `mtn_gifting` - Data Gifting plans
- `mtn_awoof` - Awoof plans

### Glo
- `glo_data` - Glo Data plans
- `glo_sme` - Glo SME plans

### Airtel
- `airtel_sme` - Airtel SME plans
- `airtel_gifting` - Airtel Gifting plans

### Etisalat (9Mobile)
- `etisalat_data` - Etisalat Data plans

## Available Endpoints

### 1. Get Data Plans
**Endpoint:** `POST /api/services/data/plans`

Get available data plans for a specific service (network).

**Request:**
```json
{
  "serviceID": "mtn_sme"
}
```

**Response:**
```json
{
  "success": true,
  "plans": [
    {
      "displayName": "1GB - 30 Days",
      "value": "1GB",
      "price": "300"
    }
  ]
}
```

### 2. Purchase Data
**Endpoint:** `POST /api/services/data/purchase`

Purchase data for a phone number.

**Request:**
```json
{
  "serviceID": "mtn_sme",
  "plan": "1GB",
  "phone": "09056458312",
  "amount": "300",
  "planDisplayName": "1GB - 30 Days"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Data purchased successfully",
  "transactionID": "TXN1234567890",
  "balance": 9700
}
```

### 3. Get Cable Plans
**Endpoint:** `POST /api/services/cable/plans`

Get available cable subscription plans.

**Request:**
```json
{
  "serviceID": "startimes"
}
```

**Response:**
```json
{
  "success": true,
  "plans": [
    {
      "displayName": "Starter Bouquet",
      "value": "starter",
      "price": "1000"
    }
  ]
}
```

### 4. Subscribe to Cable
**Endpoint:** `POST /api/services/cable/subscribe`

Subscribe to a cable service.

**Request:**
```json
{
  "serviceID": "startimes",
  "plan": "starter",
  "smartcard": "9876543210",
  "phone": "09056458312"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cable subscription successful",
  "transactionID": "TXN1234567891"
}
```

### 5. Get Electricity Providers
**Endpoint:** `POST /api/services/electricity/plans`

Get available electricity distribution companies (DISCOs).

**Response:**
```json
{
  "success": true,
  "providers": [
    { "id": "eko", "name": "Eko Electric", "code": "eko" },
    { "id": "ibadanelectric", "name": "Ibadan Electric", "code": "ibadanelectric" }
  ]
}
```

### 6. Purchase Electricity
**Endpoint:** `POST /api/services/electricity/purchase`

Purchase electricity token.

**Request:**
```json
{
  "meterNumber": "12345678901234",
  "meterType": "prepaid",
  "disco": "eko",
  "amount": "5000"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Electricity token purchased",
  "token": "12345678901234567890",
  "transactionID": "TXN1234567892"
}
```

### 7. Purchase Airtime
**Endpoint:** `POST /api/services/airtime/purchase`

Purchase airtime for a phone number.

**Request:**
```json
{
  "serviceID": "mtn",
  "phone": "09056458312",
  "amount": "100"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Airtime purchased successfully",
  "transactionID": "TXN1234567893"
}
```

### 8. Initiate Deposit
**Endpoint:** `POST /api/services/deposit/initiate`

Initiate a wallet deposit transaction.

**Request:**
```json
{
  "amount": "5000",
  "description": "Wallet top-up"
}
```

**Response:**
```json
{
  "success": true,
  "paymentLink": "https://checkout.monnify.com/pay/...",
  "transactionReference": "MOZOSUBZ-123456"
}
```

### 9. Check Balance
**Endpoint:** `GET /api/services/balance`

Check your current wallet balance.

**Response:**
```json
{
  "success": true,
  "balance": 9700,
  "currency": "NGN"
}
```

## Error Responses

### Missing or Invalid Connect Key
```json
{
  "success": false,
  "error": "Invalid API key"
}
```
**Status Code:** `401`

### Rate Limit Exceeded
```json
{
  "success": false,
  "error": "Rate limit exceeded. Max 10,000 requests per day."
}
```
**Status Code:** `429`

### Insufficient Balance
```json
{
  "success": false,
  "message": "Insufficient wallet balance"
}
```
**Status Code:** `400`

### Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```
**Status Code:** `500`

## Rate Limiting
- **Limit:** 10,000 requests per day per Connect Key
- **Reset:** Daily at midnight (UTC)
- **Header:** Check `X-RateLimit-Remaining` for remaining requests

## Example cURL Requests

### Get MTN Data Plans
```bash
curl -X POST https://mozosubz.com/api/services/data/plans \
  -H "X-Connect-Key: your_connect_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceID": "mtn_sme"
  }'
```

### Purchase MTN Data
```bash
curl -X POST https://mozosubz.com/api/services/data/purchase \
  -H "X-Connect-Key: your_connect_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceID": "mtn_sme",
    "plan": "1GB",
    "phone": "09056458312",
    "amount": "300",
    "planDisplayName": "1GB - 30 Days"
  }'
```

### Get Balance
```bash
curl -X GET https://mozosubz.com/api/services/balance \
  -H "X-Connect-Key: your_connect_key_here" \
  -H "Content-Type: application/json"
```

## Key Management Endpoints

### Create a New Connect Key
**Endpoint:** `POST /api/auth/connect-keys/create`
**Authentication:** Session (logged-in user)

**Request:**
```json
{
  "name": "My Application"
}
```

**Response:**
```json
{
  "success": true,
  "key": "connect_96434b4c2f413f952c8d1e58651215423000078de3f6b4c9_19e258f7ec6",
  "warning": "IMPORTANT: Save your key now. You won't be able to see it again!"
}
```

### List Your Connect Keys
**Endpoint:** `GET /api/auth/connect-keys/list`
**Authentication:** Session (logged-in user)

**Response:**
```json
{
  "success": true,
  "keys": [
    {
      "id": "key-id-1",
      "name": "My Application",
      "keyPreview": "connect_...ec6",
      "createdAt": "2024-05-14T10:30:00Z",
      "lastUsedAt": "2024-05-14T15:45:00Z",
      "isActive": true
    }
  ]
}
```

### Revoke a Connect Key
**Endpoint:** `POST /api/auth/connect-keys/revoke`
**Authentication:** Session (logged-in user)

**Request:**
```json
{
  "keyId": "key-id-1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Key revoked successfully"
}
```

## Important Notes

1. **Security:** Never share your Connect Key with anyone. Treat it like a password.
2. **One Key Active:** Only one Connect Key can be active at a time per user. Creating a new key automatically revokes the previous one.
3. **Key Expiration:** Connect Keys expire after 1 year.
4. **Request Logging:** All API requests are logged for security and audit purposes.
5. **Webhook Support:** Webhooks for transaction notifications are available upon request.

## Support
For API support and questions, contact: support@mozosubz.com
