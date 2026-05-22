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

-- Cover the foreign key. Joins through inventory.store_id (P3's catalogue
-- list, P2's lock-route's per-wishlist store lookup) would otherwise do
-- a sequential scan.
create index if not exists inventory_store_id_idx on inventory (store_id);

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

-- Cover the family_id foreign key. "List my wishlists" is the family's
-- primary query and the read_all_wishlist policy uses it directly.
create index if not exists wishlist_family_id_idx on wishlist (family_id);

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

-- Cover the wishlist_id foreign key. P3's "show this wishlist's items"
-- query and the lock route's per-wishlist item load both filter on it.
create index if not exists wishlist_item_wishlist_id_idx
  on wishlist_item (wishlist_id);
-- Cover the inventory_id foreign key. The lock route resolves store_id
-- by joining items.inventory_id -> inventory.id.
create index if not exists wishlist_item_inventory_id_idx
  on wishlist_item (inventory_id);

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

-- Cover the wishlist_id foreign key. The audit trail page joins
-- settlement.wishlist_id -> wishlist for the per-order timeline view.
create index if not exists settlement_wishlist_id_idx on settlement (wishlist_id);

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

-- The only callers are the try_idempotency_lock / release_idempotency_lock
-- SECURITY DEFINER RPCs (which bypass RLS as the function owner). No
-- caller should reach this table via PostgREST directly. We enable RLS
-- with a single deny-all policy so the Supabase advisor's
-- `rls_enabled_no_policy` lint goes away AND the intent is explicit.
alter table request_lock enable row level security;
drop policy if exists request_lock_no_direct_access on request_lock;
create policy request_lock_no_direct_access on request_lock
  for all
  using      (false)
  with check (false);

-- ============================================================
-- Realtime is configured in db/realtime.sql (Day 2 task) — kept in a
-- separate file so it's easy to audit and re-run. Run it after this.
-- ============================================================
