-- 2026-05-22-account-store-link.sql
-- Additive, nullable. For role=family: the store this family shops at.
-- Backward-compatible with the otherwise-locked schema (authorized by P4 for
-- the family<->store account binding feature). Applied via Supabase MCP
-- migration `account_store_link`.
alter table profiles
  add column if not exists store_id uuid references profiles(id);

comment on column profiles.store_id is
  'For role=family: the store profile this family shops at. NULL = global/single-store.';
