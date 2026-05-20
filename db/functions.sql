-- db/functions.sql
-- InternStellar — Postgres functions / RPCs.
-- Run order:  schema.sql -> policies.sql -> realtime.sql -> grants.sql -> functions.sql -> seed.sql
--
-- WHY THIS FILE EXISTS:
-- P4 Day 4 task — when the family confirms delivery and P2's release route
-- fires release_escrow on-chain, the off-chain inventory must decrement to
-- match. Doing it in a single SQL function makes the decrement atomic
-- (all-or-nothing) and bypasses the chatty client-side loop that would
-- otherwise be needed.
--
-- IDEMPOTENT: create or replace + drop policy if exists patterns.

-- ============================================================
-- finalize_wishlist(p_wishlist_id uuid)
--
-- For every wishlist_item on the given wishlist, subtract its quantity
-- from the matching inventory row's stock — clamped at zero so demo
-- runs that re-use the same wishlist (or out-of-sync seed data) can't
-- make stock negative.
--
-- Called by P2's /api/escrow/release route AFTER the on-chain release
-- has succeeded. Service_role bypasses RLS, so SECURITY DEFINER is
-- not strictly required, but we set it so the function is callable
-- from `authenticated` callers too (handy if P3 ever bypasses P2's
-- route for a button — defense in depth).
-- ============================================================
create or replace function public.finalize_wishlist(p_wishlist_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inventory i
     set stock = greatest(0, i.stock - wi.quantity)
    from public.wishlist_item wi
   where wi.wishlist_id = p_wishlist_id
     and wi.inventory_id = i.id;
end;
$$;

-- Make the RPC callable from server-side (service_role) AND from any
-- authenticated user. Anon role is intentionally excluded.
revoke all on function public.finalize_wishlist(uuid) from public;
grant  execute on function public.finalize_wishlist(uuid) to service_role;
grant  execute on function public.finalize_wishlist(uuid) to authenticated;

comment on function public.finalize_wishlist(uuid) is
  'Day 4: decrement inventory.stock for each wishlist_item on the given wishlist. Idempotency is enforced by the caller (release route checks wishlist.release_tx_hash before invoking). Stock is clamped at 0.';
