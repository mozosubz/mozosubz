-- Bachs switch (2026-10-13): provider-tracking columns on monnify_transactions.
-- Adds the columns the Bachs overlay/webhook flow needs. Idempotent — safe to
-- re-run. Existing rows are backfilled as provider='monnify' via the column
-- default; new rows must set provider explicitly when created by Bachs code.
-- APPLIED to production 2026-10-13.

ALTER TABLE public.monnify_transactions
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'monnify',
  ADD COLUMN IF NOT EXISTS bachs_checkout_id text,
  ADD COLUMN IF NOT EXISTS bachs_charge_id text,
  ADD COLUMN IF NOT EXISTS bachs_checkout_url text,
  ADD COLUMN IF NOT EXISTS provider_status text;
CREATE UNIQUE INDEX IF NOT EXISTS monnify_transactions_bachs_checkout_id_key
  ON public.monnify_transactions (bachs_checkout_id) WHERE bachs_checkout_id IS NOT NULL;
COMMENT ON COLUMN public.monnify_transactions.bachs_checkout_id IS 'Bachs checkout session id (chk_...) set when a deposit is initiated via the Bachs overlay.';
