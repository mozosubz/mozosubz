-- Corridor fee pass-through (2026-11-14)
--
-- Deposit rule (₦50 + 1.61%) only covers Bachs' bank-transfer fee (1.5%).
-- Card/crypto/momo corridors cost Bachs up to ~6.6%, and the customer picks
-- the corridor inside the checkout — so the platform ate the difference.
-- Policy (owner decision): the platform keeps charging the same deposit fee;
-- the part of Bachs' fee the deposit fee does NOT cover is deducted from the
-- user's wallet credit when the payment is confirmed. This column stores the
-- naira amount actually deducted from the user for that deposit.

ALTER TABLE public.monnify_transactions
  ADD COLUMN IF NOT EXISTS bachs_fee_charged_naira numeric;

COMMENT ON COLUMN public.monnify_transactions.bachs_fee_charged_naira IS
  'Naira deducted from the user''s wallet credit to pass through the part of Bachs'' corridor fee not covered by the deposit fee.';
