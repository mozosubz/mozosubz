# Mozosubz Bot API Documentation

Complete guide for integrating Mozosubz bot services (WhatsApp, Telegram) with user authentication and purchase capabilities.

## Base URL

```
https://api.mozosubz.xyz
```

## Authentication

Bots authenticate using the Bot Auth OTP flow to obtain an API key (`connect_key`).

### Step 1: Request OTP

Request a one-time password to be sent to the user's registered email.

**Endpoint:** `POST /api/v1/bot-auth/request-otp`

**Request Body:**
```json
{
  "email": "user@example.com",
  "platform": "whatsapp",
  "identifier": "234909165926869"
}
```

**Parameters:**
- `email` (string, required): User's email address
- `platform` (string, required): Bot platform - `"whatsapp"` or `"telegram"`
- `identifier` (string, required): Phone number (format: `234XXXXXXXXXX` or `0XXXXXXXXXX`) or Telegram ID

**Response:**
```json
{
  "success": true,
  "message": "OTP sent to your email"
}
```

**Status Codes:**
- `200`: OTP sent successfully
- `400`: Validation error (invalid phone format, user not found)
- `429`: Rate limited (5 requests per minute per IP)

---

### Step 2: Verify OTP & Get API Key

Verify the OTP code and receive the API key for authenticated requests.

**Endpoint:** `POST /api/v1/bot-auth/verify-otp`

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp_code": "123456",
  "platform": "whatsapp",
  "identifier": "234909165926869"
}
```

**Parameters:**
- `email` (string, required): User's email
- `otp_code` (string, required): 6-digit OTP sent to email
- `platform` (string, required): `"whatsapp"` or `"telegram"`
- `identifier` (string, required): Phone or Telegram ID matching request-otp

**Response (New User):**
```json
{
  "success": true,
  "api_key": "connect_abc123def456ghi789jkl_66f1a2b3",
  "api_key_preview": "connect_abc12...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+234909165926869",
    "wallet_balance": 5000
  },
  "platform": "whatsapp",
  "identifier": "234909165926869"
}
```

**Response (Existing User):**
```json
{
  "success": true,
  "api_key_preview": "connect_abc12...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+234909165926869",
    "wallet_balance": 5000
  },
  "platform": "whatsapp",
  "identifier": "234909165926869"
}
```

**Status Codes:**
- `200`: OTP verified, key returned
- `400`: Invalid or expired OTP
- `404`: User not found
- `500`: Server error

**Important:** 
- The `api_key` field is only returned for NEW users on their first verification
- For existing users, the system returns their existing key (not plaintext, only preview)
- Store the full API key securely for new users - it won't be shown again
- OTP expires after 5 minutes

---

## Bot Connections

Manage which platforms are connected to a user's account.

### Get Connections

**Endpoint:** `GET /api/v1/bot-auth/connections`

**Headers:**
```
X-Connect-Key: your_api_key
```

**Response:**
```json
{
  "success": true,
  "connections": [
    {
      "id": "conn_123",
      "platform": "whatsapp",
      "identifier": "234909165926869",
      "connected_at": "2025-07-22T14:30:00Z",
      "last_active_at": "2025-07-22T15:45:00Z"
    },
    {
      "id": "conn_456",
      "platform": "telegram",
      "identifier": "987654321",
      "connected_at": "2025-07-22T16:00:00Z",
      "last_active_at": null
    }
  ]
}
```

**Status Codes:**
- `200`: Connections retrieved
- `401`: Invalid or missing API key
- `500`: Server error

---

### Disconnect Platform

**Endpoint:** `POST /api/v1/bot-auth/disconnect`

**Headers:**
```
X-Connect-Key: your_api_key
```

**Request Body:**
```json
{
  "platform": "whatsapp",
  "identifier": "234909165926869"
}
```

**Response:**
```json
{
  "success": true,
  "message": "WhatsApp disconnected successfully"
}
```

---

## Data Plans & Purchases

### Get Data Plans

Retrieve available data plans for a network.

**Endpoint:** `GET /api/v1/data/plans`

**Headers:**
```
X-Connect-Key: your_api_key
```

**Query Parameters:**
- `service` (string, required): Network service identifier

**Available Services:**
- `mtn_sme` - MTN SME
- `mtn_datashare` - MTN Data Share
- `mtn_gifting` - MTN Gifting
- `mtn_awoof` - MTN AWOOF
- `glo_data` - Glo Data
- `glo_sme` - Glo SME
- `airtel_sme` - Airtel SME
- `airtel_gifting` - Airtel Gifting
- `etisalat_data` - 9mobile Data

**Example Request:**
```
GET /api/v1/data/plans?service=mtn_sme
```

**Response:**
```json
{
  "success": true,
  "service": "mtn_sme",
  "plans": [
    {
      "plan_id": "100",
      "plan_name": "100MB - 1 Day",
      "price": 50,
      "validity_days": 1,
      "data_size": "100MB"
    },
    {
      "plan_id": "500",
      "plan_name": "500MB - 7 Days",
      "price": 200,
      "validity_days": 7,
      "data_size": "500MB"
    },
    {
      "plan_id": "1000",
      "plan_name": "1GB - 30 Days",
      "price": 1000,
      "validity_days": 30,
      "data_size": "1GB"
    }
  ]
}
```

**Status Codes:**
- `200`: Plans retrieved successfully
- `400`: Invalid service parameter
- `401`: Invalid API key
- `500`: Server error

---

### Purchase Data

Buy data for a phone number.

**Endpoint:** `POST /api/v1/data/purchase`

**Headers:**
```
Content-Type: application/json
X-Connect-Key: your_api_key
```

**Request Body:**
```json
{
  "service": "mtn_sme",
  "plan_id": "1000",
  "phone": "09165926869"
}
```

**Parameters:**
- `service` (string, required): Network service (see list above)
- `plan_id` (string, required): Plan ID from get-plans endpoint
- `phone` (string, required): Phone number (with or without country code)

**Response (Success):**
```json
{
  "success": true,
  "status": "completed",
  "transaction_id": "txn_123456789",
  "service": "mtn_sme",
  "phone": "09165926869",
  "amount": 1000,
  "plan": {
    "plan_name": "1GB - 30 Days",
    "data_size": "1GB",
    "validity_days": 30
  },
  "timestamp": "2025-07-22T14:30:00Z"
}
```

**Response (Insufficient Balance):**
```json
{
  "success": false,
  "status": "failed",
  "error": "Insufficient wallet balance",
  "amount_needed": 1000,
  "current_balance": 500
}
```

**Status Codes:**
- `200`: Purchase successful
- `400`: Invalid parameters or insufficient balance
- `401`: Invalid API key
- `429`: Rate limited
- `500`: Processing error

---

## Airtime Plans & Purchases

### Get Airtime Plans

Retrieve available airtime amounts for a network.

**Endpoint:** `GET /api/v1/airtime/plans`

**Headers:**
```
X-Connect-Key: your_api_key
```

**Query Parameters:**
- `service` (string, required): Network service identifier

**Available Services:**
- `mtn` - MTN
- `glo` - Glo
- `airtel` - Airtel
- `etisalat` - 9mobile

**Example Request:**
```
GET /api/v1/airtime/plans?service=mtn
```

**Response:**
```json
{
  "success": true,
  "service": "mtn",
  "plans": [
    {
      "plan_id": "100",
      "plan_name": "₦100 Airtime",
      "price": 100,
      "amount": 100
    },
    {
      "plan_id": "500",
      "plan_name": "₦500 Airtime",
      "price": 500,
      "amount": 500
    },
    {
      "plan_id": "2000",
      "plan_name": "₦2000 Airtime",
      "price": 2000,
      "amount": 2000
    }
  ]
}
```

---

### Purchase Airtime

Buy airtime for a phone number.

**Endpoint:** `POST /api/v1/airtime/purchase`

**Headers:**
```
Content-Type: application/json
X-Connect-Key: your_api_key
```

**Request Body:**
```json
{
  "service": "mtn",
  "amount": 2000,
  "phone": "09165926869"
}
```

**Parameters:**
- `service` (string, required): Network service
- `amount` (number, required): Airtime amount in naira
- `phone` (string, required): Phone number

**Response (Success):**
```json
{
  "success": true,
  "status": "completed",
  "transaction_id": "txn_987654321",
  "service": "mtn",
  "phone": "09165926869",
  "amount": 2000,
  "timestamp": "2025-07-22T14:30:00Z"
}
```

**Status Codes:**
- `200`: Purchase successful
- `400`: Invalid parameters or insufficient balance
- `401`: Invalid API key
- `429`: Rate limited
- `500`: Processing error

---

## Wallet Operations

### Get Wallet Balance

**Endpoint:** `GET /api/v1/wallet/balance`

**Headers:**
```
X-Connect-Key: your_api_key
```

**Response:**
```json
{
  "success": true,
  "balance": 14456,
  "currency": "NGN",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### Get Transaction History

**Endpoint:** `GET /api/v1/wallet/transactions`

**Headers:**
```
X-Connect-Key: your_api_key
```

**Query Parameters:**
- `limit` (number, optional): Number of transactions to return (default: 10, max: 100)
- `offset` (number, optional): Number of transactions to skip (default: 0)

**Example Request:**
```
GET /api/v1/wallet/transactions?limit=10&offset=0
```

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "txn_123456789",
      "type": "debit",
      "category": "data_purchase",
      "amount": 1000,
      "status": "completed",
      "description": "MTN 1GB Data Purchase - 09165926869",
      "created_at": "2025-07-22T14:30:00Z",
      "reference": "mtn_sme_1000"
    },
    {
      "id": "txn_987654321",
      "type": "debit",
      "category": "airtime_purchase",
      "amount": 2000,
      "status": "completed",
      "description": "MTN ₦2000 Airtime - 09165926869",
      "created_at": "2025-07-22T13:15:00Z",
      "reference": "mtn_2000"
    }
  ],
  "total_count": 45,
  "limit": 10,
  "offset": 0
}
```

---

## Error Handling

All endpoints return structured error responses:

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Invalid phone number format",
  "details": "Phone must be in format 09XXXXXXXXX or 234XXXXXXXXXX"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "Invalid or expired API key"
}
```

**429 Too Many Requests:**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retry_after": 60
}
```

**500 Server Error:**
```json
{
  "success": false,
  "error": "Internal server error",
  "error_id": "err_xyz123"
}
```

---

## Rate Limiting

- **OTP Requests:** 5 per minute per IP
- **General API Calls:** 10,000 per day per API key (rate limit: 50 per minute)
- **Headers:** Rate limit info included in response headers

---

## Integration Examples

### Python Bot Example

```python
import requests
import json

BASE_URL = "https://api.mozosubz.xyz"

# Step 1: Request OTP
def request_otp(email, phone, platform="whatsapp"):
    response = requests.post(
        f"{BASE_URL}/api/v1/bot-auth/request-otp",
        json={
            "email": email,
            "platform": platform,
            "identifier": phone
        }
    )
    return response.json()

# Step 2: Verify OTP & Get Key
def verify_otp(email, otp_code, phone, platform="whatsapp"):
    response = requests.post(
        f"{BASE_URL}/api/v1/bot-auth/verify-otp",
        json={
            "email": email,
            "otp_code": otp_code,
            "platform": platform,
            "identifier": phone
        }
    )
    return response.json()

# Step 3: Get Data Plans
def get_data_plans(api_key, service):
    response = requests.get(
        f"{BASE_URL}/api/v1/data/plans",
        params={"service": service},
        headers={"X-Connect-Key": api_key}
    )
    return response.json()

# Step 4: Buy Data
def buy_data(api_key, service, plan_id, phone):
    response = requests.post(
        f"{BASE_URL}/api/v1/data/purchase",
        json={
            "service": service,
            "plan_id": plan_id,
            "phone": phone
        },
        headers={"X-Connect-Key": api_key}
    )
    return response.json()

# Step 5: Buy Airtime
def buy_airtime(api_key, service, amount, phone):
    response = requests.post(
        f"{BASE_URL}/api/v1/airtime/purchase",
        json={
            "service": service,
            "amount": amount,
            "phone": phone
        },
        headers={"X-Connect-Key": api_key}
    )
    return response.json()

# Usage
if __name__ == "__main__":
    email = "user@example.com"
    phone = "09165926869"
    
    # Get OTP
    otp_resp = request_otp(email, phone)
    print("OTP Sent:", otp_resp)
    
    # Verify OTP (user enters the code)
    otp_code = input("Enter OTP: ")
    auth_resp = verify_otp(email, otp_code, phone)
    api_key = auth_resp.get("api_key") or "your_existing_key"
    print("API Key:", api_key)
    
    # Get plans
    plans = get_data_plans(api_key, "mtn_sme")
    print("Available Plans:", plans)
    
    # Buy data
    purchase = buy_data(api_key, "mtn_sme", "1000", phone)
    print("Purchase Result:", purchase)
```

### Node.js/JavaScript Example

```javascript
const BASE_URL = "https://api.mozosubz.xyz";

// Request OTP
async function requestOTP(email, phone, platform = "whatsapp") {
  const response = await fetch(`${BASE_URL}/api/v1/bot-auth/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, platform, identifier: phone })
  });
  return response.json();
}

// Verify OTP
async function verifyOTP(email, otpCode, phone, platform = "whatsapp") {
  const response = await fetch(`${BASE_URL}/api/v1/bot-auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      otp_code: otpCode,
      platform,
      identifier: phone
    })
  });
  return response.json();
}

// Get Data Plans
async function getDataPlans(apiKey, service) {
  const response = await fetch(
    `${BASE_URL}/api/v1/data/plans?service=${service}`,
    {
      headers: { "X-Connect-Key": apiKey }
    }
  );
  return response.json();
}

// Buy Data
async function buyData(apiKey, service, planId, phone) {
  const response = await fetch(`${BASE_URL}/api/v1/data/purchase`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Connect-Key": apiKey
    },
    body: JSON.stringify({
      service,
      plan_id: planId,
      phone
    })
  });
  return response.json();
}

// Usage
(async () => {
  const email = "user@example.com";
  const phone = "09165926869";
  
  // Request OTP
  const otpResp = await requestOTP(email, phone);
  console.log("OTP Sent:", otpResp);
  
  // Verify OTP (in real scenario, user provides code)
  const otpCode = "123456"; // Get from user
  const authResp = await verifyOTP(email, otpCode, phone);
  const apiKey = authResp.api_key || "your_existing_key";
  console.log("API Key:", apiKey);
  
  // Get plans
  const plans = await getDataPlans(apiKey, "mtn_sme");
  console.log("Available Plans:", plans);
  
  // Buy data
  const purchase = await buyData(apiKey, "mtn_sme", "1000", phone);
  console.log("Purchase Result:", purchase);
})();
```

---

## Best Practices

1. **Store API Keys Securely:** Store API keys in environment variables or secure vaults, not in source code
2. **Handle Rate Limits:** Implement exponential backoff for rate-limited responses
3. **Validate Phone Numbers:** Ensure phone numbers are in correct format before API calls
4. **Check Balance:** Always check wallet balance before initiating purchases
5. **Track Transactions:** Log all transactions for auditing and debugging
6. **Error Handling:** Implement comprehensive error handling for all API calls
7. **OTP Timeout:** OTP expires after 5 minutes; guide users to request new OTP if needed

---

## Support

For issues or questions:
- Check the error response details
- Review rate limiting headers
- Verify API key format and validity
- Ensure phone number format is correct
