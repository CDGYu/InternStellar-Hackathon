-- db/grants.sql
-- Grant table privileges to the service_role.
--
-- WHY THIS FILE EXISTS:
-- During Day 3 P2 functional testing we discovered every server-side query
-- through the service_role key was failing with:
--   permission denied for table <table>
--   HINT: GRANT SELECT ON public.<table> TO service_role;
-- That hint comes from Postgres itself. Supabase's default project setup
-- usually grants the new-table-in-public-schema privilege to service_role
-- automatically; this project's tables were created in a way that bypassed
-- that. This file is the one-shot fix.
--
-- WHO RUNS IT: P4 (Charles) runs once, in the Supabase SQL editor (which
-- executes as the `postgres` superuser; service_role cannot grant itself
-- privileges, hence the chicken-and-egg).
--
-- IDEMPOTENT: GRANT is idempotent on already-granted privileges.
--
-- Run order:  schema.sql  ->  policies.sql  ->  realtime.sql  ->  grants.sql  ->  seed.sql

-- Give the service_role full DML on every table P2's API routes touch.
-- service_role bypasses RLS, so these grants alone unblock all server-side
-- reads/writes from /api/escrow/lock and /api/escrow/release.
grant select, insert, update, delete on table public.profiles      to service_role;
grant select, insert, update, delete on table public.inventory     to service_role;
grant select, insert, update, delete on table public.wishlist      to service_role;
grant select, insert, update, delete on table public.wishlist_item to service_role;
grant select, insert, update, delete on table public.settlement    to service_role;

-- Sequence usage (only matters if any table uses serial/identity columns —
-- this schema uses gen_random_uuid() so this is a precaution / future-proof).
grant usage on all sequences in schema public to service_role;

-- Set DEFAULT privileges so any NEW table P4 adds in public is automatically
-- accessible to service_role without re-running this file.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage on sequences to service_role;
