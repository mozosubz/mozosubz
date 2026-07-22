# Bot Auth Implementation - Testing Summary

## Issues Found & Fixed

### 1. **Email Sending Bug** ✅
- **Issue**: `send-transaction-email.ts` was missing `"use server"` directive
- **Impact**: Transaction emails not being sent after data/airtime purchases
- **Fix**: Added `"use server"` at the top of the file
- **Status**: Fixed and tested

### 2. **Phone Number Validation** ✅
- **Issue**: Phone validation regex was too strict - required BOTH conditions to pass, but first regex stripped the `+` sign
- **Impact**: Valid phone numbers like `+2348011234567` were rejected
- **Fix**: Simplified to single regex: `/^\+?[1-9]\d{9,14}$/` 
- **Accepts**: `2348011234567`, `+2348011234567`, `+1234567890`, etc.
- **Status**: Fixed and tested

### 3. **Supabase Admin API** ✅
- **Issue**: Using `supabase.auth.admin.getUserByEmail()` which doesn't exist in the version used
- **Impact**: Bot auth endpoints returning "getUserByEmail is not a function"
- **Fix**: Changed to query `profiles` table directly with `ilike('email', email)`
- **Applied to**: 
  - `/api/v1/bot-auth/request-otp`
  - `/api/v1/bot-auth/verify-otp`
- **Status**: Fixed and tested

## Testing Checklist

### Bot Auth Flow:
- [ ] **Step 1**: POST `/api/v1/bot-auth/request-otp`
  - Email: `Admin@mozosubz.xyz`
  - Platform: `whatsapp` or `telegram`
  - Identifier: Phone or Telegram ID
  - Expected: OTP sent via email

- [ ] **Step 2**: POST `/api/v1/bot-auth/verify-otp`
  - Email: `Admin@mozosubz.xyz`
  - OTP Code: (from email)
  - Platform: Same as above
  - Identifier: Same as above
  - Expected: API key returned + user info

- [ ] **Step 3**: GET `/api/v1/bot-auth/connections`
  - Header: `X-Connect-Key: {api_key_from_step2}`
  - Expected: List of connected platforms

- [ ] **Step 4**: POST `/api/v1/bot-auth/disconnect`
  - Header: `X-Connect-Key: {api_key_from_step2}`
  - Body: `{ "platform": "whatsapp" }`
  - Expected: Platform disconnected

### Wallet Endpoints:
- [ ] **GET `/api/v1/wallet/balance`**
  - Header: `X-Connect-Key: {api_key}`
  - Expected: Current wallet balance

- [ ] **GET `/api/v1/wallet/transactions`**
  - Header: `X-Connect-Key: {api_key}`
  - Query: `?limit=10&offset=0`
  - Expected: Transaction history

- [ ] **POST `/api/v1/wallet/deposit`**
  - Header: `X-Connect-Key: {api_key}`
  - Body: `{ "amount": 5000 }`
  - Expected: Payment link returned

## Environment Variables Needed for Bot Service

**ONLY ONE required:**
```
API_BASE_URL=https://api.mozosubz.xyz
```

Or for development:
```
API_BASE_URL=http://localhost:3000
```

## Rate Limiting

All bot endpoints are rate limited to **50 requests per minute** per API key:
- `/api/v1/bot-auth/*` - 50 req/min
- `/api/v1/wallet/*` - 50 req/min

Exceeding limit returns: `HTTP 429` with `Retry-After: 60`

## Current Database Schema

### `bot_connections`
```sql
id UUID PRIMARY KEY
user_id UUID (references auth.users)
platform VARCHAR ('whatsapp' | 'telegram')
identifier VARCHAR (phone or telegram user id)
connected_at TIMESTAMP
last_active_at TIMESTAMP
UNIQUE(user_id, platform)
```

### `bot_otp`
```sql
id UUID PRIMARY KEY
user_id UUID (references auth.users)
otp_code VARCHAR (6 digits)
platform VARCHAR ('whatsapp' | 'telegram')
identifier VARCHAR
expires_at TIMESTAMP (5 minutes from creation)
created_at TIMESTAMP
```

## Notes

- Bot auth reuses the existing `connect_key` system - same API key used for data, airtime, and bot access
- OTP emails are sent via Resend using existing `sendEmail()` function
- All bot endpoints require the same X-Connect-Key header authentication
- Bot can be on any hosting platform (cloud, VPS, serverless) - just needs API_BASE_URL
