-- Bachs switch (2026-10-13): widen the status CHECK on monnify_transactions.
-- The live constraint only allowed PENDING/SUCCESS/EXPIRED/CANCELLED, so the
-- Bachs webhook could not store FAILED (or the other mapped terminals) on the
-- status column. Find the constraint by definition (its name may differ between
-- environments), drop it, then recreate it with the full internal vocabulary.
-- Idempotent: re-running drops whatever status CHECK currently exists (including
-- the one created below) before re-adding it.

DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.monnify_transactions'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.monnify_transactions DROP CONSTRAINT %I', con.conname);
    RAISE NOTICE 'Dropped constraint %', con.conname;
  END LOOP;
END $$;

ALTER TABLE public.monnify_transactions
  ADD CONSTRAINT monnify_transactions_status_check
  CHECK (status IN ('PENDING','SUCCESS','EXPIRED','CANCELLED','FAILED','REVIEW','REFUNDED'));
