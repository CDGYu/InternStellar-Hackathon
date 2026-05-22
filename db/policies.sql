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
-- 2026-05-22 hardening pass:
--   * Every `auth.uid()` / `auth.role()` call is wrapped in `(select …)` so
--     Postgres caches the value per query instead of re-evaluating per row
--     (clears Supabase advisor lint `auth_rls_initplan`).
--   * The previously overlapping wishlist + wishlist_item policies are
--     consolidated into one policy per (action) so there are no more
--     "multiple permissive policies for the same role + action" lints.
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
-- `(select auth.role())` caches the value across the planner's row eval.
create policy auth_reads_inventory on inventory
  for select using ((select auth.role()) = 'authenticated');

-- wishlist: SELECT is consolidated below into wishlist_select so we
-- don't trigger the "multiple permissive policies" advisor.

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
-- 4. Consolidated read + write policies (2026-05-22 hardening)
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
--               Each (action) gets exactly ONE policy: SELECT, INSERT,
--               UPDATE, DELETE — so the "multiple permissive policies"
--               advisor stays clear.
-- wishlist_item — family can add/remove items on its own wishlists.
--               SELECT stays open (line items aren't sensitive in the
--               single-store demo); writes are gated by family ownership
--               of the parent wishlist.
-- settlement  — append-only via service_role only; no cookie-bound writes.
-- ------------------------------------------------------------
drop policy if exists family_writes_own_wishlist  on wishlist;
drop policy if exists store_updates_wishlist      on wishlist;
drop policy if exists family_writes_wishlist_item on wishlist_item;
drop policy if exists wishlist_select             on wishlist;
drop policy if exists wishlist_insert             on wishlist;
drop policy if exists wishlist_update             on wishlist;
drop policy if exists wishlist_delete             on wishlist;
drop policy if exists wishlist_item_insert        on wishlist_item;
drop policy if exists wishlist_item_update        on wishlist_item;
drop policy if exists wishlist_item_delete        on wishlist_item;

-- A family sees its own wishlists. The store (role='store') sees all of
-- them (single-store demo, scoping is meaningless). One SELECT policy so
-- the planner only evaluates one predicate per row instead of two.
create policy wishlist_select on wishlist
  for select
  using (
    (select auth.uid()) = family_id
    or exists (
      select 1 from profiles p
       where p.id = (select auth.uid())
         and p.role = 'store'
    )
  );

-- Only the family inserts via the cookie-bound client. Store INSERTs
-- (POST /api/store/orders/create) go through service_role, which bypasses
-- RLS, so no `or store-caller` branch is needed here.
create policy wishlist_insert on wishlist
  for insert
  with check ((select auth.uid()) = family_id);

-- Family updates their own row; store can update any wishlist (for "Mark
-- delivered"). Combined into one policy so UPDATE only evaluates one
-- permissive predicate per row.
create policy wishlist_update on wishlist
  for update
  using (
    (select auth.uid()) = family_id
    or exists (
      select 1 from profiles p
       where p.id = (select auth.uid())
         and p.role = 'store'
    )
  )
  with check (
    (select auth.uid()) = family_id
    or exists (
      select 1 from profiles p
       where p.id = (select auth.uid())
         and p.role = 'store'
    )
  );

-- DELETE is family-only; the store never deletes a wishlist (cancellation
-- transitions status to 'cancelled' via UPDATE instead).
create policy wishlist_delete on wishlist
  for delete
  using ((select auth.uid()) = family_id);

-- wishlist_item: writes are gated by family ownership of the parent
-- wishlist; the SELECT side is handled by `read_all_wishlist_item` above
-- (single source of truth, no overlap with the write policies).
create policy wishlist_item_insert on wishlist_item
  for insert
  with check (
    exists (
      select 1 from wishlist w
       where w.id = wishlist_item.wishlist_id
         and w.family_id = (select auth.uid())
    )
  );

create policy wishlist_item_update on wishlist_item
  for update
  using (
    exists (
      select 1 from wishlist w
       where w.id = wishlist_item.wishlist_id
         and w.family_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from wishlist w
       where w.id = wishlist_item.wishlist_id
         and w.family_id = (select auth.uid())
    )
  );

create policy wishlist_item_delete on wishlist_item
  for delete
  using (
    exists (
      select 1 from wishlist w
       where w.id = wishlist_item.wishlist_id
         and w.family_id = (select auth.uid())
    )
  );

-- ============================================================
-- Future work (not Day 5):
--   * family_updates_own_profile — when P3 adds a profile editor.
--   * store_edits_own_inventory — when P3 adds the inventory editor.
-- ============================================================
