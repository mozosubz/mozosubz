# Mozosubz/v1 Integration API Documentation

## Overview

The Mozosubz/v1 API allows developers to integrate all our services (Data, Airtime, Cable, Electricity, Deposits) into their applications using secure API keys called Connect Keys.

## Authentication

All API requests require a valid Connect Key passed in the `X-Connect-Key` header.

```bash
curl -X POST https://mozosubz.xyz/api/mozosubz/v1/services/data/plans \
  -H "X-Connect-Key: your_connect_key" \
  -H "Content-Type: application/json"
```

## Connect Key Management

### Generate a Connect Key

Go to your dashboard at `/integrations/keys` and click "Generate New Key". 

**Important:** Your key is only shown once. Save it immediately in a secure location.

**Key Format:** `connect_[48-hex-chars]_[timestamp-hex]`

**Security Features:**
- Auto-expires after 1 year
- Old keys automatically revoked when new key is generated (only 1 active key per user)
- Rate limited: 10,000 requests per day
- All API calls are logged
- Keys cannot be recovered once created

### List Your Keys

```bash
GET /api/mozosubz/v1/keys/list
```

Requires authentication (logged-in user).

### Revoke a Key

```bash
POST /api/mozosubz/v1/keys/revoke
Content-Type: application/json

{
  "keyId": "key-uuid-here"
}
```

## Service Endpoints

### Data Services

#### Get Data Plans

```bash
POST /api/mozosubz/v1/services/data/plans
X-Connect-Key: your_key
Content-Type: application/json

{
  "serviceID": "MTN"
}
```

Response:
```json
{
  "success": true,
  "plans": [
    {
      "id": "plan_1",
      "name": "1GB",
      "price": 500,
      "validity": "30 days"
    }
  ]
}
```

#### Buy Data

```bash
POST /api/mozosubz/v1/services/data/purchase
X-Connect-Key: your_key
Content-Type: application/json

{
  "phone": "2348012345678",
  "planID": "plan_1",
  "serviceID": "MTN"
}
```

### Airtime Services

#### Buy Airtime

```bash
POST /api/mozosubz/v1/services/airtime/purchase
X-Connect-Key: your_key
Content-Type: application/json

{
  "phone": "2348012345678",
  "amount": 1000,
  "serviceID": "MTN"
}
```

### Cable Services

#### Get Cable Plans

```bash
POST /api/mozosubz/v1/services/cable/plans
X-Connect-Key: your_key
Content-Type: application/json
```

#### Subscribe Cable

```bash
POST /api/mozosubz/v1/services/cable/subscribe
X-Connect-Key: your_key
Content-Type: application/json

{
  "provider": "DSTV",
  "smartcard": "1234567890",
  "planID": "plan_1"
}
```

### Electricity Services

#### Get Electricity Providers

```bash
POST /api/mozosubz/v1/services/electricity/plans
X-Connect-Key: your_key
Content-Type: application/json
```

#### Buy Electricity

```bash
POST /api/mozosubz/v1/services/electricity/purchase
X-Connect-Key: your_key
Content-Type: application/json

{
  "meterNumber": "12345678",
  "meterType": "prepaid",
  "disco": "eko",
  "amount": 5000
}
```

### Deposit Services

#### Initiate Deposit

```bash
POST /api/mozosubz/v1/services/deposit/initiate
X-Connect-Key: your_key
Content-Type: application/json

{
  "amount": 10000
}
```

### Account Services

#### Check Balance

```bash
GET /api/mozosubz/v1/services/balance
X-Connect-Key: your_key
```

Response:
```json
{
  "success": true,
  "balance": 25000
}
```

## API Logging

Every API request is logged with detailed information:

- Request timestamp
- Endpoint called
- HTTP method and status code
- Connect Key (first 20 chars shown in logs)
- IP address and User Agent
- Response time
- Any errors or warnings

Logs are prefixed with `[MOZOSUBZ-*]` and appear in your server console and Vercel dashboard logs.

## Rate Limiting

- **Per Key:** 10,000 requests per day
- **Per IP (for key creation):** 5 keys per hour

When rate limit is exceeded, you'll receive a 429 status code.

## Error Responses

### 400 - Bad Request
```json
{
  "success": false,
  "error": "Invalid request parameters"
}
```

### 401 - Unauthorized
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

### 429 - Rate Limited
```json
{
  "success": false,
  "error": "Rate limit exceeded. Max 10,000 requests per day."
}
```

### 500 - Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

## Best Practices

1. **Store Keys Securely** - Never commit keys to version control
2. **Use Environment Variables** - Store keys in `.env` files
3. **Rotate Keys** - Generate new keys periodically
4. **Monitor Usage** - Check logs for suspicious activity
5. **Handle Errors** - Implement proper error handling and retries

## Support

For API issues or questions, contact: api-support@mozosubz.xyz
