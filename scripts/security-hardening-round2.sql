-- Security hardening, round 2 (2026-10-24)
--
-- 1. restrict_user_transaction_edits referenced a column that does not exist
--    (`monnify_transaction_reference`), so EVERY user-side UPDATE of a deposit
--    row died with 42703 — including the cancel-deposit flow.
-- 2. profiles.is_banned / banned_at / ban_reason were writable by the row's
--    owner, so a banned user could unban themselves straight through PostgREST
--    (the access token stays valid after sign-out). Ban state is now protected;
--    the admin ban/unban actions use the service-role client and bypass this.
-- 3. bot_otp gets an attempt counter so a 6-digit code cannot be guessed for
--    its whole five-minute life.

-- ── 1. Corrected transaction edit guard ──────────────────────────────────────
-- Column immutability is already enforced by protect_monnify_transaction_columns
-- (which also validates the status transition), so this trigger only has to
-- stay out of the way of the cancel flow. The previous body referenced
-- `monnify_transaction_reference`, `destination_account_number` and
-- `api_response`, none of which exist on the table.
CREATE OR REPLACE FUNCTION public.restrict_user_transaction_edits()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  -- Server-side writers (service_role, postgres) bypass this check.
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not (old.status = 'PENDING' and new.status = 'CANCELLED') then
      raise exception 'Not allowed to set deposit status' using errcode = '42501';
    end if;
  end if;
  return new;
end $function$;

-- ── 2. Ban state is admin-owned ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.wallet_balance := 0;
      new.is_admin := false;
      new.admin_role := null;
      new.is_banned := false;
      new.banned_at := null;
      new.ban_reason := null;
      new.monnify_account_number := null;
      new.monnify_account_name := null;
      new.monnify_bank_name := null;
      new.monnify_account_reference := null;
      new.dva_created_at := null;
    elsif new.id is distinct from old.id
      or new.wallet_balance is distinct from old.wallet_balance
      or new.is_admin is distinct from old.is_admin
      or new.admin_role is distinct from old.admin_role
      or new.is_banned is distinct from old.is_banned
      or new.banned_at is distinct from old.banned_at
      or new.ban_reason is distinct from old.ban_reason
      or new.bvn is distinct from old.bvn
      or new.monnify_account_number is distinct from old.monnify_account_number
      or new.monnify_account_name is distinct from old.monnify_account_name
      or new.monnify_bank_name is distinct from old.monnify_bank_name
      or new.monnify_account_reference is distinct from old.monnify_account_reference
      or new.dva_created_at is distinct from old.dva_created_at then
      raise exception 'Not allowed to modify protected profile fields' using errcode = '42501';
    end if;
  end if;
  return new;
end $function$;

-- ── 3. OTP attempt counter ───────────────────────────────────────────────────
ALTER TABLE public.bot_otp ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

-- ── Sanity: verify the trigger bodies compile and the column exists ──────────
DO $$
DECLARE
  t text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO t
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'restrict_user_transaction_edits';
  IF t NOT LIKE '%old.status = ''PENDING''%' THEN
    RAISE EXCEPTION 'restrict_user_transaction_edits not updated';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO t
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'protect_profile_sensitive_columns';
  IF t NOT LIKE '%new.is_banned%' THEN
    RAISE EXCEPTION 'protect_profile_sensitive_columns not updated';
  END IF;
END $$;
