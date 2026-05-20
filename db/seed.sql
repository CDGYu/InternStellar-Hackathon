-- db/seed.sql
-- InternStellar — demo seed data.
-- Run AFTER schema.sql and policies.sql, in the Supabase SQL editor
-- (it runs privileged, so RLS does not block these inserts).
--
-- IDEMPOTENT: safe to run many times — it clears seed rows first.
-- All names are obvious-fake. Never seed real PII.
--
-- The 3 demo users can log in with password:  demo123456
--   maria.ofw@internstellar.demo     (OFW)
--   cora.family@internstellar.demo   (Family)
--   nena.store@internstellar.demo    (Store)
--
-- NOTE: if crypt()/gen_salt() error out ("function does not exist"),
-- your project doesn't expose pgcrypto on the search_path. In that case,
-- create the 3 users via the Supabase dashboard (Auth -> Users) and skip
-- sections 1-2 below — keep their UUIDs matching the ids used here.

-- ============================================================
-- 0. Clean slate
-- ============================================================
truncate settlement, wishlist_item, wishlist, inventory cascade;

-- Removing the auth users cascades to their profiles (FK on delete cascade)
-- and to auth.identities.
delete from auth.users where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

-- ============================================================
-- 1. Demo auth users (password for all three: demo123456)
-- ============================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'maria.ofw@internstellar.demo',
   crypt('demo123456', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Auntie Maria"}',
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'cora.family@internstellar.demo',
   crypt('demo123456', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Lola Cora"}',
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'nena.store@internstellar.demo',
   crypt('demo123456', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"display_name":"Aling Nena"}',
   '', '', '', '');

-- ============================================================
-- 2. Auth identities (needed for email/password login)
-- ============================================================
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"maria.ofw@internstellar.demo"}',
   'email', '11111111-1111-1111-1111-111111111111', now(), now(), now()),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"cora.family@internstellar.demo"}',
   'email', '22222222-2222-2222-2222-222222222222', now(), now(), now()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333',
   '{"sub":"33333333-3333-3333-3333-333333333333","email":"nena.store@internstellar.demo"}',
   'email', '33333333-3333-3333-3333-333333333333', now(), now(), now());

-- ============================================================
-- 3. Profiles (one OFW, one Family, one Store)
-- ============================================================
insert into profiles (id, role, display_name, country)
values
  ('11111111-1111-1111-1111-111111111111', 'ofw',    'Auntie Maria',           'United Arab Emirates'),
  ('22222222-2222-2222-2222-222222222222', 'family', 'Lola Cora',              'Philippines'),
  ('33333333-3333-3333-3333-333333333333', 'store',  'Aling Nena''s Sari-Sari', 'Philippines')
on conflict (id) do update
  set role         = excluded.role,
      display_name = excluded.display_name,
      country      = excluded.country;

-- ============================================================
-- 3b. Seed Stellar addresses for the demo profiles.
--     P1's Day 4 contract calls family.require_auth() on lock/release,
--     and release credits the store's grocery bucket — so both family
--     and store rows need a stellar_public_key.
--
--     OFW + Family share the demo signer's address because the server
--     signs deposit/lock/release with STELLAR_DEMO_SECRET_KEY. The store
--     MUST have a DISTINCT address, otherwise lock_escrow panics with
--     "family cannot be store". The store doesn't sign anything
--     (contract only requires family.require_auth), so we generated a
--     random valid testnet pubkey for it and discarded the secret.
--
--     If you regenerate the demo signer, you must also regenerate the
--     store address so the two stay distinct.
-- ============================================================
update profiles
   set stellar_public_key = 'GAC3WCB5ZZ5GVWDOL4XCA3UJU5ZQ4CCAODREOEDLJB5UT4Q6BZDKPYUK'
 where id in (
   '11111111-1111-1111-1111-111111111111',  -- Auntie Maria (OFW)
   '22222222-2222-2222-2222-222222222222'   -- Lola Cora (Family)
 );

-- Store gets a distinct testnet pubkey (secret discarded; store never signs).
update profiles
   set stellar_public_key = 'GCDBRYRNO6I5HHJJGKYBHJZB7JUFQ2ZA7HPIKKGBEMXG7J633QF6QBY5'
 where id = '33333333-3333-3333-3333-333333333333';  -- Aling Nena (Store)

-- ============================================================
-- 4. Inventory — Aling Nena's stock (prices in stroops)
--    1 XLM = 10,000,000 stroops.  Stock = 50 each.
-- ============================================================
insert into inventory (id, store_id, name, category, price_stroops, stock, unit)
values
  ('a0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333',
   'Rice',             'grocery',  3500000, 50, '5kg'),
  ('a0000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333',
   'Canned Sardines',  'grocery',   450000, 50, '155g'),
  ('a0000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333',
   'Instant Noodles',  'grocery',  1200000, 50, '12 pcs'),
  ('a0000000-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333',
   'Cooking Oil',      'grocery',  1800000, 50, '1L'),
  ('a0000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333',
   'Powdered Milk',    'grocery',  2800000, 50, '900g'),
  ('a0000000-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333',
   'Paracetamol',      'medicine',  800000, 50, '30 tabs'),
  ('a0000000-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333',
   'Vitamin C',        'medicine', 1500000, 50, '30 tabs'),
  ('a0000000-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333',
   'Amlodipine (maintenance)', 'medicine', 2200000, 50, '30 tabs');

-- Wishlist / wishlist_item / settlement are left empty on purpose —
-- those rows are created by the app as the demo runs.
