-- db/schema.sql
-- InternStellar — database schema
-- Run order:  schema.sql  ->  policies.sql  ->  realtime.sql  ->  seed.sql
--
-- SCHEMA LOCKED (Day 2): walked through with P2 (API routes) and P3 (UI).
-- Changes after this require a team sync — they break everyone downstream.
--
-- CONVENTION: all money is stored in STROOPS as integers (bigint).
--             1 XLM = 10,000,000 stroops. Never store XLM as a float.
-- CONVENTION: snake_case columns, singular table names.

-- Needed by seed.sql for password hashing (harmless if already present).
create extension if not exists pgcrypto;

-- ============================================================
-- profiles — extends Supabase auth users with role info
-- ============================================================
create table if not exists profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  role               text not null check (role in ('ofw', 'family', 'store')),
  display_name       text not null,
  stellar_public_key text,                       -- nullable for now
  country            text,                       -- demo flavour (OFW location)
  -- For role=family: the OFW profile that funds this family. The escrow
  -- lock/release routes refuse OFW calls whose caller.id != family.sponsor_ofw_id.
  sponsor_ofw_id     uuid references profiles (id),
  created_at         timestamptz not null default now()
);

create index if not exists profiles_sponsor_ofw_idx on profiles (sponsor_ofw_id);

-- ============================================================
-- inventory — what a store has in stock
-- ============================================================
create table if not exists inventory (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references profiles (id),
  name          text not null,                   -- e.g. "Rice 5kg"
  category      text not null,                   -- e.g. "grocery", "medicine"
  price_stroops bigint not null check (price_stroops >= 0),
  stock         int    not null default 0 check (stock >= 0),
  unit          text,                            -- "5kg", "12 pcs", "30 tabs"
  image_url     text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- wishlist — a family's pending order
-- ============================================================
create table if not exists wishlist (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references profiles (id),
  status          text not null default 'draft'
                    check (status in ('draft', 'pending_approval', 'locked',
                                       'delivered', 'released', 'cancelled')),
  total_stroops   bigint not null default 0 check (total_stroops >= 0),
  notes           text,                          -- "Lola needs her maintenance meds"
  escrow_tx_hash  text,                          -- filled when escrow locks
  -- On-chain u32 escrow id returned by lock_escrow. Consumed by the release
  -- route. Do NOT derive from `notes` — that field is user-editable.
  escrow_id       bigint,
  release_tx_hash text,                          -- filled when funds release
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- wishlist_item — line items on a wishlist
-- ============================================================
create table if not exists wishlist_item (
  id                   uuid primary key default gen_random_uuid(),
  wishlist_id          uuid not null references wishlist (id) on delete cascade,
  inventory_id         uuid not null references inventory (id),
  quantity             int  not null check (quantity > 0),
  price_stroops_at_add bigint not null check (price_stroops_at_add >= 0)
);

-- ============================================================
-- settlement — audit trail of on-chain contract events
-- ============================================================
create table if not exists settlement (
  id             uuid primary key default gen_random_uuid(),
  wishlist_id    uuid not null references wishlist (id),
  event_type     text not null check (event_type in ('deposit', 'lock', 'release')),
  tx_hash        text not null,                  -- 64 hex chars
  amount_stroops bigint not null check (amount_stroops >= 0),
  created_at     timestamptz not null default now()
);

-- ============================================================
-- request_lock — cross-replica idempotency dedup
-- Used by lib/api/idempotency.ts to dedupe concurrent identical requests
-- across multiple Node replicas. RPC helpers (try_idempotency_lock /
-- release_idempotency_lock) live in db/functions.sql.
-- ============================================================
create table if not exists request_lock (
  key        text primary key,
  expires_at timestamptz not null
);

-- ============================================================
-- Realtime is configured in db/realtime.sql (Day 2 task) — kept in a
-- separate file so it's easy to audit and re-run. Run it after this.
-- ============================================================
