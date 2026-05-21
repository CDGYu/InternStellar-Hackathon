import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client bound to the *current request's* cookies.
 *
 * Use from:
 *   - Server Components ........ reads only; cookie writes silently no-op
 *   - Server Actions ........... can both read and set cookies (sign-in/out)
 *   - Route Handlers ........... same as server actions
 *
 * Don't import this from a client component — call createSupabaseBrowserClient
 * over in browser.ts instead. The two are kept in separate files so a stray
 * `import { ... } from "@/lib/supabase/server"` in a client file shows up as
 * the right kind of error ("next/headers is server-only") rather than a
 * silent runtime bug.
 *
 * RLS reminder: this client carries the user's JWT. Reads/writes are
 * bounded by your RLS policies — not by the service_role bypass.
 */
export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase public env vars missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      async getAll() {
        return (await cookies()).getAll();
      },
      async setAll(cookiesToSet) {
        try {
          const cookieStore = await cookies();
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options as CookieOptions);
          }
        } catch {
          // Server Components can't write cookies — the call throws.
          // That's fine: the middleware refresh path will set them on
          // the next request. Swallowing here keeps the SC render alive.
        }
      },
    },
  });
}
