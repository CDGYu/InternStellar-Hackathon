-- db/migrations/2026-05-21-escrow-id-and-sponsor.sql
--
-- Two related changes from the post-Day-6 audit (NEEDED-UPDATES-FOR-THE-REPO.md):
--
--   §3.3  wishlist.escrow_id (bigint, nullable)
--         The on-chain u32 escrow id was previously stashed in `wishlist.notes`
--         as the marker string `__escrow_ret__:<id>`. `notes` is a user-facing
--         free-text field — if a family edits notes after lock, the marker can
--         be lost and the release path silently breaks. Promote it to its own
--         typed column so the lock route can write it directly and the release
--         route can read it without regex extraction.
--
--   §4.1  profiles.sponsor_ofw_id (uuid, nullable, FK to profiles.id)
--         The current OFW→family auth check accepts any user with role 'ofw',
--         which means in a multi-tenant world any OFW could lock/release
--         escrows against any family's wishlist. This column lets us enforce
--         that an OFW can only act on families they actually sponsor.
--
-- Idempotent: safe to re-run.
-- Apply once via the Supabase SQL editor, then propagate the same shape
-- into db/schema.sql (already done in this commit) so fresh setups match.

-- ---------------------------------------------------------------
-- §3.3 — wishlist.escrow_id
-- ---------------------------------------------------------------
alter table wishlist
  add column if not exists escrow_id bigint;

comment on column wishlist.escrow_id is
  'On-chain u32 escrow id returned by lock_escrow. NULL until the lock route writes it; consumed by the release route. Do NOT derive from notes.';

-- ---------------------------------------------------------------
-- §4.1 — profiles.sponsor_ofw_id
-- ---------------------------------------------------------------
alter table profiles
  add column if not exists sponsor_ofw_id uuid references profiles (id);

create index if not exists profiles_sponsor_ofw_idx
  on profiles (sponsor_ofw_id);

comment on column profiles.sponsor_ofw_id is
  'For role=family: the OFW profile that funds this family. NULL when unlinked. The escrow lock/release routes refuse OFW calls that act on a family whose sponsor_ofw_id does not match the caller.';

-- ---------------------------------------------------------------
-- §4.2 — Postgres-backed idempotency lock
--
-- Replaces the in-memory Map in lib/api/idempotency.ts. The in-memory
-- version dedupes per Node process; behind a load balancer with N replicas
-- it fails open. This table lets every replica share the same lock state
-- via two SECURITY DEFINER RPCs (try_idempotency_lock / release_idempotency_lock)
-- exposed to the service_role.
--
-- Lock semantics:
--   - INSERT … ON CONFLICT DO UPDATE WHERE expires_at < now() RETURNING key
--     acquires the lock if no live row holds it; emulates pg_try_advisory_lock
--     with a TTL safety net so a crashed handler can't deadlock retries.
--   - DELETE on release. The TTL is the fallback for crash-release.
-- ---------------------------------------------------------------
create table if not exists request_lock (
  key        text primary key,
  expires_at timestamptz not null
);

comment on table request_lock is
  'Cross-replica idempotency lock backing lib/api/idempotency.ts. Each row is a live lock; expires_at is a crash-release fallback.';

-- Acquire. Returns true if the caller now holds the lock.
create or replace function try_idempotency_lock(p_key text, p_ttl_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acquired boolean;
begin
  insert into request_lock (key, expires_at)
    values (p_key, now() + make_interval(secs => p_ttl_seconds))
  on conflict (key) do update
    -- Steal the lock only when the prior holder's TTL has lapsed.
    set expires_at = excluded.expires_at
    where request_lock.expires_at < now()
  returning true into v_acquired;

  return coalesce(v_acquired, false);
end;
$$;

-- Release. Idempotent: no-op if the lock has already expired or been released.
create or replace function release_idempotency_lock(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from request_lock where key = p_key;
$$;

revoke all on function try_idempotency_lock(text, int) from public;
revoke all on function release_idempotency_lock(text) from public;
grant execute on function try_idempotency_lock(text, int)    to service_role;
grant execute on function release_idempotency_lock(text)     to service_role;
