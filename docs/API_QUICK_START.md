# Mozosubb V1 API - Quick Start Guide

Get up and running with the Mozosubb API in 5 minutes.

## Step 1: Get Your API Key

1. Log in to your Mozosubb dashboard
2. Go to **Settings → API Keys**
3. Click **Generate New Key**
4. Give it a name and select permissions:
   - `data` - To sell data plans
   - `airtime` - To sell airtime
   - `cable` - To sell cable subscriptions
   - `electricity` - To sell electricity
5. Copy the key (shown only once)

## Step 2: Make Your First Request

### Data Purchase
```bash
curl -X POST https://api.mozosubz.xyz/api/v1/data/purchase \
  -H "X-Connect-Key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "mtn_sme",
    "plan_id": "1.0GB",
    "phone": "09123456789"
  }'
```

### Response
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

## Step 3: Available Endpoints

| Endpoint | Method | Permission | Description |
|----------|--------|-----------|-------------|
| `/data/purchase` | POST | `data` | Buy mobile data |
| `/airtime/purchase` | POST | `airtime` | Buy airtime credit |
| `/cable/purchase` | POST | `cable` | Subscribe to cable TV |
| `/electricity/purchase` | POST | `electricity` | Pay for electricity |
| `/wallet/balance` | GET | any | Check wallet balance |
| `/wallet/transactions` | GET | any | View transaction history |

## Step 4: Handle Responses

### Success (200)
```json
{
  "success": true,
  "transaction_id": "V1-DATA-ABC123",
  "amount": 250.00,
  "balance_after": 4750.00,
  "status": "SUCCESS"
}
```

### Pending Verification (async)
```json
{
  "success": false,
  "pending": true,
  "error": "Request timed out. Verifying in the background...",
  "error_code": "TIMEOUT_PENDING_VERIFICATION",
  "transaction_id": "V1-DATA-ABC123",
  "balance_after": 4750.00
}
```

Check back later — wallet is either charged (success) or refunded (failure).

### Error (400-500)
```json
{
  "success": false,
  "error": "Insufficient wallet balance",
  "error_code": "INSUFFICIENT_BALANCE",
  "balance_after": 100.00
}
```

## Step 5: Code Examples

### JavaScript/Node.js
```javascript
const API_KEY = 'your_api_key_here';

async function purchaseData(service, planId, phone) {
  try {
    const response = await fetch('https://api.mozosubz.xyz/api/v1/data/purchase', {
      method: 'POST',
      headers: {
        'X-Connect-Key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: service,
        plan_id: planId,
        phone: phone,
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log('✓ Success:', data.transaction_id, data.amount);
      return { status: 'SUCCESS', ...data };
    } else if (data.pending) {
      console.log('⏳ Pending:', data.transaction_id);
      return { status: 'PENDING', ...data };
    } else {
      console.error('✗ Error:', data.error);
      return { status: 'FAILED', ...data };
    }
  } catch (error) {
    console.error('Network error:', error);
    return { status: 'ERROR', error: error.message };
  }
}

// Usage
const result = await purchaseData('mtn_sme', '1.0GB', '09123456789');
```

### Python
```python
import requests
import json

API_KEY = 'your_api_key_here'
BASE_URL = 'https://api.mozosubz.xyz/api/v1'

def purchase_data(service, plan_id, phone):
    headers = {
        'X-Connect-Key': API_KEY,
        'Content-Type': 'application/json'
    }
    
    payload = {
        'service': service,
        'plan_id': plan_id,
        'phone': phone
    }
    
    try:
        response = requests.post(
            f'{BASE_URL}/data/purchase',
            headers=headers,
            json=payload
        )
        data = response.json()
        
        if data.get('success'):
            print(f"✓ Success: {data['transaction_id']}")
            return {'status': 'SUCCESS', **data}
        elif data.get('pending'):
            print(f"⏳ Pending: {data['transaction_id']}")
            return {'status': 'PENDING', **data}
        else:
            print(f"✗ Error: {data['error']}")
            return {'status': 'FAILED', **data}
    except requests.exceptions.RequestException as e:
        print(f"Network error: {e}")
        return {'status': 'ERROR', 'error': str(e)}

# Usage
result = purchase_data('mtn_sme', '1.0GB', '09123456789')
```

### PHP
```php
<?php
$apiKey = 'your_api_key_here';
$baseUrl = 'https://api.mozosubz.xyz/api/v1';

function purchaseData($service, $planId, $phone) {
    global $apiKey, $baseUrl;
    
    $url = $baseUrl . '/data/purchase';
    
    $payload = [
        'service' => $service,
        'plan_id' => $planId,
        'phone' => $phone
    ];
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            'X-Connect-Key: ' . $apiKey,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $data = json_decode($response, true);
    curl_close($ch);
    
    if ($data['success']) {
        echo "✓ Success: " . $data['transaction_id'];
        return ['status' => 'SUCCESS', ...$data];
    } elseif ($data['pending']) {
        echo "⏳ Pending: " . $data['transaction_id'];
        return ['status' => 'PENDING', ...$data];
    } else {
        echo "✗ Error: " . $data['error'];
        return ['status' => 'FAILED', ...$data];
    }
}

// Usage
$result = purchaseData('mtn_sme', '1.0GB', '09123456789');
```

## Validation Checklist

- ✅ API key is valid and has correct permissions
- ✅ Phone number is valid Nigerian format (11 digits)
- ✅ Service/network IDs are correct
- ✅ Wallet has sufficient balance
- ✅ Handling both success and timeout scenarios
- ✅ Not retrying immediately on timeout

## Common Issues

### 401 Unauthorized
- Missing or invalid `X-Connect-Key` header
- Check your API key in settings

### 403 Forbidden
- API key lacks required permission
- Add permission in settings or use different key

### 402 Insufficient Balance
- User wallet balance is too low
- Advise user to fund wallet first

### 429 Rate Limited
- Exceeded 50 requests per minute
- Implement backoff: wait 60 seconds before retrying

### Timeout (TIMEOUT_PENDING_VERIFICATION)
- Request took >120 seconds
- Check back after 2-3 minutes for final status
- Don't retry immediately

## Full API Documentation

For complete details on all endpoints, parameters, and error codes:
- **Purchases**: See [API_PURCHASE_V1.md](./API_PURCHASE_V1.md)
- **Bot Auth**: See [BOT_AUTH_API.md](./BOT_AUTH_API.md)

## Support

Need help?
1. Check error code in response
2. Review relevant documentation
3. Validate phone numbers and parameters
4. Contact support with transaction ID

---

Happy selling! 🚀
