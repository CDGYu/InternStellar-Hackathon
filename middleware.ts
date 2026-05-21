import { NextResponse, type NextRequest } from "next/server";

import { isMobileUserAgent } from "@/lib/device";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Single middleware entry. Two responsibilities:
 *
 *   1. UA-based redirect between the web routes and the parallel
 *      /mobile/* tree. Mobile UA on a web URL → 307 to /mobile<path>;
 *      desktop UA on a /mobile URL → 307 to the equivalent web URL.
 *
 *   2. If neither redirect fires (correct tree for this UA), delegate
 *      to updateSession() which refreshes Supabase cookies — that's
 *      how the rest of the app handles session expiry transparently.
 *
 * The `matcher` config excludes /api/, /auth/confirm (the email-link
 * token-exchange route — see spec §8.1), Next internals, and static
 * assets. The redirect logic preserves the request's query string via
 * nextUrl.clone().
 *
 * Spec: docs/specs/2026-05-21-mobile-phase-0-1-design.md §5.3
 */
export async function middleware(request: NextRequest) {
  const ua = request.headers.get("user-agent");
  const isMobile = isMobileUserAgent(ua);
  const path = request.nextUrl.pathname;
  const isMobilePath = path === "/mobile" || path.startsWith("/mobile/");

  if (isMobile && !isMobilePath) {
    const url = request.nextUrl.clone();
    url.pathname = path === "/" ? "/mobile" : `/mobile${path}`;
    return NextResponse.redirect(url, 307);
  }

  if (!isMobile && isMobilePath) {
    const url = request.nextUrl.clone();
    url.pathname = path === "/mobile" ? "/" : path.replace(/^\/mobile/, "");
    return NextResponse.redirect(url, 307);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|auth/confirm|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|map)$).*)",
  ],
};
