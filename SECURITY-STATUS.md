# Mozosubz Security Status — Bug Bounty Remediation Tracker

Status of every finding from the 14-round bug bounty report (2026-10-05), plus
post-report hardening. Verified via same-value oracles, live probes, and
type-checks as noted.

## Critical

| Finding | Status | Fix |
|---|---|---|
| CRITICAL-0 — any registered user can set own `wallet_balance`, `monnify_account_*` | **FIXED** | `protect_profile_sensitive_columns` trigger returns 42501; verified live |
| CRITICAL-0 addendum — `bvn` (KYC) still client-writable at re-test | **FIXED** | `bvn` added to the protected-columns trigger |
| CRITICAL-1 — anon full read/INSERT/UPDATE on `connect_keys` (27 rows exposed) | **FIXED** | RLS was disabled (all owner policies inert). Enabled; anon sees 0 rows, cross-user UPDATE applies 0 rows — verified with the report's same-value oracle |
| CRITICAL-1 escalated (Round 14) — authenticated cross-user UPDATE on `connect_keys` | **FIXED** | Same RLS enablement; authenticated probe applies 0 rows |
| CRITICAL-2 — anon destructive writes on `transactions`/`profiles` | RETRACTED by tester (Round 8) | n/a |

## High

| Finding | Status | Fix |
|---|---|---|
| HIGH-1 — anon INSERT on `audit_logs` (audit forgery) | **FIXED** | Permissive INSERT policies dropped on `audit_logs`, `failed_auth_logs`, `api_logs`, `suspicious_activity_logs`; anon INSERT now 401. Server writes use service_role (bypasses RLS) |
| HIGH-2 — schema/data exposure via PostgREST | **FIXED (data)** / accepted (schema) | All sensitive tables now RLS-on with scoped policies. OpenAPI schema enumeration remains possible with a valid key — cosmetic only |
| HIGH-3 — `pricing_rules` anon read (60 rows incl. cost/markup) | **FIXED** | Read now requires auth + `is_active`; INSERT/UPDATE/DELETE restricted to real `profiles.is_admin` (old policies only checked `role = authenticated`) |
| HIGH-4 — any authenticated user can UPDATE the live `deposit_rules` fee | **FIXED** | Policies were `qual: true`; now admin-only via `profiles.is_admin` |
| Monnify webhook accepts unsigned events (200 on empty body) | **FIXED** | Present-but-invalid signature = rejected. Absent signature (sandbox case) = never trusted; out-of-band verification against Monnify's transaction-status API, credit only on confirmed PAID |
| Session RPCs callable cross-user (`end_all_user_sessions`, `invalidate_other_sessions`, `create_device_session`) — post-report audit find | **FIXED** | EXECUTE revoked from anon/authenticated/public; service_role only. No app code calls them |

## Medium

| Finding | Status | Fix |
|---|---|---|
| User enumeration via `/api/auth/check-*` (no rate limit) | **FIXED** | 5/min/IP via Upstash; live-verified 5×200 then 429 |
| Login/OTP brute force (30 bad logins, no lockout) | **FIXED (login)** | Server-action throttle: 10 attempts / 5 min / IP+email before auth attempt. OTP throttling exists upstream (Round 10) |
| `monnify_transactions` self-editing by owner (Round 14) | **FIXED** | Trigger: user sessions may only set `status → CANCELLED` from pending + `updated_at`; any other column change → 42501. Cancel flow unaffected; server writes bypass |
| DMARC missing (domain spoofable) | **EXTERNAL** | DNS-side; publish `p=reject` at the domain registrar/DNS. Not fixable from code |
| Signup SMTP quota (500s after first send/hour) | **EXTERNAL** | Resend account limits — check the Resend dashboard/plan |
| Monnify 403 Cloudflare block on Vercel egress IPs | **EXTERNAL / OPEN** | Confirmed IP-reputation block (same request succeeds from non-Vercel IPs). UA + retry shipped; needs Monnify support to whitelist Vercel ranges, or different egress |

## Low / Info

| Finding | Status | Fix |
|---|---|---|
| `/api/email/welcome` callable unauthenticated | **MITIGATED** | Kept (needed post-signup) but throttled ~3/hr as observed |
| No per-user cap on connect-key creation (13 keys minted) | **FIXED** | 20-key lifetime cap per user, 429 beyond |
| Revoke returns `success: true` on zero rows | **FIXED** | 404 with "No active keys to revoke" |
| Airtime amount has no upper bound (₦1,000,001 passed) | **FIXED** | Capped at ₦100,000 per transaction |
| Service catalog leaked in `/api/v1/data/plans` error text | **FIXED** | Generic "Invalid service" |
| No CSP/Referrer-Policy/Permissions-Policy headers | **FIXED** | Added in `next.config.mjs`; CSP ships report-only first |
| Stale preconnect to unused second Supabase project | **FIXED** | Removed from `app/layout.tsx` |
| `robots.txt` advertises `/admin` and `/integrations` | **FIXED** | Removed from `app/robots.ts` |
| Provider name (`gsubz`) exposed in route paths/responses | **FIXED** | Routes renamed to `/api/provider/*`; provider payload scrubbed from client responses |
| Client-supplied `amount` in purchase requests | **SAFE** (tester-confirmed Round 11) | Server re-derives price; init-transaction response amount/reference now also verified against request per Monnify docs |
| Minimum password length below 8 | **EXTERNAL** | Supabase Auth dashboard → Policies |
| Realtime change-feed to anon | CLEAN | RLS enforced (tester positive finding) |
| Source maps, CORS reflection, storage, `_next/image` | CLEAN | n/a |

## Verification log

- Same-value oracle (simulated authenticated user): `connect_keys` cross-user UPDATE → 0 rows; `bot_connections` → 0 rows; `pricing_rules`/`deposit_rules` → 0 rows; anon `connect_keys` SELECT → 0 rows.
- Anon REST replay with project anon key: `connect_keys`/`bot_connections`/`pricing_rules` → `[]`; `audit_logs`/`connect_keys` INSERT → 401.
- Rate limit live probe: 5×200 then 429 on `check-email`.
- Type-check: clean except one pre-existing unrelated error in `app/dashboard/recharge-pins/page.tsx`.

## Remaining external actions

1. Publish DMARC (`p=reject`) + SPF `-all` at DNS provider.
2. Raise Supabase minimum password length to 8 (Auth settings).
3. Resolve Monnify 403 (support whitelist or different egress) — deposits blocked until then.
4. Review CSP report-only violations, then switch to enforcing.
5. Check Resend plan/limits for the signup SMTP 500s.
