-- Bounty remediation (2026-10-11): block disposable email domains at signup.
-- The register form has a client-side isDisposableEmail() check, but the raw
-- Supabase signup API bypassed it (users could be created with @1secmail.com
-- etc.). This auth.users trigger is the server-side backstop. APPLIED to
-- production 2026-10-11; verified: disposable signup now fails with a
-- database error and no user is created.

CREATE OR REPLACE FUNCTION public.block_disposable_email_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  domain text := lower(split_part(NEW.email, '@', 2));
  blocked text[] := ARRAY[
    '1secmail.com','1secmail.org','1secmail.net','yopmail.com','mailinator.com',
    'guerrillamail.com','guerrillamail.net','10minutemail.com','tempmail.com',
    'tempmail.org','throwawaymail.com','trashmail.com','getnada.com','temp-mail.org',
    'maildrop.cc','sharklasers.com','grr.la','discard.email','fakeinbox.com'
  ];
BEGIN
  IF domain = ANY(blocked) THEN
    RAISE EXCEPTION 'Disposable email addresses are not allowed'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_disposable_signup ON auth.users;
CREATE TRIGGER trg_block_disposable_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.block_disposable_email_signup();
