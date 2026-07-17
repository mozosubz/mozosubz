# Airtime API & Frontend Analysis

## System Architecture

### Frontend Layer
**File:** `/app/dashboard/airtime/page.tsx`
- Client-side component with network selection (MTN, Glo, Airtel, 9mobile)
- Form inputs: phone number (11-digit), amount (₦100 - ₦50,000)
- Contact picker integration for phone numbers
- Recent numbers saved locally in Supabase
- Wallet balance display with validation
- Endpoints: Calls `/api/gsubz/airtime/purchase` via form data

**Flow:**
1. User selects network
2. Enters phone number
3. Enters amount
4. Sees confirmation sheet
5. On confirm: POST to `/api/gsubz/airtime/purchase`
6. Displays success overlay or error

---

## API Layer Architecture

### 1. **Internal API (Dashboard/WebUI)**
**Endpoint:** `/api/gsubz/airtime/purchase` (POST)
**File:** `/app/api/gsubz/airtime/purchase/route.ts`

**Authentication:** Session cookie (logged-in users only)

**Function Stack:**
```
POST /api/gsubz/airtime/purchase
  ↓ (Rate limited: 5 per minute)
  ↓
purchaseAirtime() in /lib/actions/airtime.ts
  ├─ Validates inputs (amount, phone)
  ├─ Gets user session
  ├─ Maps network → serviceID:
  │  ├─ mtn → mtn
  │  ├─ airtel → airtel
  │  ├─ glo → glo
  │  └─ 9mobile → etisalat
  ├─ Calls buyAirtime() from Gsubz API
  ├─ Atomically deducts wallet
  ├─ Saves transaction log
  └─ Returns success/failure
```

**Input Validation:**
- Phone: 11 digits, starts with 0 (Nigerian format only)
- Amount: ₦100 - ₦50,000
- Balance check: Wallet must have sufficient balance
- Network: Must be one of [MTN, Glo, Airtel, 9mobile]

**Wallet Deduction Flow:**
1. Check balance before purchase
2. Call Gsubz API
3. If successful → atomic deduct from wallet
4. If failed → NO deduction (failure is safe)
5. Save transaction record
6. Return new balance

---

### 2. **Public/Connect API (External Developers)**
**Endpoint:** `/api/v1/airtime/purchase` (POST)
**File:** `/app/api/v1/airtime/purchase/route.ts`

**Authentication:** X-Connect-Key header (API key validation)

**Service ID Mapping:**
```javascript
const serviceIdMap: Record<string, string> = {
  mtn: 'mtn_airtime',
  glo: 'glo_airtime',
  airtel: 'airtel_airtime',
  etisalat: 'etisalat_airtime',
}
```

**Function Stack:**
```
POST /api/v1/airtime/purchase
  ├─ Verify Connect Key (X-Connect-Key header)
  ├─ Check permissions (airtime or all)
  ├─ Validate:
  │  ├─ network: [mtn, glo, airtel, etisalat] (lowercase)
  │  ├─ amount: ≥ ₦50
  │  └─ phone: Nigerian format
  ├─ Get user wallet balance
  ├─ Deduct wallet atomically
  ├─ Call Gsubz API with mapped serviceID
  ├─ If failed → refund wallet
  ├─ Save transaction
  └─ Return success/failure
```

**Key Differences from Internal API:**
- Minimum amount is ₦50 (vs ₦100 for dashboard)
- Uses different service ID mapping (mtn_airtime vs mtn)
- Requires X-Connect-Key authentication
- Direct API response

---

## Gsubz Integration

**File:** `/lib/api/gsubz.ts`

**Function:** `buyAirtime()`
```javascript
buyAirtime({
  serviceID: string,    // mtn_airtime, glo_airtime, airtel_airtime, etisalat_airtime
  phone: string,        // 08012345678
  amount: string,       // "1000"
  requestID: string,    // Unique transaction ID
})
```

**Success Conditions:**
- `code === 200` AND
- `status === "TRANSACTION_SUCCESSFUL"` OR `status === "success"` OR `status === "successful"` OR `description === "TRANSACTION_SUCCESSFUL"`

**Response Format:**
```javascript
{
  code: 200,
  status: "TRANSACTION_SUCCESSFUL",
  description: "Success message",
  transactionID: "gsubz-txn-123",
  content: { /* response data */ }
}
```

---

## Database Schema

### Transactions Table
Stores all airtime purchase attempts:
- `id`: UUID
- `user_id`: User who made the purchase
- `transaction_id`: Unique identifier (V1-AIR-xxx or TXN-xxx)
- `category`: "AIRTIME"
- `service_id`: "mtn-airtime", "glo-airtime", etc.
- `service_name`: "MTN Airtime", "Glo Airtime", etc.
- `amount`: Purchase amount
- `phone`: Phone number airtime was sent to
- `status`: "SUCCESS" or "FAILED"
- `description`: Transaction details
- `balance_before`: Wallet balance before purchase
- `balance_after`: Wallet balance after purchase
- `api_response`: Full Gsubz API response
- `created_at`: Timestamp

### Profiles Table
- `id`: User UUID
- `wallet_balance`: Current balance

---

## Atomic Wallet Deduction

**Function:** `atomicDeductWallet(userId, amount)`

Ensures:
1. Wallet balance cannot go negative
2. Deduction is atomic (no race conditions)
3. Returns new balance after deduction
4. Fails safely if balance insufficient

**Refund Function:** `atomicRefundWallet(userId, amount)`
- Used if Gsubz API fails
- Adds amount back to wallet atomically

---

## Potential Issues & "Service Not Found" Error

### Issue 1: Service ID Mismatch
**Problem:** v1 API uses different service IDs than gsubz API expects

**Internal API service IDs:**
- mtn → "mtn"
- glo → "glo"
- airtel → "airtel"
- 9mobile → "etisalat"

**v1 API service IDs:**
- mtn → "mtn_airtime"
- glo → "glo_airtime"
- airtel → "airtel_airtime"
- etisalat → "etisalat_airtime"

**Root Cause:** If Gsubz doesn't recognize "mtn_airtime", "glo_airtime", etc., it returns "service not found". The v1 API needs to use the same service IDs as the internal API.

### Issue 2: Network Validation Difference
- **Internal API:** accepts [mtn, airtel, glo, 9mobile]
- **v1 API:** accepts [mtn, glo, airtel, etisalat]

9mobile is mapped to etisalat in both, but the v1 API uses the backend name "etisalat" instead of the user-facing name "9mobile".

---

## Error Handling Patterns

### Frontend Error Messages
```
- "Invalid 11-digit phone number"
- "Minimum airtime amount is ₦100"
- "Maximum amount is ₦50,000"
- "Insufficient wallet balance"
- "Too many purchase requests. Maximum 5 per minute."
```

### API Error Messages
```
- "Missing required fields: network, amount, phone"
- "Invalid network. Must be one of: ..."
- "Amount must be at least ₦50/₦100"
- "Invalid Nigerian phone number"
- "Insufficient wallet balance"
- "Airtime provider error. Your wallet has been refunded."
- "Transaction failed. Wallet has been refunded."
```

---

## Transaction ID Formats

**Internal API:** `V1-AIR-{12 random hex chars}` (e.g., V1-AIR-A1B2C3D4E5F6)
**gsubz API:** `TXN{timestamp}{random 1-3 digit number}` (e.g., TXN1721234567890456)

---

## Complete Flow Diagram

```
FRONTEND (Dashboard User)
         ↓
    [Phone, Network, Amount]
         ↓
POST /api/gsubz/airtime/purchase
         ↓
Rate Limit Check (5/min)
         ↓
purchaseAirtime() server action
         ↓
1. Validate inputs
2. Get user session
3. Get wallet balance
4. Map network → serviceID (mtn → mtn)
5. Call Gsubz API
         ↓
    [Gsubz Response]
         ↓
6. Check if success (code 200 + status check)
7. If YES → atomically deduct wallet
8. If NO → save as FAILED transaction
         ↓
9. Save transaction log
         ↓
Return { success, transaction, balance }
         ↓
Display Success/Error Overlay
```

```
EXTERNAL API (v1 Developer)
         ↓
    [X-Connect-Key, network, amount, phone]
         ↓
POST /api/v1/airtime/purchase
         ↓
1. Verify X-Connect-Key
2. Check permissions (airtime or all)
3. Validate inputs
4. Get user wallet (by userId from key)
5. Map network → serviceID (mtn → mtn_airtime)
6. Call Gsubz API ← ⚠️ POTENTIAL ISSUE HERE
         ↓
    [Gsubz Response]
         ↓
7. If success → atomically deduct wallet
8. If failure → refund wallet
9. Save transaction log
         ↓
Return JSON response
```

---

## Recommendations

### Fix for "Service Not Found" Error

**If Gsubz expects:** mtn, glo, airtel, etisalat
**Then v1 API should use:**
```javascript
const serviceIdMap: Record<string, string> = {
  mtn: 'mtn',           // Remove "_airtime" suffix
  glo: 'glo',
  airtel: 'airtel',
  etisalat: 'etisalat',
}
```

**Or confirm with Gsubz what exact service IDs they accept and update both APIs consistently.**

---

## Summary

✅ **Working:** 
- Internal dashboard airtime purchases
- Phone number validation and formatting
- Atomic wallet deduction
- Transaction logging
- Error handling

⚠️ **Potential Issue:**
- v1 API may be using wrong service IDs for Gsubz ("mtn_airtime" vs "mtn")
- This would cause Gsubz to return "service not found" error

**Next Step:** Verify Gsubz API documentation for exact serviceID format and align both APIs to use the same values.
