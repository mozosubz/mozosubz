# Mozosubz v1 API Integration Setup

## ✅ API Structure Complete
All endpoints are now under `/api/mozosubz/v1/`

### Endpoint Paths Fixed:
- ✅ Key Management: `/api/mozosubz/v1/keys/*`
- ✅ Services: `/api/mozosubz/v1/services/*` 
- ✅ Frontend calls updated to use correct paths
- ✅ Documentation updated with correct URLs

## 🚀 What's Working

### Build Status
- ✅ All code compiles successfully
- ✅ No build errors or warnings
- ✅ All 9 service endpoints created
- ✅ Key management endpoints ready

### API Endpoints Ready

**Key Management (requires authentication):**
- `POST /api/mozosubz/v1/keys/create` - Create new API key
- `GET /api/mozosubz/v1/keys/list` - List user's keys  
- `POST /api/mozosubz/v1/keys/revoke` - Revoke key

**Service Endpoints (require X-Connect-Key header):**
- `POST /api/mozosubz/v1/services/data/plans` - Get data plans
- `POST /api/mozosubz/v1/services/data/purchase` - Buy data
- `POST /api/mozosubz/v1/services/cable/plans` - Get cable plans
- `POST /api/mozosubz/v1/services/cable/subscribe` - Subscribe cable
- `POST /api/mozosubz/v1/services/electricity/plans` - Get providers
- `POST /api/mozosubz/v1/services/electricity/purchase` - Buy electricity
- `POST /api/mozosubz/v1/services/airtime/purchase` - Buy airtime
- `POST /api/mozosubz/v1/services/deposit/initiate` - Initiate deposit
- `GET /api/mozosubz/v1/services/balance` - Check balance

## ⚠️ What Needs Attention

### Database Setup Required
The `/api/mozosubz/v1/keys/` endpoints need the `connect_keys` table to exist in Supabase.

**You need to:**
1. Go to your Supabase project
2. Run the SQL migration from `/database/migrations/001_connect_keys.sql`
3. This creates:
   - `connect_keys` table
   - Indexes for performance
   - RLS policies for security

### Frontend Links Updated
- ✅ Profile page → "API Keys" menu item → `/integrations/keys`
- ✅ Footer → "Developers" section with links
- ✅ All API docs reference `/api/mozosubz/v1/`

## 🔄 Complete Flow

1. **User goes to Profile → API Keys**
2. **User clicks "Generate New Key"**
3. **Frontend calls:** `POST /api/mozosubz/v1/keys/create`
4. **Endpoint generates secure key** → Stored in database
5. **Key returned to user** (shown only once, user must save)
6. **Old keys auto-revoked** (only 1 active key per user)
7. **User integrates:** Uses key in `X-Connect-Key` header
8. **Service endpoints work** with the key for rate-limited access

## 📋 Quick Test

Once database is setup, test with:

```bash
# Create a key (requires being authenticated as user)
curl -X POST https://mozosubz.xyz/api/mozosubz/v1/keys/create \
  -H "Content-Type: application/json" \
  -d '{"name": "My Integration"}'

# Response includes the key (save it!)

# Use the key to call services
curl -X POST https://mozosubz.xyz/api/mozosubz/v1/services/data/plans \
  -H "X-Connect-Key: your_key_here" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 🔐 Security Features

- Secure key hashing with SHA-256
- Rate limiting: 10,000 requests/day per key
- Keys expire after 1 year
- Old keys revoked when new key created
- IP tracking and suspicious activity logging
- RLS enforced in database

## ✅ All Files Updated

- ✅ `/components/integrations/connect-keys-manager.tsx` - API calls updated
- ✅ `/app/integrations/docs/page.tsx` - All endpoint paths fixed
- ✅ `/app/integrations/keys/page.tsx` - Uses correct paths
- ✅ `/lib/middleware/verify-connect-key.ts` - Working middleware
- ✅ 9 service endpoints at `/api/mozosubz/v1/services/*`
- ✅ 3 key management endpoints at `/api/mozosubz/v1/keys/*`

## Next Steps

1. **Run SQL migration** in Supabase
2. **Restart app** if needed
3. **Test key creation** from profile page
4. **Generate API key** 
5. **Test service endpoints** with the key

Everything is ready - just need the database table!
