# Mozosubz WhatsApp Integration API

## Overview

The WhatsApp Integration API enables your WhatsApp bot to securely connect WhatsApp numbers to Mozosubz user accounts, authenticate users, and proxy requests to existing Mozosubz APIs.

**Architecture:**
```
WhatsApp Bot + AI
     ↓
Mozosubz WhatsApp Auth Layer
     ↓
Existing Mozosubz APIs (Airtime, Data, Cable, Electricity, etc.)
     ↓
Database / Service Providers
```

## Authentication Flow

### Step 1: Generate Connection Token (Website)

User initiates connection from their Mozosubz profile.

**Endpoint:** `POST /api/whatsapp/connect-token`

**Authentication:** User must be logged into Mozosubz website

**Request:**
```bash
POST https://mozosubz.xyz/api/whatsapp/connect-token
Authorization: Bearer <user_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "token": "MZ_3A7B9C2F",
  "expires_in_minutes": 10,
  "instructions": "Send this token to the WhatsApp bot: LINK MZ_3A7B9C2F"
}
```

**Error Response:**
```json
{
  "error": "User already has an active WhatsApp connection. Disconnect first to link a different number."
}
```

**Rules:**
- Token is valid for 10 minutes
- Each user can only have one active WhatsApp connection
- Token can only be used once
- Previous unused tokens are automatically invalidated

---

### Step 2: Connect WhatsApp Number (Bot)

User sends the token to the WhatsApp bot.

**Message Format:**
```
LINK MZ_3A7B9C2F
```

**Endpoint:** `POST /api/whatsapp/connect`

**Request:**
```json
{
  "whatsapp_number": "+2349056458312",
  "token": "MZ_3A7B9C2F"
}
```

**Response:**
```json
{
  "success": true,
  "message": "WhatsApp connected successfully",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "whatsapp_number": "+2349056458312"
}
```

**Error Responses:**

```json
{
  "error": "Invalid WhatsApp number format"
}
```

```json
{
  "error": "Token expired. Generate a new one."
}
```

```json
{
  "error": "This WhatsApp number is already connected to another account"
}
```

**Validation Rules:**
- WhatsApp number must be valid Nigerian format (+234XXXXXXXXXX)
- Supports formats: 09056458312, 2349056458312, +2349056458312
- One WhatsApp number can only be connected to one Mozosubz account
- Token must not be expired (10 minute window)

---

## User Authentication

### Authenticate WhatsApp User

Called by your WhatsApp bot before processing requests.

**Endpoint:** `POST /api/whatsapp/authenticate`

**Request:**
```json
{
  "whatsapp_number": "+2349056458312"
}
```

**Success Response (User Authenticated):**
```json
{
  "success": true,
  "authenticated": true,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_email": "user@example.com",
  "user_name": "Igangan Godspower",
  "wallet_balance": 50000
}
```

**Not Connected Response:**
```json
{
  "success": true,
  "authenticated": false,
  "message": "WhatsApp number not connected"
}
```

**Rules:**
- No authentication token required (WhatsApp number is the identifier)
- Returns resolved user_id for use with existing Mozosubz APIs
- Returns user context (name, email, balance) for conversational responses
- Only returns active connections (not disconnected)

---

## Disconnect WhatsApp

User can disconnect WhatsApp from their profile.

**Endpoint:** `POST /api/whatsapp/disconnect`

**Authentication:** User must be logged into Mozosubz website

**Request:**
```bash
POST https://mozosubz.xyz/api/whatsapp/disconnect
Authorization: Bearer <user_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "WhatsApp disconnected successfully"
}
```

**Error Response:**
```json
{
  "error": "No active WhatsApp connection found"
}
```

---

## Using Mozosubz APIs with WhatsApp Authentication

Once a WhatsApp user is authenticated, your bot can call existing Mozosubz APIs.

### Example: Buy Airtime

**Step 1:** Authenticate user
```bash
POST /api/whatsapp/authenticate
{
  "whatsapp_number": "+2349056458312"
}
```

**Step 2:** Use returned user_id with existing API
```bash
POST /api/gsubz/airtime/purchase
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "phone": "09056458312",
  "network": "MTN",
  "amount": 1000
}
```

**Important:** All existing Mozosubz APIs work exactly the same. No changes needed to existing logic.

---

## Handling Plan Variants (Multiple Prices)

When fetching data plans, you may receive multiple variants of the same size with different prices.

### Example: MTN 1.5GB Plans

```json
{
  "success": true,
  "plans": [
    {
      "serviceId": "mtn-data-1.5gb-monthly",
      "uniqueId": "mtn_1.5gb_1500",
      "displayName": "MTN 1.5GB - ₦1,500",
      "size": "1.5GB",
      "price": 1500,
      "duration": "30 days",
      "validity": "1 month"
    },
    {
      "serviceId": "mtn-data-1.5gb-monthly",
      "uniqueId": "mtn_1.5gb_1450",
      "displayName": "MTN 1.5GB - ₦1,450 (Weekend)",
      "size": "1.5GB",
      "price": 1450,
      "duration": "30 days (Weekend Only)",
      "validity": "1 month"
    }
  ]
}
```

### AI Handling Strategy

1. **Group plans by size:** When listing plans to the user, group them by size (1.5GB, 2GB, etc.)

2. **Handle ambiguity:** If user says "Get 1.5GB MTN", clarify which variant they want:
   ```
   "I found 2 MTN 1.5GB plans:
   1. MTN 1.5GB - ₦1,500 (30 days)
   2. MTN 1.5GB - ₦1,450 (Weekend Only)
   
   Which one would you like?"
   ```

3. **Use uniqueId for purchases:** Once user selects, use the `uniqueId` to purchase:
   ```json
   {
     "plan_id": "mtn_1.5gb_1500",
     "user_id": "550e8400-e29b-41d4-a716-446655440000",
     "phone": "09056458312"
   }
   ```

4. **Group response:** When listing all plans, format like:
   ```
   📊 Available MTN Plans:
   
   💾 1.5GB
   • ₦1,500 (30 days) 
   • ₦1,450 (Weekend)
   
   💾 2GB
   • ₦2,000 (30 days)
   • ₦1,900 (Weekend)
   ```

---

## API Response Format

All WhatsApp auth endpoints return consistent JSON responses:

```json
{
  "success": boolean,
  "message": "optional description",
  "error": "optional error message",
  "data": {}
}
```

---

## Rate Limiting

- **Connect-Token:** 3 requests per hour per user
- **Connect:** 10 requests per hour per WhatsApp number
- **Authenticate:** 100 requests per minute (for bot)
- **Disconnect:** 5 requests per hour per user

---

## Security Considerations

1. **Token Security:**
   - Tokens are hashed before storage (SHA256)
   - Raw token shown only once to user
   - 10-minute expiration window

2. **WhatsApp Number Validation:**
   - Only valid Nigerian numbers (+234XXXXXXXXXX)
   - Normalized to E.164 format

3. **User Verification:**
   - WhatsApp numbers must be linked by authenticated users
   - One-to-one mapping between WhatsApp and Mozosubz accounts
   - Connections can be disconnected anytime

4. **Webhook Security (When Implemented):**
   - Meta provides X-Hub-Signature header
   - Always verify webhook signatures
   - Rate limit webhook handlers

---

## Error Handling

Common error scenarios and responses:

| Error | Code | Solution |
|-------|------|----------|
| Invalid token format | 400 | Regenerate token from profile |
| Token expired | 400 | Generate new token (valid for 10 min) |
| WhatsApp already linked | 400 | Disconnect existing connection first |
| Invalid WhatsApp number | 400 | Use valid format: +2349056458312 |
| User not authenticated | 401 | Login to website to generate token |
| Server error | 500 | Retry after 30 seconds |

---

## Implementation Checklist for WhatsApp Bot

- [ ] Implement token generation flow (direct user to website)
- [ ] Parse "LINK <token>" message format
- [ ] Call `/api/whatsapp/connect` endpoint
- [ ] Store returned `user_id` for session
- [ ] Call `/api/whatsapp/authenticate` for incoming messages
- [ ] Implement AI-powered request parsing
- [ ] Call existing Mozosubz APIs with resolved user_id
- [ ] Format responses for WhatsApp
- [ ] Handle plan variants with user clarification
- [ ] Implement rate limiting on bot side
- [ ] Add error recovery flows

---

## Contact & Support

For issues or questions about the WhatsApp API:
- Email: api-support@mozosubz.xyz
- Docs: https://mozosubz.xyz/docs/whatsapp
