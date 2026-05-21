# Mobile Parity — Phase 0 + 1 (Foundation + Auth) — Design Spec

- **Date:** 2026-05-21
- **Owner:** (frontend, current branch `main`)
- **Repo:** `CDGYu/InternStellar-Hackathon`
- **Scope:** Phase 0 (foundation) + Phase 1 (auth flow) of a multi-phase
  effort to give the Next.js app full mobile parity with the existing web
  routes.

## 1. Goal

After this work ships, the following must be true for a user opening the
deployed app on a real mobile device (iPhone Safari / Android Chrome):

1. Visiting any web URL (`/`, `/login`, `/register`, `/ofw`, `/family`,
   `/store`, `/auth/confirmed`, etc.) auto-redirects them to the
   equivalent mobile URL under `/mobile/*`. Web URL stays in browser
   history one frame, then becomes `/mobile/...`.
2. The mobile landing at `/mobile` presents Get Started → mobile login
   and Create-account → mobile register, both visually matching the
   designs in [`MOBILE UI/`](../../MOBILE UI/).
3. Logging in on mobile lands the user on `/mobile/ofw` or
   `/mobile/family` (their existing role dashboards under `/mobile`).
4. Registering on mobile lands them either on `/mobile/{role-dashboard}`
   (auto-confirm projects) or `/mobile/login?registered=1` (email
   confirmation projects), with the "check your email" banner shown.
5. Logging out from any mobile dashboard lands at `/mobile/login`.
6. Desktop visitors are **unaffected.** Every existing web route renders
   identically to today. Desktop visitors who type `/mobile/...` by hand
   get redirected back to the equivalent web URL.

## 2. Non-Goals

The following are explicitly **out of scope** for this spec and will be
addressed in subsequent Phase 2-5 specs:

- Mobile views for OFW sub-flows (`/mobile/ofw/transactions`,
  `/mobile/ofw/send`, etc. beyond the inline tabs already in the
  mobile dashboard) — **Phase 2.**
- Mobile views for family sub-flows (Shop, Activity) — **Phase 3.**
- Mobile dashboard for the **store** role and store sub-flows
  (CreateOrder, OrderQueue, Inventory) — **Phase 4.** A placeholder
  page at `/mobile/store` is in scope here.
- Mobile views for `/settings/*` — **Phase 5.**
- Removing the standalone `MOBILE UI/` reference folder — orthogonal
  cleanup, not blocking.
- A device-detection escape hatch (`?view=desktop`/`?view=mobile`)
  for previewing the other layout — explicitly rejected during
  brainstorming. Desktop stays desktop, mobile stays mobile.
- A phone-frame mockup wrapper on either device. Mobile UI fills the
  full viewport on real phones; desktop never previews mobile.

## 3. Constraints

- **No changes to the existing web routes** (`app/page.tsx`,
  `app/(app)/*`, `app/(auth)/*`, `app/auth/*`, `app/settings/*`). The
  responsive behavior is achieved entirely through middleware redirects
  plus a parallel `/mobile/*` route tree.
- **No changes to the existing server actions** in
  [`app/auth/actions.ts`](../../app/auth/actions.ts). They redirect to
  `/ofw`/`/family`/`/store`/`/login` as today; the middleware rewrites
  those redirects to their `/mobile/*` equivalents on the follow-up
  request when the user is on mobile.
- **Reuse the existing API layer** unchanged. Mobile forms call the same
  `signInAction` / `registerAction` server actions; no parallel mobile
  API.
- **No new dependencies.** `lucide-react` and `recharts` are already
  installed and used by the existing mobile dashboard.
- **Tailwind theme constants** (the `#5b7cff` → `#7c9aff` gradient, the
  `#f5f7fa` bg, the rounded-3xl cards) match what the existing
  `app/mobile/MobileDashboardClient.tsx` already uses — for consistency
  with the dashboard the user lands on after login.

## 4. Architecture

### 4.1 Route layout

```
app/
├── page.tsx                             # [unchanged] web landing
├── (auth)/
│   ├── login/page.tsx                   # [unchanged] web login
│   ├── login/LoginForm.tsx              # [unchanged] reused server action target
│   ├── register/page.tsx                # [unchanged] web register
│   └── register/RegisterForm.tsx        # [unchanged]
├── (app)/
│   ├── ofw/page.tsx                     # [unchanged] web OFW dashboard
│   ├── family/page.tsx                  # [unchanged]
│   └── store/page.tsx                   # [unchanged]
├── auth/
│   ├── actions.ts                       # [unchanged] signInAction / registerAction
│   ├── confirm/route.ts                 # [unchanged]
│   ├── confirmed/page.tsx               # [unchanged]
│   └── role-routes.ts                   # [unchanged] dashboardForRole()
├── mobile/                              # parallel mobile tree
│   ├── page.tsx                         # mobile landing  [exists, minor edits]
│   ├── MobileLanding.tsx                # [exists, minor edits to update links]
│   ├── ofw/page.tsx                     # mobile OFW dashboard  (migrated from /mobile)
│   ├── family/page.tsx                  # mobile Family dashboard  (migrated)
│   ├── store/page.tsx                   # [NEW] "Coming soon" placeholder
│   ├── login/
│   │   ├── page.tsx                     # [NEW] mobile login shell
│   │   └── MobileLoginForm.tsx          # [NEW] client form (calls signInAction)
│   ├── register/
│   │   ├── page.tsx                     # [NEW] mobile register shell
│   │   └── MobileRegisterForm.tsx       # [NEW] client form (calls registerAction)
│   ├── auth/
│   │   └── confirmed/page.tsx           # [NEW] mobile post-confirm landing
│   ├── components/                      # [exists] MobileBills/MobileSendFunds/MobileWishlists
│   └── MobileDashboardClient.tsx        # [exists] shared dashboard client, used by ofw + family
└── ...
lib/
├── device.ts                            # [NEW] isMobileUserAgent() helper
└── _test-device.ts                      # [NEW] unit test for the helper
middleware.ts                            # [edit] add device-redirect step
```

### 4.2 Request flow

For a mobile-UA request to `/login`:

```
Browser GET /login
  → middleware.ts
      → isMobileUserAgent(ua) === true
      → path "/login" does not start with "/mobile"
      → 307 redirect to /mobile/login
  → Browser GET /mobile/login
      → middleware.ts
          → isMobileUserAgent(ua) === true
          → path "/mobile/login" already correct → fall through
          → updateSession() refreshes Supabase cookies as today
      → app/mobile/login/page.tsx renders
          → <MobileLoginForm /> client component
              → on submit, calls signInAction (existing server action)
              → on success, server action calls redirect("/ofw")
              → response is 307 to /ofw
  → Browser GET /ofw
      → middleware.ts
          → isMobileUserAgent(ua) === true
          → 307 redirect to /mobile/ofw
  → Browser GET /mobile/ofw
      → app/mobile/ofw/page.tsx renders the dashboard
```

For a desktop-UA request to `/mobile/login` (someone shared a mobile
link):

```
Browser GET /mobile/login
  → middleware.ts
      → isMobileUserAgent(ua) === false
      → path starts with "/mobile" → 307 redirect to /login
  → Browser GET /login
      → existing web flow, unchanged
```

### 4.3 Why middleware (and not a layout)

Three reasons:

1. **Per-request only.** A `(mobile)` layout would still render server
   components for both branches before the JSX decides which to show,
   which wastes the role-lookup + dashboard-load work. Middleware short-
   circuits before any page renders.
2. **Already there.** `middleware.ts` already runs on every non-static
   request to refresh Supabase sessions. Adding the UA check is one
   more `if` in the same hop — no extra round-trip.
3. **Browser-visible URL.** The redirect is a real 307, so the user's
   address bar shows `/mobile/login`. That's a feature for support
   ("send me a screenshot of the URL") and for analytics.

## 5. Foundation deliverables (Phase 0)

### 5.1 `lib/device.ts`

```ts
const MOBILE_UA_PATTERN = /Mobile|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Windows Phone/i;

export function isMobileUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return MOBILE_UA_PATTERN.test(ua);
}
```

Notes:
- Treats iPad as mobile (intentional — iPad Safari with a mobile-size
  viewport should get mobile; the dashboard is responsive within the
  mobile layout up to 428 px and graceful past that).
- Treats `googlebot-mobile` as mobile (intentional — crawler indexes
  the mobile-optimized version).
- No special handling for `?view=` query params. Explicitly out of
  scope per §2.

### 5.2 `lib/_test-device.ts`

Following the existing `scripts/_test-*.ts` pattern: an `npx tsx`
script that runs ~6 assertions and exits non-zero on failure. UAs
covered: Chrome desktop (false), Safari iOS (true), Chrome Android
(true), Firefox desktop (false), iPad Safari (true), googlebot-mobile
(true). Added to `package.json` scripts as `test:device`.

### 5.3 `middleware.ts` extension

Replace current body with:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { isMobileUserAgent } from "@/lib/device";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const ua = request.headers.get("user-agent");
  const isMobile = isMobileUserAgent(ua);
  const path = request.nextUrl.pathname;
  const isMobilePath = path === "/mobile" || path.startsWith("/mobile/");

  // Mobile UA on a web path → redirect to /mobile equivalent
  if (isMobile && !isMobilePath) {
    const url = request.nextUrl.clone();
    url.pathname = path === "/" ? "/mobile" : `/mobile${path}`;
    return NextResponse.redirect(url, 307);
  }

  // Desktop UA on a mobile path → redirect to web equivalent
  if (!isMobile && isMobilePath) {
    const url = request.nextUrl.clone();
    url.pathname = path === "/mobile" ? "/" : path.replace(/^\/mobile/, "");
    return NextResponse.redirect(url, 307);
  }

  // Otherwise: fall through to Supabase session refresh
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|auth/confirm|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|map)$).*)",
  ],
};
```

Notes:
- The `matcher` excludes `/api/` (fetch from any device with any UA
  should hit the same API), `/_next/`, static assets, and
  `/auth/confirm` (the email-link token-exchange route handler — see
  §8.1 for why).

### 5.4 Migrate `/mobile` dashboard into `/mobile/ofw` and `/mobile/family`

Current `app/mobile/page.tsx` does role detection inline and renders
either the OFW or family dashboard inside a phone-frame wrapper. After
this phase:

- `app/mobile/page.tsx` → landing-only (logged-in or not, always shows
  landing — auth-routing happens via middleware on `/`, not here). The
  phone-frame wrapper is removed.
- `app/mobile/ofw/page.tsx` → server component that requires auth +
  role=`ofw`, loads `loadOfwDashboard`, renders `MobileDashboardClient`
  with `currentUserRole="ofw"`. If wrong role or unauthenticated →
  `redirect("/login")` (middleware bounces logged-out mobile users to
  `/mobile/login`).
- `app/mobile/family/page.tsx` → symmetric, role=`family`,
  `loadFamilyDashboard`, `currentUserRole="family"`.
- `app/mobile/store/page.tsx` → placeholder card with a friendly
  "Store dashboard coming soon — please use desktop for now" and a
  link to `/store` (which middleware will catch and bounce to
  desktop). Required because `signInAction` redirects store-role users
  to `/store` → middleware redirects to `/mobile/store` on mobile, and
  we need *something* to render there.

The shared phone-frame wrapper in current `app/mobile/page.tsx` is
**deleted** — per §2, no phone-frame on either device.

## 6. Auth deliverables (Phase 1)

### 6.1 Mobile login

**`app/mobile/login/page.tsx`** (server component):

- Reads `searchParams.registered === "1"` to show a "check your email"
  banner (same semantic as the web login).
- Renders the mobile-styled card shell (white card, rounded-3xl, brand
  header) and includes `<MobileLoginForm />`.
- No auth gate. Logged-in mobile users hitting `/mobile/login` see the
  form — same behavior as the web `/login` page intentionally
  (documented in `app/(auth)/login/page.tsx`).

**`app/mobile/login/MobileLoginForm.tsx`** (client component):

- Mirrors the structure of
  [`app/(auth)/login/LoginForm.tsx`](../../app/(auth)/login/LoginForm.tsx)
  — same `useFormState`/`useFormStatus`, same demo-account chips, same
  `fillAndSubmit` ref trick.
- **Calls the same `signInAction`** imported from
  `@/app/auth/actions`. No parallel server action.
- Visual differences only: gradient button (no neumorphic
  `shadow-neu`), pill-shaped inputs (`rounded-2xl`, `bg-secondary/30`
  equivalent), 3-up demo chip grid styled for narrow viewports.
- Inline `DEMO_ACCOUNTS` constant duplicates the web form's list. To
  avoid drift, extract it to `@/app/auth/demo-accounts.ts` as part of
  this work and import in both forms.

### 6.2 Mobile register

**`app/mobile/register/page.tsx`** (server component): mobile card
shell + `<MobileRegisterForm />`. No auth gate.

**`app/mobile/register/MobileRegisterForm.tsx`** (client component):

- Mirrors
  [`app/(auth)/register/RegisterForm.tsx`](../../app/(auth)/register/RegisterForm.tsx)
  — same fields (`email`, `password`, `display_name`, `role`), same
  `registerAction` server action.
- Role selector styled as 3 large pill buttons (OFW / Family / Store)
  for thumb-tappability instead of a radio group.
- After successful registration the server action redirects to either
  `dashboardForRole(role)` or `/login?registered=1`. The middleware
  rewrites both to `/mobile/...` on the follow-up request.

### 6.3 Mobile auth confirmation landing

**`app/mobile/auth/confirmed/page.tsx`** (server component):

- Same logic as
  [`app/auth/confirmed/page.tsx`](../../app/auth/confirmed/page.tsx)
  — large check icon, "Account confirmed" heading, "Continue to login"
  button → `/mobile/login`.

### 6.4 Update existing `MobileLanding`

Already created last turn at
[`app/mobile/MobileLanding.tsx`](../../app/mobile/MobileLanding.tsx).
Two edits:
- "Get Started" link target → `/mobile/login` (direct, no middleware
  hop — the user is already on `/mobile/*` so we know they're mobile).
- "Create an account" link target → `/mobile/register` (same).

### 6.5 Logout

`signOutAction` in `app/auth/actions.ts` redirects to `/login`.
Middleware catches the follow-up and redirects to `/mobile/login` for
mobile UAs. No code changes needed.

## 7. Edge cases & error handling

| Case | Behavior |
|---|---|
| User on mobile types `/login` manually | Middleware 307 → `/mobile/login`. One extra hop, address bar shows final URL. |
| User on desktop types `/mobile/ofw` (e.g., copy/paste from a phone) | Middleware 307 → `/ofw`. Web dashboard renders. |
| Robot/curl with no UA header | `isMobileUserAgent(null) === false` → treated as desktop. Crawlers see the web pages by default. |
| `?registered=1` after mobile registration | Middleware preserves the query string on redirect (`request.nextUrl.clone()` keeps `searchParams`). Banner shows on `/mobile/login`. |
| OFW logs in → `signInAction` redirects to `/ofw` → middleware → `/mobile/ofw` | Works, but is two 307s in a chain. Acceptable for auth (rare) — not for high-volume routes. |
| Store user logs in on mobile | `signInAction` → `/store` → middleware → `/mobile/store` → "coming soon" placeholder. Phase 4 replaces this. |
| Auth confirmation email opened on mobile (`/auth/confirm?token=...`) | Route handler at `/auth/confirm` is a `route.ts`, not a page. Middleware redirects to `/mobile/auth/confirm` only if we add a mirror handler. **See §8.1.** |
| Session expired during a mobile dashboard view | Existing `loadUserProfile()` returns null → page redirects to `/login` → middleware → `/mobile/login`. |
| User toggles browser desktop-site mode mid-session | They effectively become a desktop UA. Next navigation gets redirected to web. Acceptable — Supabase session is preserved via cookies. |

## 8. Open questions

### 8.1 `/auth/confirm` route handler — mirror or pass-through?

`app/auth/confirm/route.ts` is the email-link handler that exchanges the
token for a session and redirects to `/auth/confirmed`. Two options:

- **(a) Pass-through:** exclude `/auth/confirm` from the middleware
  matcher (so it always runs server-side regardless of UA), then have
  it redirect to `/auth/confirmed` — which middleware will catch and
  rewrite to `/mobile/auth/confirmed` for mobile UAs.
- **(b) Mirror:** add `app/mobile/auth/confirm/route.ts` and let
  middleware redirect mobile UAs from `/auth/confirm?...` to
  `/mobile/auth/confirm?...`.

**Decision:** Option (a). Simpler — one handler, one source of truth
for token exchange. The follow-up redirect to `/auth/confirmed` is what
gets rewritten, not the token-exchange step. Add `/auth/confirm` to the
middleware matcher's exclusion list.

This means the middleware matcher becomes:
```
"/((?!_next/static|_next/image|favicon.ico|api/|auth/confirm|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|map)$).*)",
```

### 8.2 Should `app/mobile/page.tsx` be auth-gated?

Web landing at `/` is **not** auth-gated (per its own comment: "marketing
/ entry page. Always shows Log in / Register — never auto-routes a
signed-in caller to their dashboard"). Mobile landing matches that —
no auth gate. A logged-in mobile user hitting `/` would still see the
mobile landing (one extra tap to dashboard via Log in chip, but
consistent with web). **No action needed.**

## 9. Manual smoke-test checklist

After implementation, validate with Chrome DevTools "Toggle device
toolbar" + iPhone 14 Pro profile (UA spoofed):

1. Navigate to `http://localhost:3000/` → URL becomes `/mobile`,
   mobile landing renders.
2. Tap "Get Started" → URL becomes `/mobile/login`.
3. Tap the "Maria" demo chip → submits, URL becomes `/mobile/ofw`,
   OFW dashboard renders. Dev console shows two 307 redirects in
   the network tab (`/ofw` → `/mobile/ofw`).
4. Tap "Send" tab → `MobileSendFunds` renders. (Unchanged from
   current behavior.)
5. Sign out → URL becomes `/mobile/login`.
6. Tap "Create an account" → URL becomes `/mobile/register`.
7. Fill the form with role=Family → submits, redirects to either
   `/mobile/family` or `/mobile/login?registered=1` depending on
   email-confirm setting.
8. With device toolbar OFF (desktop UA), navigate to
   `http://localhost:3000/mobile/login` → URL becomes `/login`,
   web login renders.
9. `npm run test:device` exits 0.

## 10. Phase 2-5 preview (not in scope here)

For context only. Each gets its own brainstorm + spec + plan:

- **Phase 2 — OFW pages:** flesh out `/mobile/ofw/transactions`,
  `/mobile/ofw/send`, `/mobile/ofw/bills`, `/mobile/ofw/wishlists` as
  dedicated routes. Currently they're inline tabs in the dashboard;
  the question is whether to keep them inline or split.
- **Phase 3 — Family pages:** add `/mobile/family/shop`,
  `/mobile/family/activity`. Bills/Orders already inline.
- **Phase 4 — Store pages:** replace `/mobile/store` placeholder with
  a real dashboard, plus `/mobile/store/create-order`,
  `/mobile/store/orders`, `/mobile/store/inventory`,
  `/mobile/store/activity`.
- **Phase 5 — Settings:** mirror all 7 `/settings/*` routes under
  `/mobile/settings/*`.

## 11. Cross-references

- [`CLAUDE.md`](../../CLAUDE.md) — project conventions (stroops,
  snake_case DB).
- [`middleware.ts`](../../middleware.ts) — middleware to extend.
- [`lib/supabase/middleware.ts`](../../lib/supabase/middleware.ts) —
  Supabase session refresh, called from the new middleware.
- [`app/auth/actions.ts`](../../app/auth/actions.ts) — `signInAction`,
  `registerAction`, `signOutAction` (all reused unchanged).
- [`app/auth/role-routes.ts`](../../app/auth/role-routes.ts) —
  `dashboardForRole()`; redirects emitted here are caught by the new
  middleware.
- [`app/(auth)/login/LoginForm.tsx`](../../app/(auth)/login/LoginForm.tsx),
  [`app/(auth)/register/RegisterForm.tsx`](../../app/(auth)/register/RegisterForm.tsx)
  — patterns to mirror for the mobile forms.
- [`app/mobile/MobileDashboardClient.tsx`](../../app/mobile/MobileDashboardClient.tsx),
  [`app/mobile/components/`](../../app/mobile/components/) — existing
  mobile components, consumed unchanged by `app/mobile/ofw/page.tsx`
  and `app/mobile/family/page.tsx`.
- [`MOBILE UI/app/pages/LandingPage.tsx`](../../MOBILE UI/app/pages/LandingPage.tsx),
  [`LoginPage.tsx`](../../MOBILE UI/app/pages/LoginPage.tsx),
  [`RegisterPage.tsx`](../../MOBILE UI/app/pages/RegisterPage.tsx) —
  visual reference designs.
