# Bot Authentication API Documentation

All bot auth endpoints require the `X-Connect-Key` header with a valid connect key.

## Base URL
```
https://api.mozosubz.xyz/api/v1/bot-auth
```

## Authentication
All endpoints require the `X-Connect-Key` header:
```
X-Connect-Key: your_connect_key_here
```

---

## Endpoints

### 1. Get Connected Bots
**GET** `/connections`

Lists all currently connected bot platforms for the authenticated user.

**Headers:**
```
X-Connect-Key: your_connect_key
```

**Response (200):**
```json
{
  "success": true,
  "connections": [
    {
      "platform": "telegram",
      "identifier": "7013439166",
      "connected_at": "2025-07-23T12:26:00Z",
      "last_active_at": "2025-07-23T12:26:30Z"
    },
    {
      "platform": "whatsapp",
      "identifier": "09165926869",
      "connected_at": "2025-07-23T12:15:00Z",
      "last_active_at": "2025-07-23T12:15:45Z"
    }
  ],
  "total": 2
}
```

**Response (401):**
```json
{
  "success": false,
  "error": "Invalid or missing API key"
}
```

---

### 2. Unlink Bot Account
**DELETE** `/unlink?platform=telegram`  
or  
**POST** `/unlink`

Disconnects a bot platform from the user account. You must disconnect before connecting a different account on the same platform.

**DELETE Method (Query Parameter):**
```bash
curl -X DELETE \
  "https://api.mozosubz.xyz/api/v1/bot-auth/unlink?platform=telegram" \
  -H "X-Connect-Key: your_connect_key"
```

**POST Method (JSON Body):**
```bash
curl -X POST \
  "https://api.mozosubz.xyz/api/v1/bot-auth/unlink" \
  -H "X-Connect-Key: your_connect_key" \
  -H "Content-Type: application/json" \
  -d '{"platform": "telegram"}'
```

**Parameters:**
- `platform` (string, required): `telegram` or `whatsapp`

**Response (200):**
```json
{
  "success": true,
  "message": "telegram account unlinked successfully"
}
```

**Response (400):**
```json
{
  "success": false,
  "error": "Platform must be whatsapp or telegram"
}
```

**Response (401):**
```json
{
  "success": false,
  "error": "Invalid or missing API key"
}
```

---

### 3. Request OTP
**POST** `/request-otp`

Initiates OTP verification for bot connection.

**Request:**
```bash
curl -X POST \
  "https://api.mozosubz.xyz/api/v1/bot-auth/request-otp" \
  -H "X-Connect-Key: your_connect_key" \
  -H "Content-Type: application/json" \
  -d '{"platform": "telegram"}'
```

**Body:**
```json
{
  "platform": "telegram"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP requested successfully",
  "session_id": "sess_xxxxx"
}
```

---

### 4. Verify OTP
**POST** `/verify-otp`

Verifies the OTP and completes bot connection.

**Request:**
```bash
curl -X POST \
  "https://api.mozosubz.xyz/api/v1/bot-auth/verify-otp" \
  -H "X-Connect-Key: your_connect_key" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "sess_xxxxx", "otp": "123456"}'
```

**Body:**
```json
{
  "session_id": "sess_xxxxx",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Bot connected successfully",
  "connection": {
    "platform": "telegram",
    "identifier": "7013439166",
    "connected_at": "2025-07-23T12:26:00Z"
  }
}
```

---

### 5. Validate Key
**POST** `/validate-key`

Validates if a connect key is valid and active.

**Request:**
```bash
curl -X POST \
  "https://api.mozosubz.xyz/api/v1/bot-auth/validate-key" \
  -H "X-Connect-Key: your_connect_key"
```

**Response (200):**
```json
{
  "success": true,
  "message": "API key is valid",
  "user": {
    "id": "user_xxxxx",
    "email": "user@example.com"
  }
}
```

**Response (401):**
```json
{
  "success": false,
  "error": "Invalid or missing API key"
}
```

---

### 6. Disconnect Platform (Legacy)
**POST** `/disconnect`

Alternative endpoint to unlink a bot (same as POST /unlink).

**Request:**
```bash
curl -X POST \
  "https://api.mozosubz.xyz/api/v1/bot-auth/disconnect" \
  -H "X-Connect-Key: your_connect_key" \
  -H "Content-Type: application/json" \
  -d '{"platform": "telegram"}'
```

**Body:**
```json
{
  "platform": "telegram"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "telegram disconnected successfully"
}
```

---

## Error Handling

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Common HTTP Status Codes:
- `200` - Success
- `400` - Bad request (invalid platform, missing parameters)
- `401` - Unauthorized (invalid or missing API key)
- `500` - Server error

---

## Constraints

- **One platform per user**: Only ONE Telegram and ONE WhatsApp account can be connected per user at a time
- **Unique platform**: If you try to connect a second account on the same platform, you must unlink the existing one first
- **Key required**: All endpoints require valid `X-Connect-Key` header authentication
