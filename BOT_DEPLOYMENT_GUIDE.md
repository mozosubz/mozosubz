# Mozosubz Bot Deployment Guide

This guide explains how to set up and deploy WhatsApp and Telegram bots that connect to Mozosubz backend.

## Quick Setup

### 1. Clone the example environment file
```bash
cp .env.bot.example .env.bot.local
```

### 2. Fill in the required values (see sections below)

### 3. Deploy to your hosting (Heroku, Railway, Render, AWS Lambda, etc)

---

## Environment Variables Explained

### Core URLs

**`NEXT_PUBLIC_API_URL`** (Required)
- Your deployed Mozosubz backend URL
- Example: `https://mozosubz.com` or `https://api.staging.mozosubz.com`
- Used by bots to make API calls to backend

**`API_BASE_URL`** (Required)
- Same as NEXT_PUBLIC_API_URL for backend services
- Example: `https://mozosubz.com`

### Endpoints (Fixed - Don't Change)

All these are FIXED paths on your backend. Copy them exactly as shown:

```
BOT_AUTH_REQUEST_OTP_ENDPOINT=/api/v1/bot-auth/request-otp
BOT_AUTH_VERIFY_OTP_ENDPOINT=/api/v1/bot-auth/verify-otp
BOT_AUTH_VALIDATE_KEY_ENDPOINT=/api/v1/bot-auth/validate-key
BOT_AUTH_DISCONNECT_ENDPOINT=/api/v1/bot-auth/disconnect
BOT_AUTH_CONNECTIONS_ENDPOINT=/api/v1/bot-auth/connections

WALLET_BALANCE_ENDPOINT=/api/v1/wallet/balance
WALLET_TRANSACTIONS_ENDPOINT=/api/v1/wallet/transactions
WALLET_DEPOSIT_ENDPOINT=/api/v1/wallet/deposit

DATA_PLANS_ENDPOINT=/api/v1/data/plans
DATA_PURCHASE_ENDPOINT=/api/v1/data/purchase
AIRTIME_PURCHASE_ENDPOINT=/api/v1/airtime/purchase
```

---

## Telegram Bot Setup

### 1. Create a Telegram Bot

1. Open Telegram and search for **`@BotFather`**
2. Send `/start` and follow the prompts
3. Send `/newbot`
4. Choose a name (e.g., "Mozosubz Bot")
5. Choose a username (e.g., "mozosubz_bot") - must be unique and end with "bot"
6. You'll receive a TOKEN that looks like: `123456789:ABCdefGHijklmnoPQRstuvWXYZ1234567890`

### 2. Set Environment Variables

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHijklmnoPQRstuvWXYZ1234567890
TELEGRAM_BOT_USERNAME=mozosubz_bot
TELEGRAM_WEBHOOK_URL=https://your-bot-server.com/webhook/telegram  # optional
```

### 3. Testing Locally

```bash
# Your bot uses polling (checks for messages every few seconds)
# No webhook needed for local testing
# Just run your bot service and it will work
npm run dev  # or whatever your startup command is
```

### 4. Deploy and Set Webhook (Optional)

If using webhooks (recommended for production):

```bash
curl -X POST \
  https://api.telegram.org/bot123456789:ABCdefGHijklmnoPQRstuvWXYZ1234567890/setWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-bot-server.com/webhook/telegram",
    "allowed_updates": ["message", "callback_query"]
  }'
```

---

## WhatsApp Bot Setup

### 1. Get WhatsApp Business Account

1. Go to [Meta Developers](https://developers.facebook.com)
2. Create an app → select "WhatsApp Business"
3. Add WhatsApp product
4. Get:
   - **Business Account ID**
   - **Phone Number ID** (the WhatsApp number you'll use)
   - **Access Token** (with `whatsapp_business_messaging` permission)

### 2. Set Environment Variables

```env
WHATSAPP_BUSINESS_ACCOUNT_ID=102345678901234
WHATSAPP_PHONE_NUMBER_ID=1234567890123456
WHATSAPP_ACCESS_TOKEN=EAABsbCS1iHgBAMZAZAZAZAZC1234567890...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=my_random_verify_token_12345
WHATSAPP_BUSINESS_PHONE=+234800000000
```

### 3. Configure Webhook

1. Go to Meta App Dashboard → WhatsApp → Configuration
2. Set Webhook URL: `https://your-bot-server.com/webhook/whatsapp`
3. Set Verify Token: Same as `WHATSAPP_WEBHOOK_VERIFY_TOKEN` above
4. Subscribe to webhook events:
   - `messages` ✓
   - `message_status` ✓
   - `message_template_status_update` ✓

### 4. Testing Locally

For local testing with WhatsApp webhooks:

```bash
# Use ngrok to expose your local server to the internet
ngrok http 3000

# Update webhook URL in Meta Dashboard with ngrok URL:
# https://your-ngrok-url.ngrok.io/webhook/whatsapp
```

---

## Bot Flow Explanation

### 1. User Initiates Contact

- User sends WhatsApp or Telegram message to your bot
- Bot receives message with user's chat ID / phone number

### 2. Bot Requests OTP

- Bot sends request to `/api/v1/bot-auth/request-otp` with user's email
- Backend sends OTP via email
- Bot tells user: "Check your email for a code"

### 3. User Verifies OTP

- User replies with OTP code
- Bot sends to `/api/v1/bot-auth/verify-otp` with OTP + platform + identifier
- Backend responds with `api_key` (connect_key)
- Bot stores the key for future API calls

### 4. Bot Uses API Key

- All future requests include `X-Connect-Key: {api_key}` header
- Bot can now call wallet, data purchase, airtime, etc. endpoints
- Each request is rate-limited to 50 per minute

### 5. User Disconnects

- User sends "disconnect" or removes bot
- Bot calls `/api/v1/bot-auth/disconnect` to remove bot_connections record
- Next time user contacts bot, OTP flow restarts

---

## Making API Calls from Bot

### Example: Request OTP

```bash
curl -X POST https://mozosubz.com/api/v1/bot-auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "platform": "telegram",
    "identifier": "123456789"
  }'
```

Response:
```json
{
  "success": true,
  "message": "OTP sent to email"
}
```

### Example: Verify OTP

```bash
curl -X POST https://mozosubz.com/api/v1/bot-auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "otp_code": "123456",
    "platform": "telegram",
    "identifier": "123456789"
  }'
```

Response:
```json
{
  "success": true,
  "api_key": "mk_live_abc123...",
  "user": {
    "name": "John Doe",
    "email": "user@example.com",
    "phone": "2348012345678",
    "wallet_balance": 5000
  }
}
```

### Example: Check Balance (with API Key)

```bash
curl -X GET https://mozosubz.com/api/v1/wallet/balance \
  -H "X-Connect-Key: mk_live_abc123..."
```

Response:
```json
{
  "success": true,
  "balance": 5000,
  "currency": "NGN",
  "remaining": 49  // API calls remaining this minute
}
```

### Example: Buy Data

```bash
curl -X POST https://mozosubz.com/api/v1/data/purchase \
  -H "X-Connect-Key: mk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "service": "mtn",
    "plan_id": "1gb",
    "phone": "2348012345678"
  }'
```

Response:
```json
{
  "success": true,
  "transaction_id": "txn_abc123...",
  "plan": "MTN 1GB",
  "phone": "2348012345678",
  "amount": 250,
  "balance_after": 4750,
  "remaining": 48
}
```

---

## Rate Limiting & Error Handling

### Rate Limits

- **OTP requests**: 5 per hour per user (prevent spam)
- **API calls**: 50 per minute per API key (X-Connect-Key)

### Common Errors

```json
// 401 - Invalid or missing API key
{
  "success": false,
  "error": "Invalid API key"
}

// 429 - Rate limit exceeded
{
  "success": false,
  "error": "Rate limit exceeded (50 requests per minute)"
}

// 400 - Missing fields
{
  "success": false,
  "error": "Missing required field: phone"
}

// 500 - Server error
{
  "success": false,
  "error": "Server error. Please try again later."
}
```

---

## Debugging

### Enable Debug Mode

```env
BOT_DEBUG_MODE=true
```

This will log all API requests and responses.

### Check Logs

Most hosting platforms (Railway, Render, Heroku) have built-in log viewers:

```bash
# Heroku
heroku logs --tail

# Railway
railway logs

# View locally
tail -f logs/bot.log
```

### Test Endpoints Manually

Use the curl examples above or Postman to test each endpoint independently.

---

## Deployment Checklist

- [ ] Copy `.env.bot.example` → `.env.bot.local` (or your hosting platform's env setup)
- [ ] Fill in `NEXT_PUBLIC_API_URL` with your backend domain
- [ ] For Telegram: Get `TELEGRAM_BOT_TOKEN` from BotFather
- [ ] For WhatsApp: Get credentials from Meta Developers
- [ ] Deploy bot service to your hosting
- [ ] Test with `/health` or equivalent health check endpoint
- [ ] Have a test user send a message to verify it works
- [ ] Monitor logs for errors
- [ ] Set up alerts for failed API calls

---

## Support

- Bot auth API docs: See DEVELOPER_PROMPT.md
- Error troubleshooting: Check BOT_DEBUG_MODE logs
- Connection issues: Verify NEXT_PUBLIC_API_URL is correct and accessible
- Rate limit exceeded: Space out requests or contact Mozosubz team for higher limits
