# V1 API Response Cleanup & Balance Fix

## Changes Summary

### 1. Balance Endpoint Fixed
**Before:** Called `/api/gsubz/balance` (provider balance, wrong)
**After:** Calls `getUserWalletBalance(userId)` (user's internal wallet)

- Now returns the user's actual wallet balance from the database
- Uses user context from Connect Key authentication
- Returns clean response: `{ success: true, balance: 50000 }`

### 2. Data Plans Response Cleaned
**Before:**
```json
{
  "success": true,
  "data": {
    "service": "mtn_sme",
    "PlanName": "MTN SME Data Plans",
    "fixedPrice": true,
    "plans": [
      {
        "displayName": "500MB",
        "value": "500",
        "price": "155"
      }
    ]
  }
}
```

**After:**
```json
{
  "success": true,
  "plans": [
    {
      "name": "500MB",
      "price": 155
    }
  ]
}
```

### 3. Cable Plans Response Cleaned
- Same pattern as data plans
- Only shows: `name` and `price` fields
- No unnecessary metadata

### 4. Response Helper Functions
Created `/lib/middleware/v1-response-helpers.ts`:
- `cleanDataPlans(plans)` - Formats data plans
- `cleanCablePlans(plans)` - Formats cable plans
- `getUserWalletBalance(userId)` - Fetches user wallet from database

### 5. All Endpoints Updated
All 10 V1 endpoints now use consistent patterns:
- ✅ `/data/plans` - Returns clean plans array
- ✅ `/data/purchase` - Uses auth helper
- ✅ `/cable/plans` - Returns clean plans array
- ✅ `/cable/subscribe` - Uses auth helper
- ✅ `/electricity/purchase` - Uses auth helper
- ✅ `/airtime/purchase` - Uses auth helper
- ✅ `/balance` - Gets internal wallet balance
- ✅ `/verify` - Uses auth helper
- ✅ `/pins/generate` - Uses auth helper
- ✅ `/deposit/start` - Uses auth helper

### 6. User Context Tracking
All endpoints now:
- Log the authenticated user ID
- Pass `X-User-ID` and `X-Key-ID` headers to internal APIs
- Track which user initiated each request

## Response Examples

### Get Data Plans
```bash
curl -X POST https://mozosubz.xyz/api/mozosubz/v1/data/plans \
  -H "X-Connect-Key: connect_..." \
  -H "Content-Type: application/json" \
  -d '{"serviceID": "mtn_sme"}'

# Response:
{
  "success": true,
  "plans": [
    { "name": "500MB", "price": 155 },
    { "name": "1GB", "price": 310 },
    { "name": "2GB", "price": 620 }
  ]
}
```

### Get Balance
```bash
curl -X GET https://mozosubz.xyz/api/mozosubz/v1/balance \
  -H "X-Connect-Key: connect_..."

# Response:
{
  "success": true,
  "balance": 50000
}
```

### Get Cable Plans
```bash
curl -X POST https://mozosubz.xyz/api/mozosubz/v1/cable/plans \
  -H "X-Connect-Key: connect_..." \
  -H "Content-Type: application/json" \
  -d '{"serviceID": "dstv"}'

# Response:
{
  "success": true,
  "plans": [
    { "name": "Basic - 1 Month", "price": 2500 },
    { "name": "Standard - 1 Month", "price": 5500 }
  ]
}
```

## Benefits

1. **Cleaner Responses** - Users only see what they need (name + price)
2. **Correct Data** - Balance now shows user's actual wallet, not provider balance
3. **Better Logging** - All endpoints track user ID for debugging
4. **Consistent Pattern** - All endpoints follow same authentication and response pattern
5. **Production Ready** - No sensitive data in responses, proper error handling
