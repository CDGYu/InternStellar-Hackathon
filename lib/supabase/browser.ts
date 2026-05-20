import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in client components.
 *
 * Returns a fresh client each call — cheap, since it just wires up cookie
 * accessors. Don't memoize globally: in dev the env-var read happens at
 * import time which makes hot-reload behave oddly.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase public env vars missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }
  return createBrowserClient(url, anonKey);
}
