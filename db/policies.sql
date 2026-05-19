-- db/policies.sql
-- Day 1 Row-Level Security: enable RLS on every table, then add OPEN policies
-- so development is not blocked. You TIGHTEN these on Day 4-5.
--
-- Why enable RLS today: adding it later silently breaks working code because
-- new policies block reads the app already depends on.
--
-- Idempotent: safe to re-run.

-- ------------------------------------------------------------
-- 1. Enable RLS everywhere
-- ------------------------------------------------------------
alter table profiles      enable row level security;
alter table inventory     enable row level security;
alter table wishlist      enable row level security;
alter table wishlist_item enable row level security;
alter table settlement    enable row level security;

-- ------------------------------------------------------------
-- 2. read-everything policies (Day 1 — keep these through Day 2)
-- ------------------------------------------------------------
drop policy if exists read_all_profiles      on profiles;
drop policy if exists read_all_inventory     on inventory;
drop policy if exists read_all_wishlist      on wishlist;
drop policy if exists read_all_wishlist_item on wishlist_item;
drop policy if exists read_all_settlement    on settlement;

create policy read_all_profiles      on profiles      for select using (true);
create policy read_all_inventory     on inventory     for select using (true);
create policy read_all_wishlist      on wishlist      for select using (true);
create policy read_all_wishlist_item on wishlist_item for select using (true);
create policy read_all_settlement    on settlement    for select using (true);

-- ------------------------------------------------------------
-- 3. DEV-ONLY open write policies
--    These let the UI insert/update freely during the build.
--    >>> DELETE every dev_write_* policy on Day 4-5 <<<
--    (Skip this section entirely if all writes go through P2's
--     server-side API routes using the service_role key — that
--     key bypasses RLS, so it never needs these.)
-- ------------------------------------------------------------
drop policy if exists dev_write_profiles      on profiles;
drop policy if exists dev_write_inventory     on inventory;
drop policy if exists dev_write_wishlist      on wishlist;
drop policy if exists dev_write_wishlist_item on wishlist_item;
drop policy if exists dev_write_settlement    on settlement;

create policy dev_write_profiles      on profiles      for all using (true) with check (true);
create policy dev_write_inventory     on inventory     for all using (true) with check (true);
create policy dev_write_wishlist      on wishlist      for all using (true) with check (true);
create policy dev_write_wishlist_item on wishlist_item for all using (true) with check (true);
create policy dev_write_settlement    on settlement    for all using (true) with check (true);

-- ============================================================
-- DAY 4-5 — tightened policies (examples, uncomment when ready).
-- Drop the matching dev_write_* policy first, then add these.
-- ============================================================
-- create policy family_reads_own_wishlist on wishlist
--   for select using (auth.uid() = family_id);
--
-- create policy auth_reads_inventory on inventory
--   for select using (auth.role() = 'authenticated');
