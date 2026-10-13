-- Account bans: admins can suspend a user account from /admin/users.
--
-- A banned user:
--   - cannot sign in (signInAction refuses + signs out)
--   - is signed out and redirected when they hit /dashboard
--   - is rejected by the deposit/verify APIs and every /api/v1 connect-key route
--
-- Unban clears the reason/timestamp; the audit trail lives in admin_logs.

alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_at timestamptz,
  add column if not exists ban_reason text;

-- Partial index: only banned rows are ever filtered on.
create index if not exists idx_profiles_is_banned
  on public.profiles (id)
  where is_banned = true;
