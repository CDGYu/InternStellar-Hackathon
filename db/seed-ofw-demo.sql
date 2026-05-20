-- db/seed-ofw-demo.sql
-- Demo wishlist + settlement flow for the OFW dashboard.
--
-- WHY THIS FILE EXISTS:
-- db/seed.sql intentionally leaves `wishlist`, `wishlist_item`, and
-- `settlement` empty — those rows are created by the app as the demo runs.
-- The OFW dashboard would therefore render with all panels empty until any
-- real flow happens. This file populates a believable cross-section of
-- states (released / locked / pending_approval / draft) so the dashboard
-- shows real-looking data for screenshots and demo recordings.
--
-- WHO RUNS IT: P3/P4, in the Supabase SQL editor, AFTER seed.sql.
-- IDEMPOTENT: re-running clears these 4 wishlists and re-creates them.
-- Run order:  schema -> policies -> realtime -> grants -> seed -> seed-ofw-demo
--
-- ITEM LOOKUPS: rather than hard-coding inventory UUIDs (which only match
-- against seed.sql's fixed IDs), every wishlist_item insert joins inventory
-- by (store_id, name). That keeps this file working even when inventory
-- rows came from a manual insert or an older seed where IDs were random.
--
-- Tx hashes here are plausible-looking but FAKE — never reconcile against
-- chain truth from these. Real escrows write through /api/escrow/lock.

-- ============================================================
-- Pre-flight — fail loudly if prerequisites are missing
-- ============================================================
do $$
declare
  family_count   int;
  store_count    int;
  inventory_count int;
begin
  select count(*) into family_count
    from profiles where id = '22222222-2222-2222-2222-222222222222';
  if family_count = 0 then
    raise exception 'Family profile (22222222-…) missing. Run db/seed.sql first.';
  end if;

  select count(*) into store_count
    from profiles where id = '33333333-3333-3333-3333-333333333333';
  if store_count = 0 then
    raise exception 'Store profile (33333333-…) missing. Run db/seed.sql first.';
  end if;

  select count(*) into inventory_count
    from inventory
   where store_id = '33333333-3333-3333-3333-333333333333'
     and name in (
       'Rice', 'Canned Sardines', 'Instant Noodles', 'Cooking Oil',
       'Powdered Milk', 'Paracetamol', 'Vitamin C',
       'Amlodipine (maintenance)'
     );
  if inventory_count < 8 then
    raise exception
      'Inventory is missing % of 8 demo items by name. Run db/seed.sql first.',
      8 - inventory_count;
  end if;
end$$;

-- ============================================================
-- 0. Clean slate for just these demo rows (idempotent)
-- ============================================================
delete from settlement     where wishlist_id in (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004'
);
delete from wishlist_item  where wishlist_id in (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004'
);
delete from wishlist       where id in (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004'
);

-- ============================================================
-- 1. Wishlists (totals get recomputed at the end of this file
--    from line items — see step 4)
-- ============================================================
insert into wishlist (id, family_id, status, total_stroops, notes,
                       escrow_tx_hash, release_tx_hash,
                       created_at, updated_at)
values
  ('b0000000-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222',
   'released',
   0,
   'Lola Cora — pantry restock + maintenance meds',
   'a1b2c3d4e5f6071829304a5b6c7d8e9f0a1b2c3d4e5f6071829304a5b6c7d8e9',
   'f9e8d7c6b5a4039281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a',
   now() - interval '5 days',
   now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222',
   'locked',
   0,
   'Mid-month groceries — locked, waiting on delivery',
   '4d5e6f70819203a4b5c6d7e8f90a1b2c3d4e5f6071829304a5b6c7d8e9f0a1b2',
   null,
   now() - interval '2 days',
   now() - interval '6 hours'),
  ('b0000000-0000-0000-0000-000000000003',
   '22222222-2222-2222-2222-222222222222',
   'pending_approval',
   0,
   'Lola needs her BP meds + multivitamins',
   null,
   null,
   now() - interval '1 day',
   now() - interval '4 hours'),
  ('b0000000-0000-0000-0000-000000000004',
   '22222222-2222-2222-2222-222222222222',
   'draft',
   0,
   'Cora is still shopping…',
   null,
   null,
   now() - interval '6 hours',
   now() - interval '30 minutes');

-- ============================================================
-- 2. Wishlist items
-- Each statement is INSERT … SELECT joining a small VALUES list
-- (item_name, qty) against the live `inventory` table. The
-- `price_stroops_at_add` comes from inventory.price_stroops at insert
-- time, mirroring what /api/escrow/lock would do.
-- ============================================================

-- ---- Wishlist 1 (released) — grocery + medicine ----------------
insert into wishlist_item (wishlist_id, inventory_id, quantity, price_stroops_at_add)
select 'b0000000-0000-0000-0000-000000000001'::uuid, inv.id, v.qty, inv.price_stroops
  from (values
    ('Rice',                     2),
    ('Canned Sardines',          6),
    ('Powdered Milk',            1),
    ('Amlodipine (maintenance)', 1),
    ('Paracetamol',              2)
  ) as v(item_name, qty)
  join inventory inv
    on inv.name = v.item_name
   and inv.store_id = '33333333-3333-3333-3333-333333333333';

-- ---- Wishlist 2 (locked) — mostly grocery ----------------------
insert into wishlist_item (wishlist_id, inventory_id, quantity, price_stroops_at_add)
select 'b0000000-0000-0000-0000-000000000002'::uuid, inv.id, v.qty, inv.price_stroops
  from (values
    ('Rice',            1),
    ('Instant Noodles', 2),
    ('Cooking Oil',     1),
    ('Vitamin C',       1)
  ) as v(item_name, qty)
  join inventory inv
    on inv.name = v.item_name
   and inv.store_id = '33333333-3333-3333-3333-333333333333';

-- ---- Wishlist 3 (pending_approval) — medicine-heavy ------------
insert into wishlist_item (wishlist_id, inventory_id, quantity, price_stroops_at_add)
select 'b0000000-0000-0000-0000-000000000003'::uuid, inv.id, v.qty, inv.price_stroops
  from (values
    ('Amlodipine (maintenance)', 1),
    ('Vitamin C',                2),
    ('Paracetamol',              1)
  ) as v(item_name, qty)
  join inventory inv
    on inv.name = v.item_name
   and inv.store_id = '33333333-3333-3333-3333-333333333333';

-- ---- Wishlist 4 (draft) — small grocery ------------------------
insert into wishlist_item (wishlist_id, inventory_id, quantity, price_stroops_at_add)
select 'b0000000-0000-0000-0000-000000000004'::uuid, inv.id, v.qty, inv.price_stroops
  from (values
    ('Canned Sardines', 4),
    ('Instant Noodles', 1)
  ) as v(item_name, qty)
  join inventory inv
    on inv.name = v.item_name
   and inv.store_id = '33333333-3333-3333-3333-333333333333';

-- ============================================================
-- 3. Settlement audit rows
-- Conceptually:
--   * deposit  — OFW (Maria) pushed XLM into the escrow holding wallet
--   * lock     — wishlist locks against that balance (P2's /api/escrow/lock)
--   * release  — family confirmed delivery, funds went to the store
-- Amounts here are placeholders; step 4 realigns them to the recomputed
-- wishlist totals so the dashboard math is internally consistent.
-- ============================================================

-- ---- Wishlist 1 (released): deposit + lock + release -----------
insert into settlement (wishlist_id, event_type, tx_hash, amount_stroops, created_at)
values
  ('b0000000-0000-0000-0000-000000000001', 'deposit',
   '11ababab22cdcdcd33efef4455565658696a7b8c9d0e1f2031425364758697a8',
   1,  -- recomputed in step 4
   now() - interval '5 days'),
  ('b0000000-0000-0000-0000-000000000001', 'lock',
   'a1b2c3d4e5f6071829304a5b6c7d8e9f0a1b2c3d4e5f6071829304a5b6c7d8e9',
   1,
   now() - interval '4 days 22 hours'),
  ('b0000000-0000-0000-0000-000000000001', 'release',
   'f9e8d7c6b5a4039281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a',
   1,
   now() - interval '2 days');

-- ---- Wishlist 2 (locked): deposit + lock, no release yet -------
insert into settlement (wishlist_id, event_type, tx_hash, amount_stroops, created_at)
values
  ('b0000000-0000-0000-0000-000000000002', 'deposit',
   '22cdcdcd33efef4455565658696a7b8c9d0e1f2031425364758697a811ababab',
   1,
   now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000002', 'lock',
   '4d5e6f70819203a4b5c6d7e8f90a1b2c3d4e5f6071829304a5b6c7d8e9f0a1b2',
   1,
   now() - interval '1 day 22 hours');

-- ---- Wishlist 3 (pending_approval): deposit only ---------------
insert into settlement (wishlist_id, event_type, tx_hash, amount_stroops, created_at)
values
  ('b0000000-0000-0000-0000-000000000003', 'deposit',
   '33efef4455565658696a7b8c9d0e1f2031425364758697a811ababab22cdcdcd',
   1,
   now() - interval '1 day');

-- (Wishlist 4 draft: no settlement rows)

-- ============================================================
-- 4. Recompute wishlist.total_stroops from line items, then realign
--    settlement amounts to those recomputed totals so the dashboard
--    math is internally consistent.
--
-- /api/escrow/lock uses sum(qty * price_stroops_at_add). We use the same
-- here so the demo data behaves identically to the real flow.
-- ============================================================
update wishlist w
   set total_stroops = sub.total,
       updated_at    = w.updated_at
  from (
    select wishlist_id, sum(quantity * price_stroops_at_add)::bigint as total
      from wishlist_item
     where wishlist_id in (
       'b0000000-0000-0000-0000-000000000001',
       'b0000000-0000-0000-0000-000000000002',
       'b0000000-0000-0000-0000-000000000003',
       'b0000000-0000-0000-0000-000000000004'
     )
     group by wishlist_id
  ) sub
 where w.id = sub.wishlist_id;

update settlement s
   set amount_stroops = w.total_stroops
  from wishlist w
 where s.wishlist_id = w.id
   and s.wishlist_id in (
     'b0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000002',
     'b0000000-0000-0000-0000-000000000003'
   );

-- ============================================================
-- Optional: set the family's stellar_public_key so /api/escrow/lock
-- can actually run end-to-end from this same data. The dashboard does
-- not depend on this — uncomment if you want to demo a live lock.
-- ============================================================
-- update profiles
--    set stellar_public_key = 'GAXXX…replace-with-funded-testnet-address…'
--  where id = '22222222-2222-2222-2222-222222222222';
