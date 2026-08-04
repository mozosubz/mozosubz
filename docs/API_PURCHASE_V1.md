# Mozosubb V1 API - Purchase Endpoints Documentation

Complete guide to all purchase endpoints in the Mozosubb V1 API for selling data, airtime, cable subscriptions, and electricity tokens.

## Base URL
```
https://api.mozosubz.xyz/api/v1
```

## Authentication
All endpoints require the `X-Connect-Key` header:
```
X-Connect-Key: your_connect_key_here
```

## Rate Limiting
- **50 requests per minute** per API key across all purchase endpoints
- Rate limit headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Returns `429 Too Many Requests` when exceeded

---

## Error Response Format
All errors follow a consistent format:
```json
{
  "success": false,
  "error": "Human-readable error message",
  "error_code": "ERROR_CODE",
  "transaction_id": "TXN123..." // Present in transaction errors
}
```

### Common Error Codes
- `UNAUTHORIZED` - Invalid or missing API key
- `RATE_LIMITED` - Rate limit exceeded (50 req/min)
- `FORBIDDEN` - Key lacks permission for this service
- `INVALID_REQUEST` - Malformed JSON or missing fields
- `INSUFFICIENT_BALANCE` - User wallet balance too low
- `INVALID_PHONE` - Invalid Nigerian phone number
- `INVALID_PLAN` / `INVALID_AMOUNT` - Invalid parameter value
- `ACCOUNT_NOT_FOUND` - User account doesn't exist
- `TIMEOUT_PENDING_VERIFICATION` - Request timed out; verifying in background
- `PROVIDER_UNREACHABLE` - Provider API error; wallet refunded
- `INTERNAL_ERROR` - Server error (rare)

---

## 1. Data Purchase

### Endpoint
**POST** `/data/purchase`

### Description
Purchase mobile data for a user. Requires `data` permission in API key.

### Request Body
```json
{
  "service": "mtn_sme",
  "plan_id": "1.0GB",
  "phone": "09123456789"
}
```

### Parameters
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `service` | string | Yes | Network service ID (see Service IDs below) |
| `plan_id` | string | Yes | Data plan ID (get from GET /data/plans) |
| `phone` | string | Yes | 11-digit Nigerian phone number (0XXXXXXXXXX or 234XXXXXXXXX) |

### Service IDs
- `mtn_sme` - MTN Data (SME plans)
- `mtn_corporate` - MTN Data (Corporate plans)
- `glo_direct` - Glo Direct Data
- `airtel_direct` - Airtel Direct Data
- `etisalat_direct` - Etisalat Direct Data
- `smile_direct` - Smile Direct Data

### Example Request
```bash
curl -X POST https://api.mozosubz.xyz/api/v1/data/purchase \
  -H "X-Connect-Key: your_connect_key" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "mtn_sme",
    "plan_id": "1.0GB",
    "phone": "09123456789"
  }'
```

### Success Response (200)
```json
{
  "success": true,
  "transaction_id": "V1-DATA-ABC123DEF456",
  "amount": 250.00,
  "balance_after": 4750.00,
  "status": "SUCCESS",
  "message": "1.0GB data purchase successful"
}
```

### Error Response Examples

**Insufficient Balance (402)**
```json
{
  "success": false,
  "error": "Insufficient wallet balance. Required: ₦250.00, Available: ₦100.00",
  "error_code": "INSUFFICIENT_BALANCE",
  "required": 250.00,
  "balance_after": 100.00
}
```

**Timeout (async verification)**
```json
{
  "success": false,
  "pending": true,
  "error": "Request timed out. Verifying in the background — wallet will be refunded if unsuccessful.",
  "error_code": "TIMEOUT_PENDING_VERIFICATION",
  "transaction_id": "V1-DATA-ABC123DEF456",
  "balance_after": 4750.00
}
```

---

## 2. Airtime Purchase

### Endpoint
**POST** `/airtime/purchase`

### Description
Purchase mobile airtime for a user. Requires `airtime` permission in API key.

### Request Body
```json
{
  "network": "mtn",
  "amount": 500,
  "phone": "09123456789"
}
```

### Parameters
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `network` | string | Yes | Mobile network (mtn, glo, airtel, etisalat) |
| `amount` | number | Yes | Amount in naira (min: ₦50) |
| `phone` | string | Yes | 11-digit Nigerian phone number |

### Network Values
- `mtn` - MTN Airtime
- `glo` - Glo Airtime
- `airtel` - Airtel Airtime
- `etisalat` - Etisalat (9mobile) Airtime

### Example Request
```bash
curl -X POST https://api.mozosubz.xyz/api/v1/airtime/purchase \
  -H "X-Connect-Key: your_connect_key" \
  -H "Content-Type: application/json" \
  -d '{
    "network": "mtn",
    "amount": 500,
    "phone": "09123456789"
  }'
```

### Success Response (200)
```json
{
  "success": true,
  "transaction_id": "V1-AIRTIME-ABC123DEF456",
  "amount": 500.00,
  "balance_after": 4250.00,
  "status": "SUCCESS",
  "message": "₦500.00 MTN airtime purchase successful"
}
```

### Error Response Example

**Invalid Amount (400)**
```json
{
  "success": false,
  "error": "Amount must be at least ₦50",
  "error_code": "INVALID_AMOUNT"
}
```

---

## 3. Cable Subscription

### Endpoint
**POST** `/cable/purchase`

### Description
Subscribe to cable TV packages. Requires `cable` permission in API key.

### Request Body
```json
{
  "provider": "dstv",
  "package": "Compact",
  "smartcard": "1234567890",
  "phone": "09123456789"
}
```

### Parameters
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | string | Yes | Cable provider (dstv, gotv, startimes) |
| `package` | string | Yes | Package name (must match API pricing rules) |
| `smartcard` | string | Yes | Customer smartcard/IUC number |
| `phone` | string | Yes | 11-digit Nigerian phone number |

### Provider Values
- `dstv` - DSTV Cable TV
- `gotv` - GOtv Cable TV
- `startimes` - Startimes Cable TV

### Common Packages
**DSTV**: Padi, Yanga, Compact, Compact Plus, Family, XtraView, Premiium
**GOtv**: Max, Plus, Jinja, Supa, Lite
**Startimes**: Basic, Smart, Classic, Super, Premium

### Example Request
```bash
curl -X POST https://api.mozosubz.xyz/api/v1/cable/purchase \
  -H "X-Connect-Key: your_connect_key" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "dstv",
    "package": "Compact",
    "smartcard": "1234567890",
    "phone": "09123456789"
  }'
```

### Success Response (200)
```json
{
  "success": true,
  "transaction_id": "V1-CABLE-ABC123DEF456",
  "amount": 7500.00,
  "balance_after": 2250.00,
  "status": "SUCCESS",
  "message": "Compact subscription successful"
}
```

### Error Response Example

**Package Not Available (404)**
```json
{
  "success": false,
  "error": "Package not available for API users. Contact support.",
  "error_code": "PACKAGE_NOT_ENABLED"
}
```

---

## 4. Electricity Payment

### Endpoint
**POST** `/electricity/purchase`

### Description
Pay for electricity tokens. Requires `electricity` permission in API key.

### Request Body
```json
{
  "disco": "Ikeja Electric",
  "meter_type": "PREPAID",
  "meter_number": "12345678901",
  "amount": 5000,
  "phone": "09123456789"
}
```

### Parameters
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `disco` | string | Yes | Electricity distribution company |
| `meter_type` | string | Yes | Meter type (PREPAID or POSTPAID) |
| `meter_number` | string | Yes | 11-digit meter number |
| `amount` | number | Yes | Amount in naira (min: ₦100) |
| `phone` | string | Yes | 11-digit Nigerian phone number |

### DISCO Values
- `Ikeja Electric` - Ikeja Electric Distribution
- `Eko Electric` - Eko Electricity Distribution
- `Abuja Electric` - Abuja Electricity Distribution
- `Kano Electric` - Kano Electricity Distribution
- `Port Harcourt Electric` - Port Harcourt Electricity Distribution
- `Jos Electric` - Jos Electricity Distribution
- `Ibadan Electric` - Ibadan Electricity Distribution
- `Kaduna Electric` - Kaduna Electricity Distribution
- `Enugu Electric` - Enugu Electricity Distribution
- `Benin Electric` - Benin Electricity Distribution
- `Aba Electric` - Aba Electricity Distribution
- `Yola Electric` - Yola Electricity Distribution

### Example Request
```bash
curl -X POST https://api.mozosubz.xyz/api/v1/electricity/purchase \
  -H "X-Connect-Key: your_connect_key" \
  -H "Content-Type: application/json" \
  -d '{
    "disco": "Ikeja Electric",
    "meter_type": "PREPAID",
    "meter_number": "12345678901",
    "amount": 5000,
    "phone": "09123456789"
  }'
```

### Success Response (200)
```json
{
  "success": true,
  "transaction_id": "V1-ELEC-ABC123DEF456",
  "amount": 5000.00,
  "balance_after": 750.00,
  "status": "SUCCESS",
  "message": "Electricity payment successful"
}
```

### Error Response Example

**Invalid Meter Type (400)**
```json
{
  "success": false,
  "error": "meter_type must be PREPAID or POSTPAID",
  "error_code": "INVALID_METER_TYPE"
}
```

---

## Timeout & Pending Verification

When a request times out (exceeds 120 seconds), you'll receive:

```json
{
  "success": false,
  "pending": true,
  "error": "Request timed out. Verifying in the background — wallet will be refunded if unsuccessful.",
  "error_code": "TIMEOUT_PENDING_VERIFICATION",
  "transaction_id": "V1-DATA-ABC123DEF456",
  "balance_after": 4750.00
}
```

### What This Means
1. The transaction might have been processed by the provider
2. The wallet has been deducted (same as successful transaction)
3. A background job is verifying the status every 500ms for up to 2 minutes
4. Check transaction history later to see the final status (SUCCESS or FAILED with refund)
5. If verification confirms failure, the wallet will be refunded automatically

### Handling Pending Transactions
```javascript
// Check transaction status from wallet transaction history
const response = await fetch('/api/v1/wallet/transactions', {
  headers: { 'X-Connect-Key': 'your_key' }
});
const { transactions } = await response.json();
const tx = transactions.find(t => t.transaction_id === 'V1-DATA-ABC123DEF456');

if (tx.status === 'SUCCESS') {
  // Transaction successful, wallet deducted
} else if (tx.status === 'FAILED') {
  // Transaction failed, wallet should be refunded
}
```

---

## Success Criteria

A transaction is considered **successful** when:
- ✅ Wallet is deducted
- ✅ Transaction saved with `SUCCESS` status
- ✅ Provider confirms delivery
- ✅ Response code is 200

A transaction **fails** when:
- ❌ Wallet is NOT deducted (or refunded if PENDING → FAILED)
- ❌ Transaction saved with `FAILED` status
- ❌ Provider rejects or times out
- ❌ Response code is 400, 402, 502, or 429

---

## Best Practices

### 1. Phone Number Validation
Always validate phone numbers before sending:
```javascript
const isValidNigerianPhone = (phone) => {
  const cleaned = String(phone).replace(/\s+/g, '');
  return /^(0|234|\+234)\d{10}$/.test(cleaned) || /^\d{11}$/.test(cleaned);
};
```

### 2. Amount Validation
Validate minimum amounts:
- Data: Check available plans for minimum
- Airtime: Minimum ₦50
- Cable: Check pricing rules
- Electricity: Minimum ₦100

### 3. Error Handling
```javascript
try {
  const response = await fetch('/api/v1/data/purchase', { /* ... */ });
  const data = await response.json();

  if (response.status === 429) {
    // Rate limited — wait 60 seconds
  } else if (response.status === 402) {
    // Insufficient balance
  } else if (response.status === 200 && !data.success && data.pending) {
    // Pending verification — check back later
  } else if (response.status === 200 && data.success) {
    // Success
  }
} catch (error) {
  // Network error
}
```

### 4. Idempotency
Don't retry immediately on timeout. Check transaction history first:
```javascript
// WRONG: Retry immediately
retry(() => purchaseData(...)); // May double-charge if pending

// CORRECT: Check status first
const tx = await checkTransaction(transactionId);
if (tx.status === 'PENDING') {
  // Wait 2-3 minutes before deciding to retry
} else if (tx.status === 'FAILED') {
  // Safe to retry
}
```

### 5. User Communication
- **Pending**: "Your transaction is being verified. This usually takes less than a minute."
- **Failed**: "Transaction failed. Your wallet has been refunded. Please try again."
- **Success**: "Transaction successful. Credit has been applied."

---

## API Key Permissions

Your API key must have at least one of:
- `data` - Can purchase data
- `airtime` - Can purchase airtime
- `cable` - Can subscribe to cable
- `electricity` - Can pay electricity
- `all` - Can perform all operations

Request permission updates from support.

---

## Pricing & Markup

### Data
Base price + markup (fixed or percentage) from API pricing rules

### Airtime
Charged exactly as specified (no markup)

### Cable
Base price + markup from API pricing rules

### Electricity
Charged exactly as specified (no markup)

**Check** your admin dashboard under "API Pricing Rules" to see configured margins.

---

## Support

For issues or questions:
1. Check error message and error code above
2. Review the example requests
3. Validate your API key has correct permissions
4. Contact support with transaction ID for errors

---

## Changelog

### v1.0 (May 2026)
- ✅ Data purchase
- ✅ Airtime purchase
- ✅ Cable subscription
- ✅ Electricity payment
- ✅ Timeout/pending verification
- ✅ Rate limiting (50 req/min)
- ✅ Atomic wallet deduction
