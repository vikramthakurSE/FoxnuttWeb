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
