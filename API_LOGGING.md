# API Request Logging System

This document describes the comprehensive API request logging system implemented in Mozosubz.

## Overview

All API requests are automatically logged with detailed information about:
- Request method, path, URL, headers, query parameters, and body
- Response status code, duration, and errors
- Client IP address and user agent
- Request/response lifecycle

## Components

### 1. **lib/api-logger.ts**
Core logging utility with functions for:
- `logRequest()` - Extract request metadata (method, path, headers, query, IP, user-agent)
- `logRequestWithBody()` - Extract request metadata + parse JSON body
- `logResponse()` - Track response status, duration, size, and errors
- `formatLog()` - Format log as single-line summary: `[API] ✓ POST /path | Status: 200 | 123ms`
- `debugLog()` - Detailed multi-line logging with full request/response details

### 2. **lib/api-handler.ts**
Reusable wrapper for API handlers:
```typescript
export const POST = withApiLogging(yourHandlerFunction, 'Endpoint Name')
```

Automatically handles:
- Request logging
- Response logging
- Error handling and logging
- Request duration tracking

### 3. **proxy.ts**
Next.js proxy (middleware) that logs all API requests globally.

### 4. **app/api/v1/airtime/purchase/route.ts**
Example of comprehensive endpoint logging with:
- Request entry point logging
- Auth validation logging
- Field validation logging
- Wallet operation logging
- External API (Gsubz) call logging
- Success/failure logging
- Error logging

## Log Format

### Standard Single-Line Log
```
[API] ✓ POST /api/v1/data/purchase | Status: 200 | 145ms
[API] ✗ GET /api/v1/data/plans | Status: 401 | 23ms
```

### Endpoint-Specific Logs
```
[Airtime API] → POST /api/v1/airtime/purchase | From: 192.168.1.1
[Airtime API] → Processing: mtn | ₦1000 | Phone: 08012345678
[Airtime API] → Gsubz response | Code: 200 | Status: SUCCESS
[Airtime API] ✓ SUCCESS | TX: V1-AIR-ABC123 | User: user123 | ₦1000 | 234ms
[Airtime API] ✗ Insufficient balance | Required: ₦1000, Available: ₦500
```

## Usage

### Automatic Logging (Global)
All API requests are automatically logged via `proxy.ts`:
```
[API] → GET /api/v1/data/plans
[API] → POST /api/v1/data/purchase
```

### Detailed Endpoint Logging
Add comprehensive logging to specific endpoints:

```typescript
import { logRequestWithBody, logResponse, formatLog } from '@/lib/api-logger'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestLog = await logRequestWithBody(request)
  
  console.log(`[MyEndpoint] → POST /api/my-endpoint`)

  try {
    // Your endpoint logic...
    
    const duration = Date.now() - startTime
    console.log(`[MyEndpoint] ✓ SUCCESS | 200 | ${duration}ms`)
    
    return NextResponse.json({ success: true })
  } catch (err) {
    const duration = Date.now() - startTime
    console.error(`[MyEndpoint] ✗ ERROR: ${err} | ${duration}ms`)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
```

### Using the Handler Wrapper
For simple endpoints, use the wrapper:

```typescript
import { withApiLogging } from '@/lib/api-handler'

const handler = async (request: NextRequest) => {
  // Your logic here
  return NextResponse.json({ data: 'result' })
}

export const POST = withApiLogging(handler, 'MyEndpoint')
```

## Debug Mode

Enable detailed debugging logs by setting environment variable:
```
DEBUG_API_LOGS=true
```

This enables `debugLog()` which outputs full request/response details:
```
═══════════════════════════════════════════════════════════════
[API REQUEST LOG] - 2026-07-17T18:53:42.123Z
───────────────────────────────────────────────────────────────
METHOD: POST
PATH: /api/v1/airtime/purchase
URL: https://mozosubz.xyz/api/v1/airtime/purchase?...
IP: 192.168.1.1
USER-AGENT: Mozilla/5.0...
───────────────────────────────────────────────────────────────
QUERY PARAMS: {}
HEADERS: {
  "x-connect-key": "connect_...",
  "content-type": "application/json",
  ...
}
BODY: {
  "network": "mtn",
  "amount": 1000,
  "phone": "08012345678"
}
───────────────────────────────────────────────────────────────
RESPONSE STATUS: 200
RESPONSE TIME: 234ms
RESPONSE SIZE: 245 bytes
ERROR: None
═══════════════════════════════════════════════════════════════
```

## Log Levels

| Symbol | Meaning | Color |
|--------|---------|-------|
| `→` | Request incoming | Blue |
| `✓` | Successful response | Green |
| `✗` | Error/failure | Red |

## What Gets Logged

### Request Information
- **Timestamp** - ISO 8601 format
- **HTTP Method** - GET, POST, PUT, DELETE, etc.
- **Path** - URL pathname
- **URL** - Full URL with query params
- **IP Address** - Client IP (from headers)
- **User-Agent** - Browser/client info
- **Headers** - All HTTP headers
- **Query Params** - URL search parameters
- **Body** - JSON request body (if applicable)

### Response Information
- **Status Code** - HTTP status
- **Duration** - Request processing time in milliseconds
- **Size** - Response body size (if tracked)
- **Error** - Error message if failed

## Implementation Notes

1. **Non-Blocking**: Logging doesn't block request processing
2. **Safe JSON Parsing**: Failed JSON parsing is caught and logged
3. **PII Aware**: Be mindful of sensitive data in logs
4. **Performance**: Minimal overhead from logging
5. **IP Detection**: Checks `x-forwarded-for` and `x-real-ip` headers for proxy situations

## Examples

### Example 1: Data Plan Purchase
```
[Data API] → POST /api/v1/data/purchase
[Data API] → Validating plan_id: mtn_1gb_30d
[Data API] → User balance: ₦5000
[Data API] → Gsubz API call started
[Data API] → Gsubz response: Code 200, Status SUCCESS
[Data API] ✓ PURCHASE COMPLETE | TX: V1-DATA-ABC123 | ₦250 | 456ms
```

### Example 2: Cable Subscription
```
[Cable API] → POST /api/v1/cable/subscribe
[Cable API] ✗ Invalid service_id: invalid_service
[Cable API] ✗ Error occurred | 23ms
```

### Example 3: Rate Limit Exceeded
```
[API] → GET /api/v1/data/plans
[API] ✗ Rate limit exceeded | Status: 429 | 5ms
```

## Viewing Logs

Logs are output to `stdout` and can be viewed in:
- **Local Development**: Terminal/console
- **Production**: Cloud provider logs (Vercel, CloudFlare, etc.)
- **Docker**: Container logs

## Best Practices

1. **Always log authentication failures** - Know who's accessing your API
2. **Log wallet/balance operations** - Audit financial transactions
3. **Log external API calls** - Track third-party service health
4. **Use descriptive prefixes** - `[Airtime API]`, `[Data API]`, etc.
5. **Include transaction IDs** - Makes debugging easier
6. **Log errors with context** - Include relevant variables
7. **Track request duration** - Identify slow endpoints

## Future Enhancements

- [ ] Structured logging (JSON format)
- [ ] Log aggregation service integration
- [ ] Request/response sampling
- [ ] Sensitive data masking
- [ ] Performance metrics dashboard
- [ ] Alert on error thresholds
