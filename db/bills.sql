-- db/bills.sql
-- InternStellar — bills payment feature (Day 5+).
--
-- WHY THIS FILE EXISTS:
-- The OFW dashboard's "Bills" panel needs three new tables:
--   * biller        — Meralco, Maynilad, etc. + their on-chain payout addresses
--   * bill          — a household's outstanding bill (account #, amount, due)
--   * bill_payment  — append-only ledger of bill payments + tx hashes
--
-- Schema was previously LOCKED post-Day-2 (see CLAUDE.md). This addition
-- was approved on Day 5 — the feature is additive (no existing-table edits)
-- so it doesn't conflict with P2/P3's previous integration work.
--
-- WHO RUNS IT: P4 (Charles) in the Supabase SQL editor, AFTER schema.sql
-- and policies.sql. Idempotent — safe to re-run.
--
-- Run order:
--   schema → policies → realtime → grants → functions → bills → seed
--
-- A separate `npm run setup-billers` script generates real Stellar testnet
-- keypairs, Friendbots them, and INSERTs Meralco + Maynilad biller rows
-- plus demo bills for Cora. We don't hardcode biller addresses here
-- because testnet accounts need to exist (be Friendbot-funded) before
-- they can receive payment ops.

-- ============================================================
-- 1. Tables
-- ============================================================

create table if not exists biller (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,                  -- "Meralco", "Maynilad"
  category        text not null,                  -- 'electricity' | 'water' | 'internet' | 'telco'
  stellar_address text not null,                  -- Biller's testnet pubkey
  logo_url        text,                           -- optional
  created_at      timestamptz not null default now()
);

create table if not exists bill (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references profiles (id),
  biller_id       uuid not null references biller (id),
  account_number  text not null,                  -- "1234-5678" — the household's # on file
  amount_stroops  bigint not null check (amount_stroops > 0),
  due_date        date not null,
  status          text not null default 'due'
                   check (status in ('due', 'paid', 'overdue')),
  autopay_enabled boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Append-only ledger. One row per successful on-chain payment.
create table if not exists bill_payment (
  id             uuid primary key default gen_random_uuid(),
  bill_id        uuid not null references bill (id),
  paid_by        uuid not null references profiles (id),   -- the OFW who fired it
  amount_stroops bigint not null check (amount_stroops > 0),
  tx_hash        text not null,                            -- 64 hex chars
  paid_at        timestamptz not null default now()
);

-- ============================================================
-- 2. RLS
-- ============================================================

alter table biller       enable row level security;
alter table bill         enable row level security;
alter table bill_payment enable row level security;

-- READ — any authenticated user can read billers + bills + payments.
-- Bills are tied to a family but the demo's OFW needs to read them too,
-- and there's no ofw→family schema link yet (same as the wishlist case).
-- Service-role bypasses RLS; cookie-bound clients (UI) hit these reads.
drop policy if exists read_all_billers       on biller;
drop policy if exists read_all_bills         on bill;
drop policy if exists read_all_bill_payments on bill_payment;

create policy read_all_billers       on biller       for select using (true);
-- `(select auth.role())` is the cached-per-query form. Without the subquery
-- wrap Postgres re-evaluates the function for every row in the result set
-- (Supabase advisor: auth_rls_initplan).
create policy read_all_bills         on bill         for select using ((select auth.role()) = 'authenticated');
create policy read_all_bill_payments on bill_payment for select using ((select auth.role()) = 'authenticated');

-- WRITE — all writes go through server-side routes using service_role.
-- No client-side write policies on purpose: bill creation is a
-- privileged seed/admin op, and bill payments are mediated by the
-- /api/bills/pay route (which verifies caller is OFW and submits the
-- on-chain tx). Same posture as `settlement`.

-- ============================================================
-- 3. Grants
-- ============================================================

grant select, insert, update, delete on table public.biller       to service_role;
grant select, insert, update, delete on table public.bill         to service_role;
grant select, insert, update, delete on table public.bill_payment to service_role;

grant select on table public.biller       to authenticated, anon;
grant select on table public.bill         to authenticated;
grant select on table public.bill_payment to authenticated;

-- ============================================================
-- 4. Helpful indexes (small-table demo, but cheap to add now)
-- ============================================================

create index if not exists bill_family_id_status_idx
  on bill (family_id, status, due_date);

create index if not exists bill_payment_bill_id_paid_at_idx
  on bill_payment (bill_id, paid_at desc);

-- Cover the foreign keys that the advisor flagged on 2026-05-22.
-- `bill_family_id_status_idx` already covers `bill.family_id` (it leads on
-- family_id), so the advisor reads it as covered. The biller_id and
-- paid_by FKs are the ones still flagged — add them now.
create index if not exists bill_biller_id_idx       on bill         (biller_id);
create index if not exists bill_payment_paid_by_idx on bill_payment (paid_by);
