/**
 * Server-side User-Agent classifier used by middleware.ts to decide
 * whether to redirect a request between the web tree and the /mobile
 * tree.
 *
 * Pattern is intentionally inclusive of tablets (iPad) and mobile
 * crawlers (googlebot-mobile) — they should all land on the mobile
 * layout. Anything without a UA header (null/undefined/empty) is
 * treated as desktop so curl/scripts/health-checks default to the web
 * pages.
 */
const MOBILE_UA_PATTERN =
  /Mobile|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Windows Phone/i;

export function isMobileUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return MOBILE_UA_PATTERN.test(ua);
}
