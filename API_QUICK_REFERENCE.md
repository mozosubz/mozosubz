# Connect Key API - Quick Reference

## Authentication

Every request needs this header:
```
X-Connect-Key: your_key_here
```

## Base URL

```
https://mozosubz.xyz/api/integrations/services
```

## Key Operations

### Generate Key
```bash
POST /dashboard/profile → API Keys → Generate
```

### List Keys
```bash
GET /api/integrations/keys/list
```

### Revoke Key
```bash
POST /api/integrations/keys/revoke
Body: {"keyId": "uuid"}
```

---

## Service Endpoints

### DATA PLANS
```bash
POST /api/integrations/services/data/plans
Body: {"network": "MTN|GLO|AIRTEL|9MOBILE"}
```

### BUY DATA
```bash
POST /api/integrations/services/data/purchase
Body: {
  "network": "MTN",
  "plan_id": "mtn_sme_500",
  "recipient_phone": "09056458312"
}
```

### BUY AIRTIME
```bash
POST /api/integrations/services/airtime/purchase
Body: {
  "network": "MTN",
  "plan_id": "mtn_airtime_500",
  "recipient_phone": "09056458312"
}
```

### CABLE PLANS
```bash
POST /api/integrations/services/cable/plans
Body: {"provider": "DSTV|GOTV|STARTIMES"}
```

### CABLE SUBSCRIBE
```bash
POST /api/integrations/services/cable/subscribe
Body: {
  "plan_id": "dstv_01",
  "smartcard_number": "1234567890"
}
```

### ELECTRICITY PLANS
```bash
POST /api/integrations/services/electricity/plans
```

### BUY ELECTRICITY
```bash
POST /api/integrations/services/electricity/purchase
Body: {
  "disco_id": "abuja",
  "meter_number": "12345678",
  "amount": 5000
}
```

### CHECK BALANCE
```bash
GET /api/integrations/services/balance
```

### GET TRANSACTIONS
```bash
GET /api/integrations/services/transactions
```

### INITIATE DEPOSIT
```bash
POST /api/integrations/services/deposit/initiate
Body: {
  "amount": 10000,
  "description": "Integration deposit"
}
```

---

## Response Format

### Success
```json
{
  "success": true,
  "data": {...}
}
```

### Error
```json
{
  "success": false,
  "error": "Error description"
}
```

### Balance Example
```json
{
  "success": true,
  "balance": 50000,
  "currency": "NGN",
  "formattedBalance": "₦50,000.00"
}
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 429 | Rate limit |
| 500 | Server error |

---

## Rate Limits

- **10,000 requests/day** per key
- Resets at 00:00 UTC
- Returns 429 if exceeded

---

## JavaScript Example

```javascript
const key = process.env.MOZOSUBZ_KEY;

async function getBalance() {
  const res = await fetch(
    'https://mozosubz.xyz/api/integrations/services/balance',
    {
      headers: { 'X-Connect-Key': key }
    }
  );
  return res.json();
}

async function buyData(network, planId, phone) {
  const res = await fetch(
    'https://mozosubz.xyz/api/integrations/services/data/purchase',
    {
      method: 'POST',
      headers: {
        'X-Connect-Key': key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        network,
        plan_id: planId,
        recipient_phone: phone
      })
    }
  );
  return res.json();
}
```

---

## Python Example

```python
import requests

key = os.getenv('MOZOSUBZ_KEY')
headers = {'X-Connect-Key': key}

# Get balance
r = requests.get(
  'https://mozosubz.xyz/api/integrations/services/balance',
  headers=headers
)
print(r.json())

# Buy data
r = requests.post(
  'https://mozosubz.xyz/api/integrations/services/data/purchase',
  headers={**headers, 'Content-Type': 'application/json'},
  json={
    'network': 'MTN',
    'plan_id': 'mtn_sme_500',
    'recipient_phone': '09056458312'
  }
)
print(r.json())
```

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Unauthorized` | Invalid/missing key | Generate new key |
| `Insufficient permissions` | Wrong key type | Check key permissions |
| `Rate limit exceeded` | >10K/day | Wait 24h or reduce calls |
| `Invalid request` | Missing params | Check required fields |

---

## Security Tips

1. **Keep keys private** - Never share or commit to git
2. **Use env vars** - Store in `.env` or secrets manager
3. **Rotate keys** - Generate new ones periodically
4. **Monitor usage** - Check `/integrations/keys` dashboard
5. **Revoke old keys** - Remove unused keys

---

## Documentation

- Full API Docs: https://mozosubz.xyz/integrations/docs
- Key Management: https://mozosubz.xyz/integrations/keys
- Integration Guide: See `INTEGRATION_API_GUIDE.md`

---

## Support

- Email: support@mozosubz.xyz
- Dashboard: https://mozosubz.xyz/dashboard
- Status: https://status.mozosubz.xyz
