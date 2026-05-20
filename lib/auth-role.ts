import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Server-only profile lookup for a *verified* user.
 *
 * Why this exists: the cookie-bound Supabase client (used for auth) runs
 * queries as the `authenticated` Postgres role and is governed by RLS.
 * db/grants.sql only grants table privileges to `service_role`, so a
 * cookie-bound `profiles` read silently returns null even when an RLS
 * policy of `using (true)` ought to allow it — the table-level GRANT is
 * missing for `authenticated`.
 *
 * The result was every dashboard auth gate computing
 * `dashboardForRole(undefined)` and bouncing the user back to /.
 *
 * Resolution: do the role lookup with the service-role client (which
 * grants.sql provisions explicitly). This is safe because every caller
 * has already authenticated the user upstream via
 * `supabase.auth.getUser()` or `signInWithPassword()`; the user id passed
 * in here is verified, not client-supplied.
 *
 * Keep this file `server-only` so it can never accidentally land in a
 * client bundle — the service-role key must never leave the server.
 */
export interface UserProfile {
  id: string;
  role: "ofw" | "family" | "store" | string;
  display_name: string;
  country: string | null;
}

export async function loadUserProfile(
  userId: string,
): Promise<{ profile: UserProfile | null; error: string | null }> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("id, role, display_name, country")
    .eq("id", userId)
    .maybeSingle();
  if (error) return { profile: null, error: error.message };
  if (!data) return { profile: null, error: null };
  return {
    profile: {
      id: data.id as string,
      role: data.role as string,
      display_name: (data.display_name as string) ?? "",
      country: (data.country as string | null) ?? null,
    },
    error: null,
  };
}
