import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresh the Supabase session on every request.
 *
 * Why this exists: Supabase auth tokens expire (default 1h). Without a
 * refresh step, a user signed in an hour ago would hit a stale session on
 * the next server render and silently appear logged-out. The recommended
 * pattern is to call `supabase.auth.getUser()` inside middleware — that
 * triggers the SDK to refresh the access token if needed and re-set the
 * cookies on the response.
 *
 * The dance with `request.cookies.set` then `NextResponse.next({ request })`
 * then `response.cookies.set` is from the official SSR docs — it ensures
 * the refreshed cookies are visible to the *current* request's downstream
 * handlers (server components, actions) AND on the response sent back to
 * the browser.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Env missing — let the request continue; the page will surface the
    // error in a more useful place than middleware would.
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options as CookieOptions);
        }
      },
    },
  });

  // Touch the session — this is what actually refreshes it.
  // Result discarded; we just want the side effects on cookies.
  await supabase.auth.getUser();

  return response;
}
