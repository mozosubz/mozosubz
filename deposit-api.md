# Wallet Deposit API Documentation

## Overview

The Deposit endpoint allows bots to initiate wallet top-ups for users. Users receive a payment link and can complete payment via card or bank transfer.

**Base URL:** `https://api.mozosubz.xyz`

---

## Endpoint

### POST /api/v1/wallet/deposit

Initiate a wallet deposit and receive payment URLs.

**URL:** `https://api.mozosubz.xyz/api/v1/wallet/deposit`

**Method:** `POST`

**Headers:**
```
X-Connect-Key: {YOUR_API_KEY}
Content-Type: application/json
```

---

## Request

```json
{
  "amount": 10000,
  "description": "Optional transaction description"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | Yes | Deposit amount in naira (minimum: ₦100, maximum: ₦500,000) |
| `description` | string | No | Optional transaction description or reference |

**Examples:**

```json
{
  "amount": 10000
}
```

```json
{
  "amount": 50000,
  "description": "Monthly subscription payment"
}
```

---

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "payment_reference": "DEP-20240115-50f1dbfb-123456",
  "transaction_id": "txn-abc123xyz789def",
  "amount": 10000,
  "processing_fee": 50,
  "net_amount": 9950,
  "checkout_url": "https://api.mozosubz.xyz/checkout/DEP-20240115-50f1dbfb-123456",
  "authorization_url": "https://checkout.bachs.io/c/abc123",
  "bank_details": {
    "account_number": "0123456789",
    "account_name": "Mozosubz Limited",
    "bank_name": "GT Bank",
    "bank_code": "058",
    "ussd_code": "*737*800*0123456789*amount#"
  },
  "expires_at": "2024-01-16T15:30:00Z",
  "remaining": 9999
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` on successful request |
| `payment_reference` | string | Unique reference for this deposit (for tracking) |
| `transaction_id` | string | Internal transaction ID |
| `amount` | number | Original deposit amount requested |
| `processing_fee` | number | Processing fee (0.5% of amount) |
| `net_amount` | number | Amount that will be credited (amount - fee) |
| `checkout_url` | string | **USE THIS** - Mozosubz payment page URL |
| `authorization_url` | string | Bachs checkout URL (open it in a browser/overlay) |
| `bank_details` | object | Bank account details for manual transfer |
| `expires_at` | string | ISO 8601 timestamp when payment link expires |
| `remaining` | number | Remaining API calls for today |

---

### Error Responses

#### 400 Bad Request - Invalid Amount

```json
{
  "success": false,
  "error": "Amount must be between ₦100 and ₦500,000",
  "error_code": "INVALID_AMOUNT",
  "status_code": 400
}
```

#### 401 Unauthorized - Invalid API Key

```json
{
  "success": false,
  "error": "Invalid or expired API key",
  "error_code": "INVALID_API_KEY",
  "status_code": 401
}
```

#### 429 Too Many Requests - Rate Limited

```json
{
  "success": false,
  "error": "Rate limit exceeded. Maximum 50 requests per minute",
  "error_code": "RATE_LIMIT_EXCEEDED",
  "status_code": 429,
  "retry_after": 60
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Internal server error. Please try again later",
  "error_code": "SERVER_ERROR",
  "status_code": 500
}
```

---

## Which URL to Use?

### ✅ `checkout_url` (RECOMMENDED)

**URL:** `https://api.mozosubz.xyz/checkout/DEP-20240115-50f1dbfb-123456`

**Use this URL when:**
- Sending payment link to users
- Building a production bot
- You want better tracking and user experience
- You need custom error handling

**Features:**
- Mozosubz branding and styling
- Integrated transaction tracking
- Better error recovery
- Mobile optimized
- Automatic redirects to the Bachs checkout

### 🔄 `authorization_url` (BACKUP)

**URL:** `https://checkout.bachs.io/c/abc123`

**Use this URL when:**
- checkout_url is unavailable
- Direct API integration required
- Building headless checkout

**Features:**
- Direct payment processor
- Less customizable
- Third-party hosted

---

## Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| `200` | Deposit initiated successfully | Send checkout_url to user |
| `400` | Invalid amount or parameters | Check request parameters |
| `401` | Invalid API key | Verify API key is correct |
| `402` | Account issue or restriction | Contact support |
| `429` | Rate limit exceeded | Wait and retry |
| `500` | Server error | Retry after 5 seconds |

---

## Rate Limiting

**Limits per API Key:**
- 50 deposit requests per minute
- 1,000 deposit requests per day

**Headers:**
```
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 49
X-RateLimit-Reset: 1705344000
Retry-After: 60 (only on 429)
```

---

## Payment Flow

```
1. User asks to deposit money
   ↓
2. Bot calls POST /api/v1/wallet/deposit
   ↓
3. Bot receives checkout_url
   ↓
4. Bot sends message: "Click here to deposit: [checkout_url]"
   ↓
5. User clicks link → Opens payment page
   ↓
6. User enters card/bank details
   ↓
7. Payment processed by Bachs
   ↓
8. Wallet credited automatically
   ↓
9. Bot can check balance with GET /api/v1/wallet/balance
```

---

## Integration Examples

### Python

```python
import requests
import json

def initiate_deposit(api_key, amount, description=None):
    """
    Initiate a wallet deposit
    
    Args:
        api_key (str): User's API key
        amount (int): Amount in naira
        description (str, optional): Transaction description
    
    Returns:
        dict: Response with checkout URL and details
    """
    url = "https://api.mozosubz.xyz/api/v1/wallet/deposit"
    
    headers = {
        "X-Connect-Key": api_key,
        "Content-Type": "application/json"
    }
    
    payload = {
        "amount": amount
    }
    
    if description:
        payload["description"] = description
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        data = response.json()
        
        if response.status_code == 200 and data.get("success"):
            return {
                "success": True,
                "checkout_url": data["checkout_url"],
                "payment_reference": data["payment_reference"],
                "amount": data["amount"],
                "fee": data["processing_fee"],
                "message": f"Pay ₦{data['amount']} to deposit ₦{data['net_amount']} into your wallet"
            }
        elif response.status_code == 429:
            return {
                "success": False,
                "error": "Too many requests. Please try again later",
                "retry_after": response.headers.get("Retry-After", 60)
            }
        else:
            return {
                "success": False,
                "error": data.get("error", "Failed to initiate deposit")
            }
    
    except requests.exceptions.Timeout:
        return {
            "success": False,
            "error": "Request timeout. Please try again"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


# Usage
if __name__ == "__main__":
    api_key = "connect_abc123def456..."
    
    # Initiate ₦10,000 deposit
    result = initiate_deposit(api_key, 10000)
    
    if result["success"]:
        print(f"Payment link: {result['checkout_url']}")
        print(f"Reference: {result['payment_reference']}")
        print(f"Message to user: {result['message']}")
    else:
        print(f"Error: {result['error']}")
```

### JavaScript/Node.js

```javascript
const axios = require('axios');

async function initiateDeposit(apiKey, amount, description = null) {
    /**
     * Initiate a wallet deposit
     * @param {string} apiKey - User's API key
     * @param {number} amount - Amount in naira
     * @param {string} description - Optional description
     * @returns {Promise<Object>} Response with checkout URL
     */
    
    try {
        const response = await axios.post(
            'https://api.mozosubz.xyz/api/v1/wallet/deposit',
            {
                amount,
                ...(description && { description })
            },
            {
                headers: {
                    'X-Connect-Key': apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );
        
        const data = response.data;
        
        return {
            success: true,
            checkoutUrl: data.checkout_url,
            paymentReference: data.payment_reference,
            amount: data.amount,
            fee: data.processing_fee,
            netAmount: data.net_amount,
            message: `Pay ₦${data.amount} to deposit ₦${data.net_amount} into your wallet`
        };
    
    } catch (error) {
        if (error.response?.status === 429) {
            return {
                success: false,
                error: 'Too many requests. Please try again later',
                retryAfter: error.response.headers['retry-after'] || 60
            };
        }
        
        return {
            success: false,
            error: error.response?.data?.error || error.message
        };
    }
}

// Usage
(async () => {
    const apiKey = 'connect_abc123def456...';
    
    const result = await initiateDeposit(apiKey, 10000);
    
    if (result.success) {
        console.log(`Payment link: ${result.checkoutUrl}`);
        console.log(`Reference: ${result.paymentReference}`);
        console.log(`Message: ${result.message}`);
    } else {
        console.error(`Error: ${result.error}`);
    }
})();
```

### cURL

```bash
curl -X POST https://api.mozosubz.xyz/api/v1/wallet/deposit \
  -H "X-Connect-Key: connect_abc123def456..." \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "description": "Deposit for services"
  }'
```

---

## Best Practices

### 1. Amount Validation

```python
# Validate amount before sending
min_amount = 100
max_amount = 500000

if amount < min_amount or amount > max_amount:
    print(f"Amount must be between ₦{min_amount} and ₦{max_amount}")
    return
```

### 2. Error Handling

```python
def handle_deposit_response(result):
    if not result.get("success"):
        error_code = result.get("error_code")
        
        if error_code == "INVALID_AMOUNT":
            # Show user: "Please enter amount between ₦100 and ₦500,000"
            pass
        elif error_code == "INVALID_API_KEY":
            # Show user: "Authentication failed, please try again"
            pass
        elif error_code == "RATE_LIMIT_EXCEEDED":
            # Show user: "Too many requests, please wait"
            pass
        else:
            # Show user: "Something went wrong, please try again"
            pass
```

### 3. Payment Tracking

```python
# Always store payment reference for reconciliation
payment_ref = result["payment_reference"]

# Store in database
database.save_pending_payment({
    "payment_reference": payment_ref,
    "user_id": user_id,
    "amount": amount,
    "timestamp": datetime.now(),
    "status": "pending"
})

# Later, webhook will confirm payment
```

### 4. User Experience

```
Bot → User:
"💳 Deposit to your wallet

Amount: ₦10,000
Fee: ₦50
You'll get: ₦9,950

👉 Pay now: [checkout_url]

Ref: DEP-20240115-50f1dbfb-123456"
```

### 5. Timeout Handling

```python
# Use appropriate timeout
response = requests.post(
    url,
    json=payload,
    headers=headers,
    timeout=30  # 30 seconds
)

# Always catch timeout exceptions
except requests.exceptions.Timeout:
    # Retry or inform user
    pass
```

---

## FAQ

**Q: How long are payment links valid?**
A: 24 hours from creation. After that, users must request a new deposit.

**Q: What happens if payment fails?**
A: User can try again. A new deposit initiation will generate a new link.

**Q: Can I change the amount after payment link is generated?**
A: No. If you need different amount, create a new deposit request.

**Q: How do I verify payment was successful?**
A: Check wallet balance using GET /api/v1/wallet/balance after payment.

**Q: Do I need to store the payment reference?**
A: Yes, for reconciliation and support purposes.

**Q: What payment methods are accepted?**
A: Card (Visa, Mastercard), Bank Transfer (USSD/Direct Transfer)

**Q: Is there a delay between payment and wallet credit?**
A: Instant for card payments, up to 5 minutes for bank transfers.

---

## Support

- **Email:** support@mozosubz.xyz
- **Documentation:** https://docs.mozosubz.xyz
- **Status:** https://status.mozosubz.xyz

---

**Last Updated:** January 2024
**API Version:** v1
**Base URL:** https://api.mozosubz.xyz
