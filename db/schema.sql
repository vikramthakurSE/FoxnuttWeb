-- Nutty Nirvana web store schema
-- Run once in the Supabase SQL editor (or psql) against your project DB.

create extension if not exists pgcrypto;

create table if not exists customers (
  id            uuid primary key default gen_random_uuid(),
  phone         text unique not null,          -- normalized 10 digits
  name          text,
  business_name text,
  address       text,
  gstin         text,
  sf_account_id text,
  created_at    timestamptz not null default now(),
  last_order_at timestamptz
);

create table if not exists otp_codes (
  id         bigserial primary key,
  phone      text not null,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   int not null default 0,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists otp_codes_phone_idx on otp_codes (phone, created_at desc);

create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references customers(id),
  phone         text not null,
  payload       jsonb not null,               -- items + contact details snapshot
  total         numeric(12,2),
  status        text not null default 'received',  -- received | synced | sync_failed
  sf_sale_id    text,
  sf_sale_name  text,
  sf_status     text,                          -- Pending Approval | Confirmed | ...
  sync_attempts int not null default 0,
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists orders_phone_idx on orders (phone, created_at desc);
create index if not exists orders_status_idx on orders (status);

-- ── WhatsApp reverse-verification ──────────────────────────────────────
-- The customer sends a pre-filled code TO our business number. Meta's
-- webhook delivers it along with the sender's real number, which is what
-- makes this proof of ownership: the phone is never taken from user input.
-- Uses only inbound messaging, so it needs no approved template and no
-- Meta business verification.
create table if not exists wa_verifications (
  token       text primary key,              -- opaque handle held by the browser
  code        text not null,                 -- what the customer sends us
  phone       text,                          -- filled in from the webhook sender
  wa_name     text,                          -- WhatsApp profile name, for prefill
  verified    boolean not null default false,
  consumed    boolean not null default false,-- session issued; cannot be reused
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists wa_verifications_code_idx
  on wa_verifications (code) where verified = false;
create index if not exists wa_verifications_created_idx
  on wa_verifications (created_at desc);
