# Integration API - Complete Guide

Your platform now has a secure, production-ready Integration API that allows developers to integrate all your services programmatically.

## Overview

The Integration API provides a unified, secure way for developers to:
- Manage data bundles (MTN, GLO, AIRTEL, 9MOBILE)
- Subscribe to cable TV services (DSTV, GOTV, STARTIMES)
- Purchase electricity tokens
- Buy airtime
- Make deposits to their wallet
- Check account balance and transactions

## Key Features

✅ **Secure API Keys** - Connect Keys with industry-grade security
✅ **Rate Limiting** - 10,000 requests/day per key
✅ **Usage Tracking** - Monitor all API calls and suspicious activity
✅ **Key Rotation** - Old keys automatically invalidated when new keys are created
✅ **IP Tracking** - Log all API calls with IP address and user agent
✅ **Audit Logs** - Complete audit trail for compliance
✅ **Real-time Balance & Transactions** - Immediate updates

## Getting Started

### 1. Generate an API Key

Visit your profile:
```
https://mozosubz.xyz/dashboard/profile
```

Click **"API Keys"** in your profile menu and generate a new key. Save it securely - you won't see it again!

### 2. Make Your First Request

```bash
curl -X POST https://mozosubz.xyz/api/integrations/services/balance \
  -H "X-Connect-Key: your_key_here" \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "success": true,
  "balance": 50000,
  "currency": "NGN",
  "formattedBalance": "₦50,000.00"
}
```

## API Endpoints

### Data Services

#### Get Data Plans
```bash
POST /api/integrations/services/data/plans
```

**Request:**
```json
{
  "network": "MTN" | "GLO" | "AIRTEL" | "9MOBILE"
}
```

**Response:**
```json
{
  "success": true,
  "network": "MTN",
  "planTypes": [
    {
      "plan_id": "mtn_sme_500",
      "name": "SME 500 - 500MB",
      "size": "500MB",
      "price": 500,
      "duration": "30 days"
    }
  ]
}
```

#### Purchase Data
```bash
POST /api/integrations/services/data/purchase
```

**Request:**
```json
{
  "network": "MTN",
  "plan_id": "mtn_sme_500",
  "recipient_phone": "09056458312"
}
```

### Airtime Services

#### Purchase Airtime
```bash
POST /api/integrations/services/airtime/purchase
```

**Request:**
```json
{
  "network": "MTN",
  "plan_id": "mtn_airtime_500",
  "recipient_phone": "09056458312"
}
```

### Cable Services

#### Get Cable Plans
```bash
POST /api/integrations/services/cable/plans
```

**Request:**
```json
{
  "provider": "DSTV" | "GOTV" | "STARTIMES"
}
```

#### Subscribe to Cable
```bash
POST /api/integrations/services/cable/subscribe
```

**Request:**
```json
{
  "plan_id": "dstv_01",
  "smartcard_number": "1234567890"
}
```

### Electricity Services

#### Get Electricity Plans (DISCOs)
```bash
POST /api/integrations/services/electricity/plans
```

#### Purchase Electricity
```bash
POST /api/integrations/services/electricity/purchase
```

**Request:**
```json
{
  "disco_id": "abuja",
  "meter_number": "12345678",
  "amount": 5000
}
```

### Account Services

#### Check Balance
```bash
GET /api/integrations/services/balance
```

#### Get Recent Transactions
```bash
GET /api/integrations/services/transactions
```

#### Initiate Deposit
```bash
POST /api/integrations/services/deposit/initiate
```

**Request:**
```json
{
  "amount": 10000,
  "description": "Integration deposit"
}
```

## Authentication

All requests require your Connect Key in the `X-Connect-Key` header:

```bash
curl -X POST https://mozosubz.xyz/api/integrations/services/balance \
  -H "X-Connect-Key: connect_abc123...xyz" \
  -H "Content-Type: application/json"
```

## Error Handling

All API errors follow this format:

```json
{
  "success": false,
  "error": "Description of what went wrong"
}
```

### HTTP Status Codes

- **200/201**: Success
- **400**: Invalid request (missing parameters, invalid format)
- **401**: Unauthorized (invalid/missing Connect Key)
- **403**: Forbidden (insufficient permissions)
- **500**: Server error

## Rate Limiting

Each API key has the following limits:

- **10,000 requests per day**
- Rate limit resets at 00:00 UTC daily
- Exceeding the limit returns HTTP 429

Monitor your usage in the API Keys dashboard.

## Security Best Practices

1. **Keep your keys private**
   - Never commit keys to version control
   - Use environment variables
   - Rotate keys regularly

2. **Handle errors gracefully**
   - Implement proper error handling in your code
   - Don't expose error messages to users
   - Log errors securely

3. **Validate data**
   - Validate phone numbers before sending
   - Check balance before making purchases
   - Handle network errors and retries

4. **Monitor usage**
   - Check API key activity regularly
   - Review suspicious activity logs
   - Revoke unused keys immediately

## Code Examples

### JavaScript/Node.js

```javascript
const CONNECT_KEY = process.env.MOZOSUBZ_CONNECT_KEY;
const BASE_URL = 'https://mozosubz.xyz/api/integrations';

async function getBalance() {
  const response = await fetch(`${BASE_URL}/services/balance`, {
    method: 'GET',
    headers: {
      'X-Connect-Key': CONNECT_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}

async function buyData(network, planId, phone) {
  const response = await fetch(`${BASE_URL}/services/data/purchase`, {
    method: 'POST',
    headers: {
      'X-Connect-Key': CONNECT_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      network,
      plan_id: planId,
      recipient_phone: phone,
    }),
  });

  return await response.json();
}

// Usage
getBalance().then(data => {
  console.log('Balance:', data.formattedBalance);
}).catch(err => {
  console.error('Error:', err);
});
```

### Python

```python
import requests
import os

CONNECT_KEY = os.getenv('MOZOSUBZ_CONNECT_KEY')
BASE_URL = 'https://mozosubz.xyz/api/integrations'

headers = {
    'X-Connect-Key': CONNECT_KEY,
    'Content-Type': 'application/json',
}

def get_balance():
    response = requests.get(f'{BASE_URL}/services/balance', headers=headers)
    response.raise_for_status()
    return response.json()

def buy_data(network, plan_id, recipient_phone):
    data = {
        'network': network,
        'plan_id': plan_id,
        'recipient_phone': recipient_phone,
    }
    response = requests.post(
        f'{BASE_URL}/services/data/purchase',
        json=data,
        headers=headers
    )
    response.raise_for_status()
    return response.json()

# Usage
balance = get_balance()
print(f"Balance: {balance['formattedBalance']}")
```

### cURL

```bash
# Get Balance
curl -X GET https://mozosubz.xyz/api/integrations/services/balance \
  -H "X-Connect-Key: your_key_here" \
  -H "Content-Type: application/json"

# Buy Data
curl -X POST https://mozosubz.xyz/api/integrations/services/data/purchase \
  -H "X-Connect-Key: your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "network": "MTN",
    "plan_id": "mtn_sme_500",
    "recipient_phone": "09056458312"
  }'
```

## Troubleshooting

### "Unauthorized" Error (401)
- Verify your Connect Key is correct
- Ensure it's passed in the `X-Connect-Key` header
- Check if the key has been revoked in your dashboard

### "Insufficient permissions" Error (403)
- The key may not have permission for this operation
- Generate a new key with the required permissions
- Some endpoints require specific permissions

### "Rate limit exceeded" Error (429)
- You've exceeded your daily request limit
- Optimize your integration to reduce unnecessary calls
- Contact support if you need higher limits

### "Invalid request" Error (400)
- Double-check all required parameters
- Verify parameter format (phone numbers, amounts, etc.)
- Check for typos in network/provider names

## Support

For issues or questions:
- Visit the API documentation at `/integrations/docs`
- Check your API usage dashboard at `/integrations/keys`
- Contact support through the platform

## What's Next?

1. Generate your first API key
2. Test with the examples above
3. Build your integration
4. Monitor usage and logs
5. Scale with confidence

Happy integrating! 🚀
