# Bot Service Environment Variables

For your Telegram/WhatsApp bot service to connect and work 100% with Mozosubz backend, you only need these environment variables:

## Required (Essential)

```bash
# Backend API URL - Where your bot will make API calls to
API_BASE_URL=https://yourdomain.com

# Alternative (if you prefer the Next.js convention)
NEXT_PUBLIC_API_URL=https://yourdomain.com
```

**What it's used for:**
- Base URL for all API calls to bot auth endpoints
- Example: `${API_BASE_URL}/api/v1/bot-auth/request-otp`

## Optional (For Debugging/Monitoring)

```bash
# Enable debug logging
DEBUG=true
NODE_ENV=production  # or development for local testing

# Request timeout (milliseconds)
API_TIMEOUT=30000

# Optional: For CORS if needed
ALLOWED_ORIGINS=https://yourdomain.com
```

---

## Flow Overview

### 1. **User initiates connection** → Bot sends to backend:
```
POST /api/v1/bot-auth/request-otp
Body: {
  email: "user@example.com",
  platform: "whatsapp" or "telegram",
  identifier: "+234XXXXXXXXXX" (WhatsApp) or "123456789" (Telegram)
}
```
No authentication required. Backend returns OTP via email.

### 2. **User enters OTP in bot** → Bot sends to backend:
```
POST /api/v1/bot-auth/verify-otp
Body: {
  email: "user@example.com",
  otp_code: "123456",
  platform: "whatsapp" or "telegram",
  identifier: "+234XXXXXXXXXX" or "123456789"
}
```
Backend returns: `{ api_key: "ey_..." }`

### 3. **Bot stores the API key** → For all future requests:
```
GET /api/v1/wallet/balance
Headers: {
  X-Connect-Key: "ey_..."
}
```

---

## API Endpoints Your Bot Will Call

All endpoints are on your backend under `/api/v1/`:

| Endpoint | Method | Auth Required | Purpose |
|----------|--------|---------------|---------|
| `/bot-auth/request-otp` | POST | ❌ No | Send OTP to user email |
| `/bot-auth/verify-otp` | POST | ❌ No | Verify OTP & get API key |
| `/bot-auth/validate-key` | GET | ✅ Yes | Check if API key is valid |
| `/bot-auth/disconnect` | POST | ✅ Yes | Disconnect bot from account |
| `/bot-auth/connections` | GET | ✅ Yes | List connected platforms |
| `/wallet/balance` | GET | ✅ Yes | Get wallet balance |
| `/wallet/transactions` | GET | ✅ Yes | Get transaction history |
| `/wallet/deposit` | POST | ✅ Yes | Get payment link for deposit |
| `/data/plans` | GET | ✅ Yes | Get data plans with pricing |
| `/data/purchase` | POST | ✅ Yes | Buy data for phone |
| `/airtime/purchase` | POST | ✅ Yes | Buy airtime for phone |

---

## Rate Limits

All authenticated endpoints are rate-limited to **50 requests per minute** per API key.

Response header when limit reached:
```
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "success": false,
  "error": "Rate limit exceeded (50 requests per minute)",
  "remaining": 0
}
```

---

## Deployment Checklist

- [ ] Set `API_BASE_URL` or `NEXT_PUBLIC_API_URL` to your production domain
- [ ] Ensure bot service can reach your backend (no firewall blocks)
- [ ] Test OTP flow: user sends email → receives OTP email
- [ ] Test API key retrieval and storage
- [ ] Test wallet balance query with API key
- [ ] Monitor logs for "Rate limit exceeded" messages

---

## Example Implementation (Node.js)

```javascript
const API_BASE_URL = process.env.API_BASE_URL;

// 1. Request OTP
async function requestOTP(email, platform, identifier) {
  const response = await fetch(`${API_BASE_URL}/api/v1/bot-auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, platform, identifier })
  });
  return response.json();
}

// 2. Verify OTP & get API key
async function verifyOTP(email, otp_code, platform, identifier) {
  const response = await fetch(`${API_BASE_URL}/api/v1/bot-auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp_code, platform, identifier })
  });
  const data = await response.json();
  return data.api_key; // Store this!
}

// 3. Get wallet balance (requires API key)
async function getBalance(apiKey) {
  const response = await fetch(`${API_BASE_URL}/api/v1/wallet/balance`, {
    method: 'GET',
    headers: { 'X-Connect-Key': apiKey }
  });
  return response.json();
}

// 4. Get data plans (requires API key)
async function getDataPlans(apiKey) {
  const response = await fetch(`${API_BASE_URL}/api/v1/data/plans`, {
    method: 'GET',
    headers: { 'X-Connect-Key': apiKey }
  });
  return response.json();
}

// 5. Buy data (requires API key)
async function buyData(apiKey, service, plan_id, phone) {
  const response = await fetch(`${API_BASE_URL}/api/v1/data/purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Connect-Key': apiKey
    },
    body: JSON.stringify({ service, plan_id, phone })
  });
  return response.json();
}
```

---

## Testing Your Bot Connection

```bash
# 1. Test backend is reachable
curl https://yourdomain.com/api/health

# 2. Test request-otp endpoint
curl -X POST https://yourdomain.com/api/v1/bot-auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","platform":"telegram","identifier":"123456789"}'

# 3. After receiving OTP in email, test verify-otp
curl -X POST https://yourdomain.com/api/v1/bot-auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp_code":"123456","platform":"telegram","identifier":"123456789"}'

# 4. Use returned api_key to test balance
curl https://yourdomain.com/api/v1/wallet/balance \
  -H "X-Connect-Key: [api_key_from_step_3]"
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot reach backend" | Check `API_BASE_URL` is correct and backend is accessible |
| "Email not received" | Check `RESEND_API_KEY` is set on your backend, check spam folder |
| "OTP code invalid" | OTP expires after 5 minutes, request new one |
| "Rate limit exceeded" | Wait 60 seconds before next request, or implement exponential backoff |
| "API key invalid" | Verify format is correct and user hasn't disconnected bot |
