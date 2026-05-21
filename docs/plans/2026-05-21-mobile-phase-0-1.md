# Mobile Parity Phase 0+1 (Foundation + Auth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give mobile devices their own dedicated UI tree under `/mobile/*` with auth flow + dashboards, automatically routed to via User-Agent detection in middleware. Desktop visitors are unaffected.

**Architecture:** Parallel `/mobile/*` route tree mirroring the web routes. A single addition to `middleware.ts` does UA-based 307 redirects in both directions (mobile UA on web URL → mobile URL; desktop UA on mobile URL → web URL). Mobile forms reuse the existing `signInAction` / `registerAction` server actions unchanged — middleware rewrites the post-action redirect on the follow-up hop.

**Tech Stack:** Next.js 14 App Router (TypeScript), React 18.3, `lucide-react` icons, existing Supabase SSR client, no new dependencies.

**Spec reference:** [docs/specs/2026-05-21-mobile-phase-0-1-design.md](../specs/2026-05-21-mobile-phase-0-1-design.md)

---

## Working Directory Convention

All commands run from the repo root `c:\Users\user\Downloads\InternStellar-Hackathon`. The harness's CWD is already this directory. Use relative paths in commands. Quote paths with spaces (e.g., `"MOBILE UI/..."`).

---

## Pre-flight State Confirmation

Before Task 1, confirm starting conditions:

- [ ] **Verify branch & clean state**

Run: `git status --short && git branch --show-current`

Expected:
```
main
```

If status shows tracked-file modifications, stop and surface to the operator. Untracked files are fine (e.g., `body.html` artifacts from earlier smoke tests).

- [ ] **Verify deps are installed**

Run: `ls node_modules/lucide-react/package.json node_modules/recharts/package.json`

Expected: both files print. If "No such file or directory", run `npm install` first.

- [ ] **Verify spec exists**

Run: `ls docs/specs/2026-05-21-mobile-phase-0-1-design.md`

Expected: file prints.

---

## Task 1: UA detection helper + unit test

**Files:**
- Create: `lib/device.ts`
- Create: `scripts/_test-device.ts`
- Modify: `package.json` (add `test:device` script)

- [ ] **Step 1.1: Write the failing test**

Create `scripts/_test-device.ts`:

```ts
import { strict as assert } from "node:assert";

import { isMobileUserAgent } from "../lib/device";

let passed = 0;
let failed = 0;

function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok   ${label}`);
    passed += 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  FAIL ${label}\n       ${message}`);
    failed += 1;
  }
}

console.log("lib/device.isMobileUserAgent");

check("null UA → false", () => {
  assert.equal(isMobileUserAgent(null), false);
});

check("undefined UA → false", () => {
  assert.equal(isMobileUserAgent(undefined), false);
});

check("empty string → false", () => {
  assert.equal(isMobileUserAgent(""), false);
});

check("Chrome desktop → false", () => {
  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  assert.equal(isMobileUserAgent(ua), false);
});

check("Firefox desktop → false", () => {
  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
  assert.equal(isMobileUserAgent(ua), false);
});

check("Safari iPhone → true", () => {
  const ua =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) " +
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
  assert.equal(isMobileUserAgent(ua), true);
});

check("Chrome Android → true", () => {
  const ua =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
  assert.equal(isMobileUserAgent(ua), true);
});

check("iPad Safari → true", () => {
  const ua =
    "Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) " +
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
  assert.equal(isMobileUserAgent(ua), true);
});

check("googlebot-mobile → true", () => {
  const ua =
    "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 " +
    "(compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
  assert.equal(isMobileUserAgent(ua), true);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `npx tsx scripts/_test-device.ts`

Expected: exits non-zero, error mentions `Cannot find module '../lib/device'` or similar import-not-found.

- [ ] **Step 1.3: Implement the helper**

Create `lib/device.ts`:

```ts
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
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `npx tsx scripts/_test-device.ts`

Expected:
```
lib/device.isMobileUserAgent
  ok   null UA → false
  ok   undefined UA → false
  ok   empty string → false
  ok   Chrome desktop → false
  ok   Firefox desktop → false
  ok   Safari iPhone → true
  ok   Chrome Android → true
  ok   iPad Safari → true
  ok   googlebot-mobile → true

9 passed, 0 failed
```

- [ ] **Step 1.5: Add the npm script**

Modify `package.json`. Find the `scripts` block and add `test:device` alphabetically beside the other `test:*` entries:

```json
    "test:device": "npx tsx scripts/_test-device.ts",
```

The full `scripts` block should look like:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "fund-test-account": "npx tsx scripts/fund-test-account.ts",
    "verify-stellar": "npx tsx scripts/verify-stellar-connection.ts",
    "test:device": "npx tsx scripts/_test-device.ts",
    "test:stellar-lib": "npx tsx scripts/_test-stellar-lib.ts",
    "test:escrow-wiring": "npx tsx scripts/_test-escrow-wiring.ts",
    "test:no-leaks": "npx tsx scripts/_test-no-stacktrace-leak.ts",
    "reset": "npx tsx scripts/reset-demo.ts",
    "reset:db-only": "npx tsx scripts/reset-demo.ts --db-only",
    "setup-billers": "npx tsx scripts/setup-billers.ts"
  },
```

Verify with: `npm run test:device`

Expected: same 9/0 output as Step 1.4.

- [ ] **Step 1.6: Commit**

Run: `git add lib/device.ts scripts/_test-device.ts package.json`

Then: 
```
git commit -m "feat(mobile): add UA-detection helper for middleware

isMobileUserAgent() classifies a User-Agent string as mobile (true) or
desktop (false). Powers the upcoming middleware redirect between the
web tree and the parallel /mobile tree.

Spec: docs/specs/2026-05-21-mobile-phase-0-1-design.md §5.1"
```

---

## Task 2: Middleware UA redirect

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 2.1: Replace middleware body**

Replace the entire contents of `middleware.ts` with:

```ts
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
```

- [ ] **Step 2.2: Start dev server in background**

Run (background): `npm run dev`

Wait 6 seconds for "Ready" line in output.

- [ ] **Step 2.3: Smoke test — desktop UA on /login stays on /login**

Run:
```
curl -s -o /dev/null -w "HTTP %{http_code} %{redirect_url}\n" -A "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36" http://localhost:3000/login
```

Expected: `HTTP 200` (no redirect_url).

- [ ] **Step 2.4: Smoke test — mobile UA on /login redirects to /mobile/login**

Run:
```
curl -s -o /dev/null -w "HTTP %{http_code} %{redirect_url}\n" -A "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1" http://localhost:3000/login
```

Expected: `HTTP 307 http://localhost:3000/mobile/login`.

- [ ] **Step 2.5: Smoke test — mobile UA on / redirects to /mobile**

Run:
```
curl -s -o /dev/null -w "HTTP %{http_code} %{redirect_url}\n" -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/
```

Expected: `HTTP 307 http://localhost:3000/mobile`.

- [ ] **Step 2.6: Smoke test — desktop UA on /mobile/login redirects to /login**

Run:
```
curl -s -o /dev/null -w "HTTP %{http_code} %{redirect_url}\n" -A "Mozilla/5.0 (Windows NT 10.0)" http://localhost:3000/mobile/login
```

Expected: `HTTP 307 http://localhost:3000/login`.

- [ ] **Step 2.7: Smoke test — desktop UA on /mobile redirects to /**

Run:
```
curl -s -o /dev/null -w "HTTP %{http_code} %{redirect_url}\n" -A "Mozilla/5.0 (Windows NT 10.0)" http://localhost:3000/mobile
```

Expected: `HTTP 307 http://localhost:3000/`.

- [ ] **Step 2.8: Smoke test — query string preserved**

Run:
```
curl -s -o /dev/null -w "HTTP %{http_code} %{redirect_url}\n" -A "Mozilla/5.0 (iPhone) Mobile" "http://localhost:3000/login?registered=1"
```

Expected: `HTTP 307 http://localhost:3000/mobile/login?registered=1`.

- [ ] **Step 2.9: Smoke test — /api/health bypasses middleware**

Run:
```
curl -s -o /dev/null -w "HTTP %{http_code}\n" -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/api/health
```

Expected: `HTTP 200` (no redirect). The mobile UA must NOT be redirected for API calls.

- [ ] **Step 2.10: Stop dev server**

Run (PowerShell): `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 2.11: Commit**

Run: `git add middleware.ts`

Then:
```
git commit -m "feat(mobile): UA-based redirect between web and /mobile in middleware

Mobile UA hitting a web URL → 307 to /mobile<path>. Desktop UA hitting
/mobile<path> → 307 back to the web URL. Query string preserved.
/api/* and /auth/confirm excluded from the matcher.

Spec: docs/specs/2026-05-21-mobile-phase-0-1-design.md §4.2, §5.3"
```

---

## Task 3: Refactor /mobile root to landing-only

**Files:**
- Modify: `app/mobile/page.tsx` (drop auth check, drop phone-frame wrapper, drop dashboard routing — just render MobileLanding)
- Modify: `app/mobile/MobileLanding.tsx` (update link targets to /mobile/login + /mobile/register)

The existing `app/mobile/page.tsx` does too much: it inspects auth state, splits into OFW/family/store branches, loads dashboard data, and wraps everything in a phone-frame. After this task, the dashboards live at `/mobile/ofw` and `/mobile/family` (Task 4) and the phone-frame is gone (per spec §2).

- [ ] **Step 3.1: Replace `app/mobile/page.tsx`**

Replace the entire contents of `app/mobile/page.tsx` with:

```tsx
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
```

- [ ] **Step 3.2: Update `MobileLanding` link targets**

In `app/mobile/MobileLanding.tsx`, change the two `<Link>` `href` values:

Find:
```tsx
        <Link
          href="/login"
          className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] hover:from-[#4a6bef] hover:to-[#6b89ef] text-white rounded-full py-5 text-base font-semibold shadow-lg shadow-[#5b7cff]/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          Get Started
          <ArrowRight className="w-5 h-5" />
        </Link>

        <Link
          href="/register"
          className="w-full mt-3 text-center text-sm font-semibold text-[#5b7cff] py-3"
        >
          Create an account
        </Link>
```

Replace with:
```tsx
        <Link
          href="/mobile/login"
          className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] hover:from-[#4a6bef] hover:to-[#6b89ef] text-white rounded-full py-5 text-base font-semibold shadow-lg shadow-[#5b7cff]/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          Get Started
          <ArrowRight className="w-5 h-5" />
        </Link>

        <Link
          href="/mobile/register"
          className="w-full mt-3 text-center text-sm font-semibold text-[#5b7cff] py-3"
        >
          Create an account
        </Link>
```

- [ ] **Step 3.3: Smoke test the landing**

Start dev server (background): `npm run dev`

Wait 6 seconds.

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile | grep -oE 'Bridge made|Get Started|mobile/login|mobile/register'
```

Expected: all 4 markers appear.

- [ ] **Step 3.4: Stop dev server**

Run (PowerShell): `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 3.5: Commit**

Run: `git add app/mobile/page.tsx app/mobile/MobileLanding.tsx`

Then:
```
git commit -m "refactor(mobile): /mobile is landing-only; dashboards move out

Strip auth check, role branching, dashboard data loading, and the
phone-frame wrapper from /mobile/page.tsx. The page now only renders
MobileLanding. Landing CTAs point at /mobile/login and /mobile/register
directly. OFW/family dashboards relocate in Task 4.

Spec: docs/specs/2026-05-21-mobile-phase-0-1-design.md §5.4"
```

---

## Task 4: Create /mobile/ofw, /mobile/family, /mobile/store

**Files:**
- Create: `app/mobile/ofw/page.tsx`
- Create: `app/mobile/family/page.tsx`
- Create: `app/mobile/store/page.tsx`

Lifts the OFW/Family branches of the old `/mobile` page into their own routes (one role per page, no phone-frame wrapper). Adds a placeholder for store role.

- [ ] **Step 4.1: Create `app/mobile/ofw/page.tsx`**

```tsx
import { redirect } from "next/navigation";

import { loadUserProfile } from "@/lib/auth-role";
import { loadOfwDashboard } from "@/lib/dashboard/ofw";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { MobileDashboardClient } from "../MobileDashboardClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Mobile OFW dashboard. Mirrors the web /ofw route. signInAction
 * redirects an OFW caller to /ofw on success — middleware rewrites
 * that to /mobile/ofw for mobile UAs, which lands here.
 */
export default async function MobileOfwPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await loadUserProfile(user.id);
  if (profile?.role !== "ofw") {
    redirect("/");
  }

  const admin = getSupabaseAdmin();
  const { data: linkedFamily } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "family")
    .eq("sponsor_ofw_id", user.id)
    .maybeSingle();

  const familyId = linkedFamily?.id ?? null;
  const ofwData = await loadOfwDashboard({ ofwId: user.id, familyId });
  const familyData = familyId
    ? await (await import("@/lib/dashboard/family")).loadFamilyDashboard({ familyId })
    : null;

  return (
    <MobileDashboardClient
      ofwData={ofwData}
      familyData={familyData}
      currentUserRole="ofw"
      currentUserId={user.id}
    />
  );
}
```

- [ ] **Step 4.2: Create `app/mobile/family/page.tsx`**

```tsx
import { redirect } from "next/navigation";

import { loadUserProfile } from "@/lib/auth-role";
import { loadFamilyDashboard } from "@/lib/dashboard/family";
import { loadOfwDashboard } from "@/lib/dashboard/ofw";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { MobileDashboardClient } from "../MobileDashboardClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Mobile Family dashboard. Mirrors the web /family route. signInAction
 * redirects a family caller to /family on success → middleware rewrites
 * to /mobile/family for mobile UAs.
 */
export default async function MobileFamilyPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await loadUserProfile(user.id);
  if (profile?.role !== "family") {
    redirect("/");
  }

  const admin = getSupabaseAdmin();
  const { data: familyProfile } = await admin
    .from("profiles")
    .select("sponsor_ofw_id")
    .eq("id", user.id)
    .single();

  const ofwId = familyProfile?.sponsor_ofw_id ?? null;
  const familyData = await loadFamilyDashboard({ familyId: user.id });
  const ofwData = ofwId
    ? await loadOfwDashboard({ ofwId, familyId: user.id })
    : null;

  return (
    <MobileDashboardClient
      ofwData={ofwData}
      familyData={familyData}
      currentUserRole="family"
      currentUserId={user.id}
    />
  );
}
```

- [ ] **Step 4.3: Create `app/mobile/store/page.tsx`**

```tsx
import Link from "next/link";
import { Construction, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Phase-4 placeholder for the mobile store dashboard. signInAction
 * redirects a store caller to /store on success → middleware rewrites
 * to /mobile/store for mobile UAs — so a store user logging in on a
 * phone lands here. Until Phase 4 ships, point them at the desktop
 * site for the real dashboard.
 */
export default function MobileStorePage() {
  return (
    <div className="min-h-screen bg-[#f5f7fa] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-6">
        <Construction className="w-8 h-8 text-amber-600" />
      </div>
      <h1 className="text-2xl font-extrabold text-[#1a1d2e] mb-3">
        Store dashboard — coming soon
      </h1>
      <p className="text-[#6b7280] mb-8 max-w-sm leading-relaxed">
        The mobile store experience is still in build. For now, please use
        the desktop site to manage orders, inventory, and deliveries.
      </p>
      <Link
        href="/store"
        className="inline-flex items-center gap-2 bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white font-semibold rounded-full px-6 py-3 shadow-lg shadow-[#5b7cff]/25 active:scale-[0.98] transition-transform"
      >
        Open desktop store
        <ExternalLink className="w-4 h-4" />
      </Link>
    </div>
  );
}
```

> Note: this `<Link href="/store">` will be caught by the middleware
> when the user taps it on mobile (mobile UA → redirected back to
> `/mobile/store` → infinite loop). For Phase 0+1, the placeholder is
> documentation more than a working escape hatch. Phase 4 replaces it
> with the real dashboard. If you want the link to actually escape to
> desktop, the user must open the site in their phone browser's
> "Request Desktop Site" mode.

- [ ] **Step 4.4: Smoke test — dev server compiles all three**

Start dev server (background): `npm run dev`

Wait 6 seconds.

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "ofw %{http_code}\n" http://localhost:3000/mobile/ofw
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "family %{http_code}\n" http://localhost:3000/mobile/family
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "store %{http_code}\n" http://localhost:3000/mobile/store
```

Expected:
```
ofw 307
family 307
store 200
```

(ofw + family 307 because they `redirect("/login")` when logged-out — that's the auth gate working. Store returns 200 since the placeholder has no auth.)

- [ ] **Step 4.5: Check dev log for compile errors**

Read the dev server output file printed when you launched it.

Expected: lines like `✓ Compiled /mobile/ofw in ...` and `✓ Compiled /mobile/family in ...`. No `Module not found` or `Type error`.

- [ ] **Step 4.6: Stop dev server**

Run (PowerShell): `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 4.7: Commit**

Run: `git add app/mobile/ofw/ app/mobile/family/ app/mobile/store/`

Then:
```
git commit -m "feat(mobile): /mobile/ofw, /mobile/family dashboards + /mobile/store placeholder

Splits the role branches out of the old /mobile page into per-role
routes. Each loads its own dashboard via the existing loaders and
renders MobileDashboardClient. Store role gets a 'coming soon'
placeholder until Phase 4.

Spec: docs/specs/2026-05-21-mobile-phase-0-1-design.md §5.4"
```

---

## Task 5: Extract DEMO_ACCOUNTS constant

**Files:**
- Create: `app/auth/demo-accounts.ts`
- Modify: `app/(auth)/login/LoginForm.tsx` (import from the new module)

DRY: the existing web `LoginForm.tsx` has a hard-coded `DEMO_ACCOUNTS` constant. The mobile login form (Task 6) needs the same list. Extract before duplicating.

- [ ] **Step 5.1: Create `app/auth/demo-accounts.ts`**

```ts
/**
 * Shared list of demo accounts surfaced as quick-fill chips on both the
 * web login form (`app/(auth)/login/LoginForm.tsx`) and the mobile login
 * form (`app/mobile/login/MobileLoginForm.tsx`). Single source of truth
 * so the two forms can't drift.
 *
 * These accounts are seeded by `db/seed.sql` with fixed UUIDs — see
 * CLAUDE.md "Demo seed data" for the IDs and how to recreate them.
 */
export const DEMO_ACCOUNTS = [
  {
    label: "Auntie Maria",
    role: "OFW",
    email: "maria.ofw@internstellar.demo",
    password: "demo123456",
  },
  {
    label: "Lola Cora",
    role: "Family",
    email: "cora.family@internstellar.demo",
    password: "demo123456",
  },
  {
    label: "Aling Nena",
    role: "Store",
    email: "nena.store@internstellar.demo",
    password: "demo123456",
  },
] as const;

export type DemoAccount = (typeof DEMO_ACCOUNTS)[number];
```

- [ ] **Step 5.2: Update `app/(auth)/login/LoginForm.tsx` to import**

Find the inline `DEMO_ACCOUNTS` constant (lines 26–45 in the current file):

```ts
const DEMO_ACCOUNTS = [
  {
    label: "Auntie Maria",
    role: "OFW",
    email: "maria.ofw@internstellar.demo",
    password: "demo123456",
  },
  {
    label: "Lola Cora",
    role: "Family",
    email: "cora.family@internstellar.demo",
    password: "demo123456",
  },
  {
    label: "Aling Nena",
    role: "Store",
    email: "nena.store@internstellar.demo",
    password: "demo123456",
  },
] as const;
```

Delete that block entirely. Then add this import at the top alongside the other imports (after the `signInAction` import):

```ts
import { DEMO_ACCOUNTS } from "@/app/auth/demo-accounts";
```

- [ ] **Step 5.3: Smoke test the web login still renders**

Start dev server (background): `npm run dev`

Wait 6 seconds.

Run:
```
curl -s -A "Mozilla/5.0 (Windows NT 10.0)" http://localhost:3000/login | grep -oE 'Auntie Maria|Lola Cora|Aling Nena'
```

Expected: all three names appear.

- [ ] **Step 5.4: Stop dev server**

Run (PowerShell): `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 5.5: Commit**

Run: `git add app/auth/demo-accounts.ts "app/(auth)/login/LoginForm.tsx"`

Then:
```
git commit -m "refactor(auth): extract DEMO_ACCOUNTS to app/auth/demo-accounts.ts

Web LoginForm imports the shared constant. Mobile LoginForm (next
commit) will import from the same module — single source of truth.

Spec: docs/specs/2026-05-21-mobile-phase-0-1-design.md §6.1"
```

---

## Task 6: Mobile login page + form

**Files:**
- Create: `app/mobile/login/page.tsx`
- Create: `app/mobile/login/MobileLoginForm.tsx`

- [ ] **Step 6.1: Create `app/mobile/login/MobileLoginForm.tsx`**

```tsx
"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { signInAction, type SignInResult } from "@/app/auth/actions";
import { DEMO_ACCOUNTS } from "@/app/auth/demo-accounts";

/**
 * Mobile-styled sign-in form. Calls the same signInAction the web
 * LoginForm uses — only the shell visuals change. Demo-account chips
 * pre-fill the inputs via refs and submit via `form.requestSubmit()`,
 * so the server action path is identical to a hand-typed submit.
 *
 * The action redirects to /ofw, /family, or /store on success; the
 * middleware rewrites those to /mobile/* on the follow-up hop because
 * we're on a mobile UA.
 */
export function MobileLoginForm() {
  const [state, formAction] = useFormState<SignInResult | null, FormData>(
    signInAction,
    null,
  );

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function fillAndSubmit(email: string, password: string) {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = password;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Email
        </label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          className="w-full bg-[#f5f7fa] border-0 rounded-2xl h-12 text-sm px-4 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Password
        </label>
        <input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          className="w-full bg-[#f5f7fa] border-0 rounded-2xl h-12 text-sm px-4 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
      </div>

      {state?.error ? (
        <div
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {state.error}
        </div>
      ) : null}

      <SubmitButton />

      <div className="pt-6 border-t border-black/5">
        <p className="text-center text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-4">
          Or try a demo account
        </p>
        <div className="grid grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <DemoChip
              key={acc.email}
              label={acc.label}
              role={acc.role}
              onClick={() => fillAndSubmit(acc.email, acc.password)}
            />
          ))}
        </div>
        <p className="text-[10px] text-center text-[#9ca3af] mt-3">
          Password for all demo accounts:{" "}
          <span className="font-mono">demo123456</span>
        </p>
      </div>

      <p className="text-center text-xs text-[#6b7280] pt-2">
        New here?{" "}
        <Link
          href="/mobile/register"
          className="text-[#5b7cff] font-semibold hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] hover:from-[#4a6bef] hover:to-[#6b89ef] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
      {pending ? null : <ArrowRight className="w-4 h-4" />}
    </button>
  );
}

function DemoChip({
  label,
  role,
  onClick,
}: {
  label: string;
  role: string;
  onClick: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="p-3 bg-[#f5f7fa] hover:bg-slate-100 rounded-2xl transition-all text-center disabled:opacity-50"
    >
      <p className="text-[9px] text-[#6b7280] uppercase tracking-wider font-bold mb-1.5">
        {role}
      </p>
      <p className="text-[11px] font-semibold text-[#1a1d2e]">{label}</p>
    </button>
  );
}
```

- [ ] **Step 6.2: Create `app/mobile/login/page.tsx`**

```tsx
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";

import { MobileLoginForm } from "./MobileLoginForm";

export const dynamic = "force-dynamic";

/**
 * Mobile sign-in page. Like the web /login (app/(auth)/login/page.tsx)
 * we do NOT auto-redirect signed-in users away — the page is reachable
 * mid-session, useful for switching demo accounts.
 *
 * `?registered=1` shows the "check your email" banner after a
 * successful sign-up that requires email confirmation.
 */
export default function MobileLoginPage({
  searchParams,
}: {
  searchParams?: { registered?: string };
}) {
  const justRegistered = searchParams?.registered === "1";

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#1a1d2e] font-sans px-5 py-6 flex flex-col">
      <Link
        href="/mobile"
        className="inline-flex items-center gap-2 text-sm text-[#6b7280] mb-6 -ml-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-black/5">
          <div className="mb-6">
            <h2 className="text-lg font-extrabold tracking-tight">InternStellar</h2>
            <p className="text-[11px] text-[#6b7280] -mt-0.5">Chain Bridge</p>
          </div>

          <h1 className="text-2xl font-extrabold mb-1.5">Welcome back.</h1>
          <p className="text-sm text-[#6b7280] mb-6">
            Sign in to your InternStellar account.
          </p>

          {justRegistered ? (
            <div
              role="status"
              className="mb-6 flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <span className="font-semibold">Account created.</span>{" "}
                <span className="text-emerald-700">
                  Check your email for a confirmation link, then sign in below.
                </span>
              </span>
            </div>
          ) : null}

          <MobileLoginForm />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6.3: Smoke test — page renders + form posts**

Start dev server (background): `npm run dev`

Wait 6 seconds.

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile/login | grep -oE 'Welcome back|Sign in|Auntie Maria|mobile/register'
```

Expected: all 4 markers appear.

Run the `?registered=1` variant:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" "http://localhost:3000/mobile/login?registered=1" | grep -oE 'Account created|check your email|Check your email'
```

Expected: "Account created" and "Check your email" both appear.

- [ ] **Step 6.4: Stop dev server**

Run (PowerShell): `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 6.5: Commit**

Run: `git add app/mobile/login/`

Then:
```
git commit -m "feat(mobile): add /mobile/login page + form

Mobile-styled login (full-bleed card on #f5f7fa). Reuses signInAction
unchanged; middleware rewrites the post-action redirect from /ofw or
/family to /mobile/ofw or /mobile/family on the follow-up hop. Demo
quick-fill chips pull from app/auth/demo-accounts.

Spec: docs/specs/2026-05-21-mobile-phase-0-1-design.md §6.1"
```

---

## Task 7: Mobile register page + form

**Files:**
- Create: `app/mobile/register/page.tsx`
- Create: `app/mobile/register/MobileRegisterForm.tsx`

- [ ] **Step 7.1: Create `app/mobile/register/MobileRegisterForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { registerAction, type RegisterResult } from "@/app/auth/actions";

/**
 * Mobile sign-up form. Three text fields + a role picker styled as a
 * 3-up tappable pill grid. Calls the same registerAction the web
 * RegisterForm uses; on success the action redirects either to
 * dashboardForRole(role) (auto-confirm projects) or
 * /login?registered=1 (email-confirm projects). The middleware
 * rewrites both to /mobile/* on the follow-up hop.
 */
const ROLE_OPTIONS = [
  { value: "ofw", label: "OFW", hint: "Sponsor a family" },
  { value: "family", label: "Family", hint: "Receive support" },
  { value: "store", label: "Store", hint: "Fulfill orders" },
] as const;

type RoleValue = (typeof ROLE_OPTIONS)[number]["value"];

export function MobileRegisterForm() {
  const [state, formAction] = useFormState<RegisterResult | null, FormData>(
    registerAction,
    null,
  );
  const [role, setRole] = useState<RoleValue>("ofw");

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="display_name"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Display name
        </label>
        <input
          id="display_name"
          name="display_name"
          autoComplete="name"
          placeholder="Auntie Maria"
          required
          className="w-full bg-[#f5f7fa] border-0 rounded-2xl h-12 text-sm px-4 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          className="w-full bg-[#f5f7fa] border-0 rounded-2xl h-12 text-sm px-4 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          minLength={6}
          required
          className="w-full bg-[#f5f7fa] border-0 rounded-2xl h-12 text-sm px-4 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
        <p className="text-[10px] text-[#9ca3af] mt-1.5 px-1">
          At least 6 characters
        </p>
      </div>

      <fieldset>
        <legend className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-2.5">
          I am a…
        </legend>
        <input type="hidden" name="role" value={role} />
        <div className="grid grid-cols-3 gap-2">
          {ROLE_OPTIONS.map((opt) => {
            const selected = role === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                aria-pressed={selected}
                className={
                  selected
                    ? "flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] text-white shadow-lg shadow-[#5b7cff]/25"
                    : "flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center bg-[#f5f7fa] text-[#1a1d2e] hover:bg-slate-100"
                }
              >
                <span className="text-sm font-bold">{opt.label}</span>
                <span
                  className={
                    selected
                      ? "text-[9px] uppercase tracking-wider text-white/80"
                      : "text-[9px] uppercase tracking-wider text-[#6b7280]"
                  }
                >
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {state?.error ? (
        <div
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {state.error}
        </div>
      ) : null}

      <SubmitButton />

      <p className="text-center text-xs text-[#6b7280] pt-2">
        Already have an account?{" "}
        <Link
          href="/mobile/login"
          className="text-[#5b7cff] font-semibold hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] hover:from-[#4a6bef] hover:to-[#6b89ef] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
    >
      {pending ? "Creating account…" : "Create account"}
      {pending ? null : <ArrowRight className="w-4 h-4" />}
    </button>
  );
}
```

- [ ] **Step 7.2: Create `app/mobile/register/page.tsx`**

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MobileRegisterForm } from "./MobileRegisterForm";

export const dynamic = "force-dynamic";

/**
 * Mobile sign-up page. Like the web /register, we don't auto-redirect
 * signed-in users — keeps the page reachable for creating additional
 * demo accounts within one session.
 */
export default function MobileRegisterPage() {
  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#1a1d2e] font-sans px-5 py-6 flex flex-col">
      <Link
        href="/mobile"
        className="inline-flex items-center gap-2 text-sm text-[#6b7280] mb-6 -ml-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-black/5">
          <div className="mb-6">
            <h2 className="text-lg font-extrabold tracking-tight">InternStellar</h2>
            <p className="text-[11px] text-[#6b7280] -mt-0.5">Chain Bridge</p>
          </div>

          <h1 className="text-2xl font-extrabold mb-1.5">Create your account.</h1>
          <p className="text-sm text-[#6b7280] mb-6">
            A few details so we know which dashboard to set you up with.
          </p>

          <MobileRegisterForm />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7.3: Smoke test — page renders**

Start dev server (background): `npm run dev`

Wait 6 seconds.

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile/register | grep -oE 'Create your account|Display name|I am a|mobile/login|OFW|Family|Store'
```

Expected: all 7 markers appear.

- [ ] **Step 7.4: Stop dev server**

Run (PowerShell): `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 7.5: Commit**

Run: `git add app/mobile/register/`

Then:
```
git commit -m "feat(mobile): add /mobile/register page + form

Mobile-styled sign-up. Three text fields + role picker as 3-up
pressable pills. Reuses registerAction unchanged; middleware rewrites
its post-success redirects to /mobile/* on the follow-up hop.

Spec: docs/specs/2026-05-21-mobile-phase-0-1-design.md §6.2"
```

---

## Task 8: Mobile auth/confirmed page

**Files:**
- Create: `app/mobile/auth/confirmed/page.tsx`

- [ ] **Step 8.1: Create `app/mobile/auth/confirmed/page.tsx`**

```tsx
import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";

import { dashboardForRole } from "@/app/auth/role-routes";
import { loadUserProfile } from "@/lib/auth-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Mobile post-email-confirmation landing. Mirrors the web
 * app/auth/confirmed/page.tsx with mobile visuals. /auth/confirm
 * (the token-exchange route) is excluded from the middleware (see
 * spec §8.1) and always redirects to /auth/confirmed; that follow-up
 * gets caught by middleware and rewritten to /mobile/auth/confirmed
 * for mobile UAs, landing here.
 *
 * Two arrival paths:
 *   1. Token exchanged successfully (session cookies set) → show
 *      success copy + Go to dashboard CTA, role-routed.
 *   2. Token failed (?error=...) → show error inline + Sign in CTA.
 */
export default async function MobileConfirmedPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const error = searchParams?.error;

  if (error) {
    return <ErrorView error={error} />;
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let dashboardHref = "/mobile/login";
  let displayName: string | null = null;
  if (user) {
    const { profile } = await loadUserProfile(user.id);
    if (profile) {
      // dashboardForRole returns /ofw|/family|/store; middleware rewrites
      // to /mobile/* on the follow-up hop. We could prefix here too, but
      // letting middleware do it keeps the helper as the single source of
      // truth for role → dashboard mapping.
      dashboardHref = dashboardForRole(profile.role);
      displayName = profile.display_name || null;
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#1a1d2e] font-sans px-5 py-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-black/5 text-center">
          <div className="mb-6 text-left">
            <h2 className="text-lg font-extrabold tracking-tight">InternStellar</h2>
            <p className="text-[11px] text-[#6b7280] -mt-0.5">Chain Bridge</p>
          </div>

          <div className="inline-flex w-16 h-16 rounded-2xl bg-emerald-100 items-center justify-center mb-5">
            <CheckCircle className="w-8 h-8 text-emerald-600" strokeWidth={2.5} />
          </div>

          <h1 className="text-2xl font-extrabold mb-2">Email confirmed.</h1>
          <p className="text-sm text-[#6b7280] mb-7 leading-relaxed">
            {displayName ? (
              <>
                You&apos;re all set,{" "}
                <span className="text-[#1a1d2e] font-semibold">{displayName}</span>.
                Your account is live and ready to use.
              </>
            ) : (
              <>Your account is now active. Sign in to get started.</>
            )}
          </p>

          <Link
            href={dashboardHref}
            className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {user ? "Go to your dashboard" : "Sign in"}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorView({ error }: { error: string }) {
  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#1a1d2e] font-sans px-5 py-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-black/5">
          <div className="mb-6">
            <h2 className="text-lg font-extrabold tracking-tight">InternStellar</h2>
            <p className="text-[11px] text-[#6b7280] -mt-0.5">Chain Bridge</p>
          </div>

          <h1 className="text-2xl font-extrabold mb-2">Confirmation failed.</h1>
          <p className="text-sm text-[#6b7280] mb-5 leading-relaxed">
            We couldn&apos;t confirm your email with that link. It may have
            already been used or expired.
          </p>

          <div
            role="alert"
            className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 mb-6"
          >
            {decodeURIComponent(error)}
          </div>

          <div className="space-y-3">
            <Link
              href="/mobile/login"
              className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 flex items-center justify-center gap-2"
            >
              Try signing in
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/mobile/register"
              className="w-full text-center text-sm font-semibold text-[#5b7cff] py-3 block"
            >
              Start over
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8.2: Smoke test — page renders both states**

Start dev server (background): `npm run dev`

Wait 6 seconds.

Success path (logged out):
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile/auth/confirmed | grep -oE 'Email confirmed|Sign in|mobile/login'
```

Expected: all 3 markers appear.

Error path:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" "http://localhost:3000/mobile/auth/confirmed?error=Token%20expired" | grep -oE 'Confirmation failed|Token expired|Start over'
```

Expected: all 3 markers appear.

- [ ] **Step 8.3: Stop dev server**

Run (PowerShell): `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 8.4: Commit**

Run: `git add app/mobile/auth/`

Then:
```
git commit -m "feat(mobile): add /mobile/auth/confirmed post-email landing

Success + error states, mirrors app/auth/confirmed with mobile visuals.
/auth/confirm route handler is already excluded from middleware (Task
2); it redirects to /auth/confirmed which middleware rewrites here for
mobile UAs.

Spec: docs/specs/2026-05-21-mobile-phase-0-1-design.md §6.3"
```

---

## Task 9: End-to-end smoke test

No code changes. Walks the §9 checklist from the spec to confirm everything composes.

- [ ] **Step 9.1: Start dev server**

Run (background): `npm run dev`

Wait until "Ready" appears in the output (~6 seconds).

- [ ] **Step 9.2: Verify the redirect chain — mobile UA → /mobile**

```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -L -o /dev/null -w "%{url_effective}\n" http://localhost:3000/
```

Expected: `http://localhost:3000/mobile`.

- [ ] **Step 9.3: Verify the mobile landing**

```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile | grep -oE 'Bridge made|Get Started|/mobile/login|/mobile/register'
```

Expected: all 4 markers.

- [ ] **Step 9.4: Verify the mobile login page**

```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile/login | grep -oE 'Welcome back|Auntie Maria|Lola Cora|Aling Nena|Create an account'
```

Expected: all 5 markers.

- [ ] **Step 9.5: Verify the mobile register page**

```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile/register | grep -oE 'Create your account|Display name|I am a|mobile/login'
```

Expected: all 4 markers.

- [ ] **Step 9.6: Verify desktop is unchanged**

```
curl -s -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120" -o /dev/null -w "/ %{http_code}\n" http://localhost:3000/
curl -s -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120" -o /dev/null -w "/login %{http_code}\n" http://localhost:3000/login
curl -s -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120" -o /dev/null -w "/register %{http_code}\n" http://localhost:3000/register
```

Expected: all three return 200.

- [ ] **Step 9.7: Verify desktop UA on mobile URL bounces back**

```
curl -s -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120" -L -o /dev/null -w "%{url_effective}\n" http://localhost:3000/mobile/login
```

Expected: `http://localhost:3000/login`.

- [ ] **Step 9.8: Re-run the device unit test**

```
npm run test:device
```

Expected: `9 passed, 0 failed`.

- [ ] **Step 9.9: Inspect dev log for compile errors**

Read the dev server output file.

Expected: every route used in steps 9.2–9.7 has a `✓ Compiled ...` line. No `Module not found` or `Type error` messages.

- [ ] **Step 9.10: Stop dev server**

Run (PowerShell): `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 9.11: Final commit (housekeeping — only if any artifacts need it)**

If smoke testing produced `body.html` or similar throwaway files, remove them now:

Run: `git status --short`

If there are untracked HTML/curl-artifact files in the repo root, delete them and re-check `git status` — there should be no tracked changes pending.

If the dev server's `.next/` cache produced changes that ended up in `git status`, **do not commit them.** `.next/` is gitignored; if your `.gitignore` shows otherwise, fix that and commit the .gitignore change instead.

- [ ] **Step 9.12: Manual browser walk-through (recommended)**

Open Chrome DevTools, toggle "Toggle device toolbar", select iPhone 14 Pro, hard refresh `http://localhost:3000/`. Confirm visually:

- Lands on `/mobile` with the mobile landing.
- Tap "Get Started" → `/mobile/login`, mobile shell, demo chips visible.
- Tap "Auntie Maria" chip → submits, network tab shows the `signInAction` POST followed by 307 to `/ofw` then 307 to `/mobile/ofw`. OFW dashboard renders.
- Tap "Send" tab → MobileSendFunds renders.
- Log out from the dashboard header → URL becomes `/mobile/login`.
- Tap "Create an account" → `/mobile/register`. Fill the form with role=Family; either lands on `/mobile/family` (auto-confirm) or `/mobile/login?registered=1` with the green banner.
- Toggle DevTools device toolbar OFF (desktop UA), reload `/mobile/login` → URL becomes `/login`, web view renders.

This step is the demo-readiness check; capture any issues as a follow-up before moving to Phase 2.

---

## Done

All 9 tasks complete. The repo now has:

- A UA-detection helper with passing unit test.
- Middleware that redirects mobile/desktop between web and `/mobile` trees.
- A mobile auth flow (landing → login → register → email-confirm landing) that reuses the existing server actions.
- Mobile OFW and family dashboards under `/mobile/ofw` and `/mobile/family`.
- A store-role placeholder under `/mobile/store` awaiting Phase 4.

Next: Phase 2 (mobile OFW sub-flows) — gets its own spec + plan via a new brainstorming cycle.
