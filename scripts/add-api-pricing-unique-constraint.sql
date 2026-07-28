-- Prevents duplicate API pricing rules for the same plan on the same service.
-- The table previously had no constraint here, which allowed repeated bulk
-- creates to produce several conflicting prices for a single plan.
-- Run the dedupe cleanup before applying this.

ALTER TABLE api_pricing_rules
  ADD CONSTRAINT api_pricing_rules_service_plan_unique
  UNIQUE (service_id, plan_name);
