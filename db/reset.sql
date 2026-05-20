-- db/reset.sql
-- InternStellar — demo reset RPC.
--
-- WHY THIS FILE EXISTS:
-- During a Day-5 rehearsal we want a one-button "back to clean canvas"
-- between runs: drop every wishlist + line item + settlement row, and
-- reset every inventory item to 50 stock. Doing it as a Postgres function
-- means `npm run reset` becomes a single `.rpc('reset_demo')` call instead
-- of three round-trips + a stock loop.
--
-- WHO RUNS IT (once):
--   P4 runs this in the Supabase SQL editor to install the function.
--   After that, scripts/reset-demo.ts calls it via the service-role key.
--
-- WHO RUNS IT (per reset):
--   `npm run reset` → scripts/reset-demo.ts → admin.rpc('reset_demo')
--
-- WHY TRUNCATE + SECURITY DEFINER:
--   TRUNCATE is faster and resets identity sequences (none here, but
--   future-proof). service_role doesn't have TRUNCATE privilege by
--   default in Supabase — only the function's owner (postgres) does —
--   so the function is SECURITY DEFINER and runs with the owner's
--   privileges. The execute grant is gated to service_role only.
--
-- IDEMPOTENT: `create or replace` + the truncate-then-update body. Safe
-- to re-run the file; safe to call reset_demo() any number of times in a
-- row.
--
-- Run order:  schema -> policies -> realtime -> grants -> functions -> reset -> seed

-- ============================================================
-- reset_demo()
--
-- Empties the wishlist + line-item + settlement tables, then sets every
-- inventory row's stock back to 50. Returns void.
--
-- We list the three tables in a single TRUNCATE statement so the foreign
-- keys between them (settlement → wishlist, wishlist_item → wishlist)
-- don't need explicit CASCADE — TRUNCATE on a set of mutually-referencing
-- tables resolves atomically.
-- ============================================================
create or replace function public.reset_demo()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Order in the list doesn't matter for atomicity, but writing it
  -- bottom-up reads naturally: events first, then line items, then orders.
  truncate
    public.settlement,
    public.wishlist_item,
    public.wishlist;

  -- Stock baseline matches the value in seed.sql so a fresh demo run
  -- looks the same regardless of whether reset was called recently.
  update public.inventory set stock = 50;
end;
$$;

comment on function public.reset_demo() is
  'Day 5 reset: truncate settlement/wishlist_item/wishlist, set every inventory.stock = 50. Idempotent. Called from scripts/reset-demo.ts via service_role.';

-- Lock the function down: only service_role may execute it. Anon and
-- authenticated callers should never reach this — there's no UI surface
-- that should be allowed to wipe production data.
revoke all on function public.reset_demo() from public;
grant execute on function public.reset_demo() to service_role;
