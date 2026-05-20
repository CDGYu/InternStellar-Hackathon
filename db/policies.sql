-- db/policies.sql
-- Row-Level Security. Run AFTER schema.sql.
--
-- Why enable RLS at all: adding it later silently breaks working code because
-- new policies block reads the app already depends on.
--
-- Day 2 state (now):
--   * RLS enabled on every table.
--   * READ policies tightened "just enough" so the demo can't leak one
--     family's wishlist to another (see guide, Day 2 task 2).
--   * dev_write_* policies keep WRITES wide open so the build isn't blocked.
--     These are temporary — drop them on Day 4-5 (see bottom of file), and
--     the tightened read policies below become the enforced ruleset.
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
-- 2. READ policies (Day 2 — tightened just enough)
-- ------------------------------------------------------------
drop policy if exists read_all_profiles          on profiles;
drop policy if exists read_all_inventory         on inventory;
drop policy if exists auth_reads_inventory       on inventory;
drop policy if exists read_all_wishlist          on wishlist;
drop policy if exists family_reads_own_wishlist  on wishlist;
drop policy if exists store_reads_wishlist       on wishlist;
drop policy if exists read_all_wishlist_item     on wishlist_item;
drop policy if exists read_all_settlement        on settlement;

-- profiles: stays open. Every role view needs to resolve display names
-- across roles (family sees the store's name, store sees the family's).
create policy read_all_profiles on profiles
  for select using (true);

-- inventory: any signed-in user can browse the store's catalogue.
create policy auth_reads_inventory on inventory
  for select using (auth.role() = 'authenticated');

-- wishlist: a family sees ONLY its own wishlists...
create policy family_reads_own_wishlist on wishlist
  for select using (auth.uid() = family_id);

-- ...and the store sees all of them (it needs the incoming-order feed).
-- Kept permissive for the demo — one store, scoping adds no value here.
create policy store_reads_wishlist on wishlist
  for select using (auth.role() = 'authenticated');

-- wishlist_item / settlement: open reads. Line items and the on-chain
-- audit trail aren't sensitive between the demo's single family + store.
create policy read_all_wishlist_item on wishlist_item
  for select using (true);

create policy read_all_settlement on settlement
  for select using (true);

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
-- DAY 4-5 — to enforce the tightened reads above:
--   1. Drop every dev_write_* policy (section 3).
--   2. Add narrow write policies, e.g. a family writes only its own
--      wishlist:
--        create policy family_writes_own_wishlist on wishlist
--          for all using (auth.uid() = family_id)
--                  with check (auth.uid() = family_id);
-- Until then, dev_write_* (FOR ALL) keeps everything open for the build.
-- ============================================================
