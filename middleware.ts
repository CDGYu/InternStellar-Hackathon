import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Single middleware entry — delegates the actual cookie/session refresh
 * to lib/supabase/middleware.ts so the logic stays close to the rest of
 * the Supabase SSR wiring.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

/**
 * Matcher: skip Next internals, static assets, and image optimizer requests
 * — running session refresh on each .js chunk fetch is wasteful and would
 * burn through Supabase auth rate limits in development.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
