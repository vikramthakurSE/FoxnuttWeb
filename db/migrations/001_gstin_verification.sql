-- Adds GSTIN verification tracking to customers (Cashfree Verification Suite).
-- Run once in the Supabase SQL editor against the live database — schema.sql
-- already has these columns for anyone bootstrapping a fresh database instead.
--
-- Every customer that already exists at the moment this runs is grandfathered
-- (gstin_verified set to true) — only customers created after this migration
-- will be asked to verify a GSTIN at checkout.

alter table customers
  add column if not exists gstin_verified    boolean not null default false,
  add column if not exists gstin_status      text,
  add column if not exists gstin_legal_name  text,
  add column if not exists gstin_trade_name  text,
  add column if not exists gstin_address     jsonb,
  add column if not exists gstin_verified_at timestamptz;

update customers set gstin_verified = true where gstin_verified = false;
