# VERIFIED API STRUCTURE & INFORMATION

## What I Verified From Code

### 1. Base URLs
- **Production**: `https://www.mozosubz.xyz`
- **Local Dev**: `http://localhost:3000`
- **Provider (GSUBZ)**: `https://gsubz.com`

### 2. API Endpoints Location
All under: `/api/mozosubz/v1/`

Actual endpoints deployed:
- `/api/mozosubz/v1/services/data/plans`
- `/api/mozosubz/v1/services/data/purchase`
- `/api/mozosubz/v1/services/cable/plans`
- `/api/mozosubz/v1/services/cable/subscribe`
- `/api/mozosubz/v1/services/electricity/plans`
- `/api/mozosubz/v1/services/electricity/purchase`
- `/api/mozosubz/v1/services/airtime/purchase`
- `/api/mozosubz/v1/services/deposit/initiate`
- `/api/mozosubz/v1/services/balance`
- `/api/mozosubz/v1/keys/create`
- `/api/mozosubz/v1/keys/list`
- `/api/mozosubz/v1/keys/revoke`

### 3. Service IDs (GSUBZ Provider)

**Data Services** (from `lib/actions/data.ts` and internal system):
```
serviceID values:
- mtn_sme
- mtn_datashare
- mtn_gifting
- mtn_awoof
- glo_data
- glo_sme
- airtel_sme
- etisalat_data
```

Each service maps to a GSUBZ plan endpoint: `GET https://gsubz.com/api/plans?service=mtn_sme`

**Cable Services**: Available providers from GSUBZ

**Electricity Services**: Available providers from GSUBZ

**Airtime Services**: All networks available

### 4. Authentication

All service requests use:
```
Header: X-Connect-Key: your_key_here
```

Key creation/management requires user login (session auth), not Connect Key.

### 5. How It Works (Data Purchase Example)

```
1. Client has Connect Key: connect_96434b4c...
2. Calls: POST /api/mozosubz/v1/services/data/purchase
   Headers: X-Connect-Key: connect_96434b4c...
   Body: {serviceID: "mtn_sme", phone: "08012345678", planID: "1000"}

3. API validates key in database (middleware)
4. API calls gsubz.com with:
   - serviceID: mtn_sme
   - plan: 1000
   - phone: 08012345678
   - api: GSUBZ_API_KEY

5. GSUBZ responds with transaction result
6. API logs transaction to database
7. API returns response to client
```

### 6. Rate Limiting

10,000 requests per day per Connect Key (verified in `lib/middleware/verify-connect-key.ts`)

### 7. Logging

All endpoints have `[MOZOSUBZ-V1-*]` console logs:
- `[MOZOSUBZ-API]` - Key verification
- `[MOZOSUBZ-V1-DATA-PLANS]` - Data plans
- `[MOZOSUBZ-V1-DATA-PURCHASE]` - Data purchase
- etc.

### 8. Deposit System (Separate from Connect Key)

- Location: `POST /api/deposit/start`
- Uses: Monnify payment gateway (not GSUBZ)
- Requires: User authentication (session), NOT Connect Key
- Flow: Create transaction → Init with Monnify → Generate temp account → Return payment details

## What Was Updated

1. **Documentation**: `/integrations/docs/page.tsx`
   - Fixed service IDs from "network" to "serviceID"
   - Updated examples to use actual service IDs

2. **Footer**: `components/footer.tsx`
   - Updated developer links to point to `/integrations/docs`

3. **Created reference docs**:
   - `API_DOCUMENTATION_VERIFIED.md` - Complete verified API docs
   - This file (`API_STRUCTURE_VERIFIED.md`)

## Important Notes

- GSUBZ is the SERVICE PROVIDER (we wrap their API)
- Each network has multiple service types (gifting, SME, datashare, etc.)
- Connect Keys are for third-party integrations
- Deposit API is separate (uses Monnify, not GSUBZ)
- All prices and plans come from GSUBZ, with optional markup added in our system
