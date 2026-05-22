-- 2026-05-22-profile-by-email-rpc.sql
-- Look up a profile by the user's email. Emails live in auth.users (not
-- profiles), so account-binding server actions resolve a target account via
-- this SECURITY DEFINER function. Granted to service_role only — the binding
-- actions run server-side with the service-role client. Applied via Supabase
-- MCP migration `profile_by_email_rpc`.
create or replace function profile_by_email(p_email text)
returns table (id uuid, role text, sponsor_ofw_id uuid)
language sql
security definer
set search_path = public
as $$
  select p.id, p.role, p.sponsor_ofw_id
  from profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(p_email)
  limit 1;
$$;

revoke all on function profile_by_email(text) from public, anon, authenticated;
grant execute on function profile_by_email(text) to service_role;
