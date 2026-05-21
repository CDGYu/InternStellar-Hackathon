import { MobileLanding } from "./MobileLanding";

export const dynamic = "force-dynamic";

/**
 * Mobile marketing landing. Mirrors the web `/` page — no auth gate,
 * always shows the Get Started / Create-account CTAs. Logged-in mobile
 * users tapping these CTAs land on `/mobile/login` / `/mobile/register`
 * exactly as a logged-out visitor would.
 *
 * The middleware (middleware.ts) redirects desktop UAs hitting /mobile
 * back to / before this renders, so we don't need any device check here.
 */
export default function MobilePage() {
  return <MobileLanding />;
}
