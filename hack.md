# Incident Post-Mortem: 110 Data Plan Exploit (₦10 / ₦11 Attack)

## Summary
An attacker manipulated the client request body in `purchaseData` to buy a data bundle worth ₦1,000+ while only paying ₦10–₦11.

## Attack Vector Breakdown
1. **Frontend Request Manipulation**: In `app/dashboard/data/page.tsx`, the client submitted `serviceID`, `plan`, `phone`, and `amount`.
2. **Server Trusting Client Data**: `lib/actions/data.ts` trusted `formData.get("amount")` as the true transaction value instead of checking the provider's plan catalog price.
3. **Execution**:
   - Step 1: Attacker selected a real data plan (`serviceID="mtn_data"`, `plan="110"`).
   - Step 2: Attacker sent HTTP POST with `amount="10"`.
   - Step 3: Server checked `balance >= 10` (Passed).
   - Step 4: Server called GSUBZ API `buyData(...)` with real plan `110` (Provider fulfilled the bundle).
   - Step 5: Server deducted `10` from user's balance.

## Resolution
- `lib/actions/data.ts` now retrieves the real price from GSUBZ (`getDataPlans`) and applies database `pricing_rules` markup on the server.
- The `amount` parameter from client form data is discarded.
- All checkout, payment verify, admin actions, recharge pins, and bot auth endpoints across the codebase were audited and hardened.
