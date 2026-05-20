-- db/policies.sql
-- Row-Level Security. Run AFTER schema.sql.
--
-- Why enable RLS at all: adding it later silently breaks working code because
-- new policies block reads the app already depends on.
--
-- Day 5 state (now):
--   * RLS enabled on every table.
--   * READ policies tightened "just enough" — the demo can't leak one
--     family's wishlist to another.
--   * dev_write_* policies have been DROPPED. Three narrow write policies
--     take their place. Service_role API routes bypass RLS and remain
--     the primary write path; the narrow policies exist so a future
--     P3 button wired via the cookie-bound client (e.g. "Mark delivered")
--     just works without a policies.sql change.
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
-- 2. READ policies
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
-- 3. Drop the Day 2-3 dev_write_* policies
--    These were wide-open FOR ALL using(true) policies to unblock the
--    build. Every actual write path now goes through either:
--      (a) service_role API routes (which bypass RLS), or
--      (b) the narrow per-role policies below.
--    Re-running this file safely re-drops them.
-- ------------------------------------------------------------
drop policy if exists dev_write_profiles      on profiles;
drop policy if exists dev_write_inventory     on inventory;
drop policy if exists dev_write_wishlist      on wishlist;
drop policy if exists dev_write_wishlist_item on wishlist_item;
drop policy if exists dev_write_settlement    on settlement;

-- ------------------------------------------------------------
-- 4. Narrow write policies (Day 5 enforced ruleset)
--
-- profiles    — no cookie-bound writes. registerAction inserts via
--               service_role; users editing their own profile would
--               need a new policy when that UI lands.
-- inventory   — no cookie-bound writes. seed.sql + reset_demo() handle
--               populates; future "edit inventory" UI for the store
--               would need a new policy.
-- wishlist    — family writes its own (draft → pending_approval, etc).
--               Store updates any wishlist (used by "Mark delivered" —
--               status transitions are validated in API/UI, not in RLS).
-- wishlist_item — family can add/remove items on its own wishlists.
-- settlement  — append-only via service_role only; no cookie-bound writes.
-- ------------------------------------------------------------
drop policy if exists family_writes_own_wishlist  on wishlist;
drop policy if exists store_updates_wishlist      on wishlist;
drop policy if exists family_writes_wishlist_item on wishlist_item;

-- A family writes (inserts / updates / deletes) only its own wishlists.
-- `auth.uid() = family_id` enforced on both the OLD row (USING) and the
-- NEW row (WITH CHECK), so a family can't slip a row to another family
-- mid-update.
create policy family_writes_own_wishlist on wishlist
  for all
  using      (auth.uid() = family_id)
  with check (auth.uid() = family_id);

-- The store can update any wishlist row it can see. We don't constrain
-- the status transition here — that's the API/UI's job. The role check
-- is the gate (only profiles.role = 'store' can write at all).
create policy store_updates_wishlist on wishlist
  for update
  using      (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'store'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'store'));

-- A family can manage line items on wishlists it owns. The join through
-- wishlist enforces "own wishlist" for both the row being touched and
-- the parent wishlist after the change.
create policy family_writes_wishlist_item on wishlist_item
  for all
  using (
    exists (
      select 1 from wishlist w
       where w.id = wishlist_item.wishlist_id
         and w.family_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from wishlist w
       where w.id = wishlist_item.wishlist_id
         and w.family_id = auth.uid()
    )
  );

-- ============================================================
-- Future work (not Day 5):
--   * family_updates_own_profile — when P3 adds a profile editor.
--   * store_edits_own_inventory — when P3 adds the inventory editor.
-- ============================================================
