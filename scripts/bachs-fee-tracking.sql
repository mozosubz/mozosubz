-- Bachs fee tracking (2026-11-13)
--
-- Bachs charges different processing fees per payment corridor (local NGN card
-- 2%, US cards 5% + $0.40, international cards base + 1.5%, crypto 1.5%, bank
-- transfer 1.5%), and a customer can pay an NGN-priced checkout with ANY of
-- them. Our own deposit fee (deposit_rules: ₦50 + 1.61%) is naira-only and
-- knew nothing about which corridor the customer actually used, so revenue
-- reporting could not see what Bachs took out of a deposit.
--
-- These columns store what Bachs itself reported for each charge (from the
-- payment object: fees.amount / fees.currency / fee_usd / payment_method /
-- amount_paid), so admin revenue = processing_fee - bachs_fee is real.

ALTER TABLE public.monnify_transactions
  ADD COLUMN IF NOT EXISTS bachs_fee numeric,
  ADD COLUMN IF NOT EXISTS bachs_fee_currency text,
  ADD COLUMN IF NOT EXISTS bachs_fee_usd numeric,
  ADD COLUMN IF NOT EXISTS bachs_payment_method text;

COMMENT ON COLUMN public.monnify_transactions.bachs_fee IS
  'Processing fee Bachs reported for this charge (fees.amount), in fees.currency.';
COMMENT ON COLUMN public.monnify_transactions.bachs_payment_method IS
  'Bachs payment corridor used by the customer (CARD, NGN_BANK_TRANSFER, USD_CARD, CRYPTO, MOMO_*, ...).';
