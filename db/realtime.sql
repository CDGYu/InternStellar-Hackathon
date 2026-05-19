-- db/realtime.sql
-- InternStellar — enable Supabase Realtime (Day 2 task 4).
-- Run AFTER schema.sql + policies.sql.
--
-- P3 consumes this on Day 3: the Store dashboard live-updates when a
-- family submits / progresses a wishlist.
--
-- The Supabase dashboard toggle (Database -> Replication) does the same
-- thing as the publication step below. Pick ONE — this file, OR the
-- toggle. Don't do both. This file is the auditable, re-runnable option.
--
-- Idempotent: safe to re-run.

-- ------------------------------------------------------------
-- 1. Add tables to the realtime publication.
--    A change is only broadcast if its table is in this publication —
--    this is the step the dashboard toggle performs.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'wishlist'
  ) then
    alter publication supabase_realtime add table wishlist;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'wishlist_item'
  ) then
    alter publication supabase_realtime add table wishlist_item;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. REPLICA IDENTITY FULL.
--    Default replica identity only ships the primary key on UPDATE/DELETE.
--    FULL ships the entire old row, so P3's subscription receives the
--    complete record (and so server-side filters on changed columns work).
-- ------------------------------------------------------------
alter table wishlist      replica identity full;
alter table wishlist_item replica identity full;
