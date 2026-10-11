-- Bounty remediation migrations (2026-10-11)
-- Apply with the service role / postgres superuser, e.g. via the Supabase SQL editor.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fix the signup 500: the profile-creation trigger defaults phone_number
--    to '' (empty string). Because phone_number carries a UNIQUE constraint,
--    the second user without a phone in their signup metadata collided and
--    signup failed with 23505. This ADDITIVE trigger normalizes '' to NULL
--    on insert (NULL is exempt from UNIQUE collisions) without touching the
--    existing handle_new_user() function.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_profile_phone_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.phone_number = '' THEN
    NEW.phone_number := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_phone_number ON public.profiles;
CREATE TRIGGER trg_normalize_phone_number
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_profile_phone_number();

-- Normalize any existing '' phone rows so the unique index stops blocking:
UPDATE public.profiles SET phone_number = NULL WHERE phone_number = '';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. created_at protection: ALREADY COVERED — the existing trg_force_created_at
--    trigger forces created_at := now() on every UPDATE, so client-supplied
--    values are silently discarded (verified against production 2026-10-11).
--    No change needed; a client write returns 200 but the value never sticks.
-- ─────────────────────────────────────────────────────────────────────────────
