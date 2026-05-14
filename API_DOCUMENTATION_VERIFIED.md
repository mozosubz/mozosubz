# Mozosubz v1 Integration API - VERIFIED

## Base URL

Production: `https://www.mozosubz.xyz`  
Local: `http://localhost:3000`

All endpoints are `/api/mozosubz/v1/*`

## Authentication

All endpoints require:
```
X-Connect-Key: your_connect_key_here
```

## Data Service IDs (from internal system)

- `mtn_sme` - MTN SME
- `mtn_datashare` - MTN DataShare
- `mtn_gifting` - MTN Gifting
- `mtn_awoof` - MTN Awoof
- `glo_data` - Glo Data
- `glo_sme` - Glo SME
- `airtel_sme` - Airtel SME
- `etisalat_data` - 9mobile Data

Each fetches plans from GSUBZ API.

## Endpoints

### GET /api/mozosubz/v1/services/data/plans
Get available plans for a data service.

```json
POST Body:
{
  "serviceID": "mtn_sme"
}

Response:
{
  "success": true,
  "plans": [
    {"displayName": "500MB", "value": "500", "price": "50"},
    {"displayName": "1GB", "value": "1000", "price": "100"}
  ]
}
```

### POST /api/mozosubz/v1/services/data/purchase
Purchase data for a phone number.

```json
{
  "serviceID": "mtn_sme",
  "phone": "08012345678",
  "planID": "1000"
}
```

### POST /api/mozosubz/v1/services/airtime/purchase
Buy airtime.

```json
{
  "serviceID": "mtn",
  "phone": "08012345678",
  "amount": "500"
}
```

### POST /api/mozosubz/v1/services/cable/plans
Get cable plans.

### POST /api/mozosubz/v1/services/cable/subscribe
Subscribe to cable.

### POST /api/mozosubz/v1/services/electricity/plans
Get electricity providers.

### POST /api/mozosubz/v1/services/electricity/purchase
Buy electricity token.

### POST /api/mozosubz/v1/services/airtime/purchase
Buy airtime.

### POST /api/mozosubz/v1/services/deposit/initiate
Start a deposit transaction (requires user auth, not Connect Key).

### GET /api/mozosubz/v1/services/balance
Get wallet balance for the Connect Key owner.

## Rate Limit

10,000 requests per day per Connect Key.

## How GSUBZ Works

The system calls `https://gsubz.com` API endpoints:
- `/api/plans?service=mtn_sme` - Get plans
- `/api/pay/` - Make purchase
- `/api/balance/` - Check balance
- `/api/verify/` - Verify transaction

The v1 API is a wrapper that requires Connect Key authentication before proxying to GSUBZ.
