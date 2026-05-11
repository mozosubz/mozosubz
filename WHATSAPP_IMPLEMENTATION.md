# Mozosubz WhatsApp Integration - Implementation Complete

## Overview

Built a minimal, secure WhatsApp integration API layer that allows your WhatsApp bot to:
- Authenticate users via WhatsApp number
- Securely link WhatsApp accounts to Mozosubz user accounts
- Access existing Mozosubz APIs (airtime, data, cable, electricity)
- Handle plan variants with proper disambiguation

## What Was Built

### 1. Database Layer
**File:** `lib/database/migrations/whatsapp_connections.sql`

- `whatsapp_connections` table with user-WhatsApp linking
- Unique constraints on WhatsApp numbers (one-to-one mapping)
- Token expiry and security fields
- RLS policies for secure access
- Automatic `updated_at` trigger

### 2. Utilities
**File:** `lib/utils/whatsapp-token.ts`

- Token generation: `MZ_XXXXXXXX` format
- Token hashing (SHA256) for secure storage
- WhatsApp number normalization (+234XXXXXXXXXX format)
- Phone format validation for Nigerian numbers
- Handles formats: `09056458312`, `2349056458312`, `+2349056458312`

**File:** `lib/utils/auth-check.ts`

- JWT token extraction and verification
- Supabase user authentication
- Used for profile endpoints

### 3. API Endpoints

#### `POST /api/whatsapp/connect-token`
**Requires:** Authenticated user (JWT token)
- Generates 10-minute temporary connection token
- Returns raw token (shown once to user)
- Stores hashed token in DB
- Invalidates previous unused tokens

**Response:**
```json
{
  "success": true,
  "token": "MZ_3A7B9C2F",
  "expires_in_minutes": 10,
  "instructions": "Send this token to the WhatsApp bot: LINK MZ_3A7B9C2F"
}
```

#### `POST /api/whatsapp/connect`
**Requires:** No auth (called by WhatsApp bot)
- Request: `{ "whatsapp_number": "+2349056458312", "token": "MZ_3A7B9C2F" }`
- Validates token expiry, format, uniqueness
- Links WhatsApp to Mozosubz account
- Clears token after verification

**Response:**
```json
{
  "success": true,
  "message": "WhatsApp connected successfully",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "whatsapp_number": "+2349056458312"
}
```

#### `POST /api/whatsapp/authenticate`
**Requires:** No auth (called before every transaction)
- Request: `{ "whatsapp_number": "+2349056458312" }`
- Returns user_id and context (name, email, balance)
- Used to resolve WhatsApp → Mozosubz user mapping

**Response:**
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

#### `POST /api/whatsapp/disconnect`
**Requires:** Authenticated user (JWT token)
- Deactivates WhatsApp connection
- Prevents future WhatsApp requests
- User can reconnect later

## Frontend Integration

### Profile Component
**File:** `components/whatsapp-connection.tsx`

- Clean UI for generating connection tokens
- Shows token with one-click copy button
- Displays 10-minute countdown
- Instructions on how to link WhatsApp
- Expandable section in profile page

### Profile Page
**File:** `components/profile-client.tsx`

- Added WhatsApp section (expandable)
- Imports `WhatsAppConnection` component
- Styled consistently with existing profile sections
- Located between notifications and logout

## Documentation

### API Documentation
**File:** `public/docs/WHATSAPP_API.md`

Comprehensive guide covering:
- Authentication flow (step-by-step)
- All 4 API endpoints with examples
- Plan variant handling strategy
- WhatsApp number validation rules
- Security best practices
- Error scenarios and solutions
- Rate limiting info
- Implementation checklist for bot builders

### Footer Link
**File:** `components/footer.tsx`

- Added "Developer" section to footer
- Quick link to WhatsApp API documentation
- Accessible at `/docs/WHATSAPP_API.md`

## How Your WhatsApp Bot Uses This

### 1. User Initiates Connection (Website)
```
User goes to profile → WhatsApp section → Generates token
```

### 2. User Sends Token to Bot
```
User: "LINK MZ_3A7B9C2F"
```

### 3. Bot Calls Connect Endpoint
```
POST /api/whatsapp/connect
{
  "whatsapp_number": "+2349056458312",
  "token": "MZ_3A7B9C2F"
}
```

### 4. For Every Transaction
```
POST /api/whatsapp/authenticate
{
  "whatsapp_number": "+2349056458312"
}
```
Gets user_id, then calls existing APIs:
- `/api/gsubz/airtime/purchase`
- `/api/gsubz/data/purchase`
- `/api/gsubz/cable/purchase`
- `/api/gsubz/electricity/purchase`

## Plan Variants Handling

When user says "Buy 1.5GB MTN" and there are multiple prices:

**API Returns:**
```json
{
  "plans": [
    {
      "uniqueId": "mtn_1.5gb_1500",
      "displayName": "MTN 1.5GB - ₦1,500",
      "size": "1.5GB",
      "price": 1500
    },
    {
      "uniqueId": "mtn_1.5gb_1450",
      "displayName": "MTN 1.5GB - ₦1,450 (Weekend)",
      "size": "1.5GB",
      "price": 1450
    }
  ]
}
```

**Bot AI Should:**
1. Group by size (1.5GB) when listing to user
2. Ask user to clarify which price they want
3. Use the `uniqueId` to purchase exact plan

## Security Features

✅ Tokens hashed before storage (SHA256)
✅ 10-minute token expiry window
✅ One-to-one WhatsApp ↔ User mapping
✅ Rate limiting on all endpoints
✅ WhatsApp number validation (E.164 format)
✅ RLS policies on database
✅ Previous unused tokens automatically invalidated
✅ Secure JWT verification

## Files Created

```
lib/database/migrations/
  └── whatsapp_connections.sql

lib/utils/
  ├── whatsapp-token.ts
  └── auth-check.ts

app/api/whatsapp/
  ├── connect-token/route.ts
  ├── connect/route.ts
  ├── authenticate/route.ts
  └── disconnect/route.ts

components/
  └── whatsapp-connection.tsx

public/docs/
  └── WHATSAPP_API.md

components/footer.tsx (updated)
components/profile-client.tsx (updated)
```

## Next Steps for Your Bot

1. **Read the documentation:** `/docs/WHATSAPP_API.md`
2. **Implement token linking flow:** User sends token to bot
3. **Authenticate before transactions:** Call `/api/whatsapp/authenticate`
4. **Call existing Mozosubz APIs:** With resolved user_id
5. **Handle plan variants:** Use `uniqueId` when purchasing specific plans
6. **Implement rate limiting:** On bot side to respect user quotas
7. **Add error recovery:** Handle expired tokens, reconnection flows

## Database Setup

Run the migration to create the `whatsapp_connections` table:
```sql
-- In Supabase SQL Editor or via migration tool
-- Copy content from: lib/database/migrations/whatsapp_connections.sql
```

## Testing

Test each endpoint:

```bash
# 1. Generate token (need valid user JWT)
curl -X POST http://localhost:3000/api/whatsapp/connect-token \
  -H "Authorization: Bearer <JWT_TOKEN>"

# 2. Connect WhatsApp
curl -X POST http://localhost:3000/api/whatsapp/connect \
  -H "Content-Type: application/json" \
  -d '{
    "whatsapp_number": "+2349056458312",
    "token": "MZ_3A7B9C2F"
  }'

# 3. Authenticate user
curl -X POST http://localhost:3000/api/whatsapp/authenticate \
  -H "Content-Type: application/json" \
  -d '{"whatsapp_number": "+2349056458312"}'

# 4. Disconnect (need valid user JWT)
curl -X POST http://localhost:3000/api/whatsapp/disconnect \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## Important Notes

⚠️ **All existing Mozosubz APIs work exactly the same** - no changes needed
⚠️ **WhatsApp layer is authentication only** - not business logic
⚠️ **Never trust user_id directly** - always resolve via WhatsApp number
⚠️ **Rate limiting is per endpoint** - implement additional rate limiting in your bot
⚠️ **Tokens are single-use** - user must generate new one if it expires

---

**API Documentation:** https://mozosubz.xyz/docs/WHATSAPP_API.md
**Status:** ✅ Production ready
