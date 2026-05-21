# Mobile Parity Phase 5 (Settings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mobile equivalent of every page under `/settings/*` on the web — 8 routes under `/mobile/settings/*` (hub + 7 sub-pages) plus the dashboard menu entry points — so a mobile user can manage their account, see help/legal content, toggle dark mode, and submit a bug report without leaving the mobile tree.

**Architecture:** New parallel route tree at `app/mobile/settings/*` mirroring `app/settings/*`. Reuses existing server actions (`signOutAction`, `setThemeAction`) unchanged. New shared `MobileSettingsShell` component (mobile equivalent of the web's `SettingsPageShell`). New `MobileBugReportForm` client component mirroring the existing `BugReportForm` mailto-link logic with mobile visuals. No new server actions, no new API routes, no changes to the web tree.

**Tech Stack:** Next.js 14 App Router (TypeScript), React 18.3, `lucide-react` icons, existing Supabase SSR client, existing theme cookie module, no new dependencies.

**Spec reference:** [docs/specs/2026-05-22-mobile-phase-5-design.md](../specs/2026-05-21-mobile-phase-5-design.md) (note: spec file is dated 2026-05-21 from when brainstorming started).

---

## Working Directory Convention

All commands run from the repo root `c:\Users\user\Downloads\InternStellar-Hackathon`. The harness's CWD is already this directory. Use relative paths. Quote paths with spaces.

---

## Pre-flight State Confirmation

Before Task 1, confirm starting conditions.

- [ ] **Verify branch + expected dirty state**

Run: `git status --short && git branch --show-current`

Expected:
```
 M app/mobile/MobileDashboardClient.tsx
 M app/mobile/MobileLanding.tsx
 M app/mobile/store/page.tsx
main
```

The three modifications are the in-progress entry-point wiring from the prior turn (landing "Log in" rename, dashboard Menu → Link, Store header). Task 1 commits them together with the missing landing-menu link.

If `git status` shows other modifications, surface them to the operator before continuing.

- [ ] **Verify spec exists**

Run: `ls docs/specs/2026-05-21-mobile-phase-5-design.md`

Expected: file prints.

- [ ] **Create feature branch**

Run: `git checkout -b feat/mobile-phase-5`

Expected: `Switched to a new branch 'feat/mobile-phase-5'`. The dirty working tree carries over to the new branch.

- [ ] **Commit the spec + plan baseline**

Spec and plan docs aren't tied to any task. Commit them now so the branch records what we're building before the implementation starts.

Run:
```
git add docs/specs/2026-05-21-mobile-phase-5-design.md docs/plans/2026-05-22-mobile-phase-5.md
git commit -m "$(cat <<'EOF'
docs(mobile): add Phase 5 (settings) spec and implementation plan

Spec: 8 new routes under /mobile/settings/* mirroring web /settings/*.
Plan: 8 tasks, bundles already-staged entry-point wiring into Task 1.

Spec: docs/specs/2026-05-21-mobile-phase-5-design.md
Plan: docs/plans/2026-05-22-mobile-phase-5.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: one commit added with both files. (The first `git add` line is forgiving in case the spec was renamed; the second adds the file under its actual name.)

---

## Task 1: Entry-point wiring (commit pre-staged changes + landing menu link)

**Files:**
- Modify: `app/mobile/MobileLanding.tsx` (the menu icon at line 8-11 — convert from `<button>` to `<Link href="/mobile/settings">`. The "Get Started" → "Log in" change from the prior turn is also in this file but in a different region; both land in the same commit.)
- Already modified (no new edit, just commit): `app/mobile/MobileDashboardClient.tsx`
- Already modified (no new edit, just commit): `app/mobile/store/page.tsx`

- [ ] **Step 1.1: Wire MobileLanding's menu icon to /mobile/settings**

Find this block in `app/mobile/MobileLanding.tsx`:

```tsx
        <button className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-50">
          <Menu className="w-5 h-5" />
        </button>
```

Replace with:

```tsx
        <Link
          href="/mobile/settings"
          aria-label="Open settings"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </Link>
```

`Link` is already imported at the top of the file (`import Link from "next/link"`), so no new import needed.

- [ ] **Step 1.2: Verify entry-point markup**

Run: `grep -n "href=\"/mobile/settings\"" app/mobile/MobileLanding.tsx app/mobile/MobileDashboardClient.tsx app/mobile/store/page.tsx`

Expected: three matches, one in each file.

- [ ] **Step 1.3: Start dev server + smoke check**

Run (background): `npm run dev`

Wait ~7 seconds.

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile | grep -oE 'Log in|aria-label="Open settings"' | sort -u
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile/store | grep -oE 'aria-label="Open settings"|coming soon'
```

Expected:
```
Log in
aria-label="Open settings"
aria-label="Open settings"
coming soon
```

- [ ] **Step 1.4: Stop dev server**

Run (PowerShell): `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 1.5: Commit**

Run:
```
git add app/mobile/MobileLanding.tsx app/mobile/MobileDashboardClient.tsx app/mobile/store/page.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): wire settings entry points + rename landing CTA

- MobileLanding: menu icon top-right → Link to /mobile/settings; CTA
  "Get Started" → "Log in" to match the web landing's verb.
- MobileDashboardClient: menu icon in dashboard header → Link to
  /mobile/settings (covers /mobile/ofw + /mobile/family).
- Store placeholder: add the same brand+menu header as the dashboards
  so store users can reach settings too. Also restructured to use the
  responsive shell (min-h-screen max-w-md mx-auto) matching the rest
  of the mobile tree.

/mobile/settings still 404s — built in Tasks 2-7.

Spec: docs/specs/2026-05-21-mobile-phase-5-design.md §4.1, §8.2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: one commit, three files.

---

## Task 2: Shared `MobileSettingsShell` component

**Files:**
- Create: `app/mobile/settings/MobileSettingsShell.tsx`

The shared wrapper every sub-page uses: back-button bar at top, mobile-styled card with title + description + body.

- [ ] **Step 2.1: Create the shell**

Create `app/mobile/settings/MobileSettingsShell.tsx`:

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Mobile equivalent of components/ui/SettingsPageShell.tsx. Same shape
 * (back link + title + body card) but using the flat-card mobile
 * visual language instead of the web's neumorphic primitives.
 *
 * Sub-pages default to back-to-hub. The hub itself doesn't use this
 * shell — it has its own header that routes back to the user's
 * dashboard.
 */
type Props = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
};

export function MobileSettingsShell({
  title,
  description,
  children,
  backHref = "/mobile/settings",
  backLabel = "Back to settings",
}: Props) {
  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#1a1d2e] font-sans px-5 py-6 flex flex-col">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="inline-flex items-center gap-2 text-sm text-[#6b7280] mb-6 -ml-1 self-start"
      >
        <ArrowLeft className="w-4 h-4" />
        {backLabel}
      </Link>

      <div className="flex-1 max-w-md mx-auto w-full">
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-black/5">
          <div className="mb-6">
            <h2 className="text-lg font-extrabold tracking-tight">InternStellar</h2>
            <p className="text-[11px] text-[#6b7280] -mt-0.5">Settings</p>
          </div>

          <h1 className="text-2xl font-extrabold mb-1.5">{title}</h1>
          {description ? (
            <div className="text-sm text-[#6b7280] mb-6 leading-relaxed">
              {description}
            </div>
          ) : (
            <div className="mb-6" />
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2.2: Verify it parses**

Run (background): `npm run dev`

Wait ~7 seconds.

Read the dev server output file — confirm no TypeScript errors mentioning `MobileSettingsShell`.

Stop the dev server: `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue` (PowerShell).

- [ ] **Step 2.3: Commit**

Run:
```
git add app/mobile/settings/MobileSettingsShell.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add MobileSettingsShell — shared wrapper for /mobile/settings/* sub-pages

Mirrors components/ui/SettingsPageShell.tsx's interface (title,
description, children, backHref, backLabel) with mobile-flat visuals
instead of neumorphic ones.

Spec: docs/specs/2026-05-21-mobile-phase-5-design.md §4.2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `DarkModeRow` client component

**Files:**
- Create: `app/mobile/settings/DarkModeRow.tsx`

Client component used inside the hub. Renders a row with the same visual shape as the link rows but with a toggle pill instead of a chevron. Submits to the existing `setThemeAction` server action.

- [ ] **Step 3.1: Create the row**

Create `app/mobile/settings/DarkModeRow.tsx`:

```tsx
"use client";

import { Moon } from "lucide-react";

import { setThemeAction } from "@/app/theme/actions";
import type { Theme } from "@/lib/theme";

/**
 * Inline dark-mode toggle row for the mobile settings hub. Server-
 * action form (no React state) — the cookie is the source of truth.
 * The toggle visual reflects the current theme; tapping it submits a
 * hidden input with the opposite value.
 *
 * NOTE: per spec §1 + §5.2, this toggles the theme cookie but the
 * mobile UI itself is light-mode-only (hardcoded colors). The hint
 * text under the label discloses this.
 */
export function DarkModeRow({ theme }: { theme: Theme }) {
  const next: Theme = theme === "dark" ? "light" : "dark";
  const isDark = theme === "dark";

  return (
    <form action={setThemeAction} className="block">
      <input type="hidden" name="theme" value={next} />
      <button
        type="submit"
        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-black/5 shadow-sm hover:bg-slate-50 transition-colors text-left"
        aria-label={`Switch to ${next} mode`}
      >
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          <Moon className="w-5 h-5 text-[#1a1d2e]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1a1d2e]">Dark Mode</p>
          <p className="text-[11px] text-[#6b7280] mt-0.5 leading-snug">
            Currently <span className="font-medium">{isDark ? "on" : "off"}</span>{" "}
            — affects desktop pages; mobile UI is light-mode only for now.
          </p>
        </div>
        <span
          aria-hidden
          className={
            isDark
              ? "w-11 h-6 rounded-full bg-[#5b7cff] flex items-center px-0.5 justify-end transition-colors shrink-0"
              : "w-11 h-6 rounded-full bg-slate-300 flex items-center px-0.5 justify-start transition-colors shrink-0"
          }
        >
          <span className="w-5 h-5 bg-white rounded-full shadow-sm transition-transform" />
        </span>
      </button>
    </form>
  );
}
```

- [ ] **Step 3.2: Commit**

Run:
```
git add app/mobile/settings/DarkModeRow.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add DarkModeRow — inline theme toggle for settings hub

Server-action form posts to the existing setThemeAction; the cookie is
the source of truth and `revalidatePath('/', 'layout')` (in
app/theme/actions.ts) re-renders the page with the new value. Visual
toggle pill reflects current state; mobile UI is light-mode-only so
the hint text discloses that the toggle only affects desktop pages.

Spec: docs/specs/2026-05-21-mobile-phase-5-design.md §5.2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Settings hub page (`/mobile/settings`)

**Files:**
- Create: `app/mobile/settings/page.tsx`

Hub with 8 rows (7 link rows + 1 inline DarkModeRow).

- [ ] **Step 4.1: Create the hub**

Create `app/mobile/settings/page.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Bug,
  ChevronRight,
  FileText,
  HelpCircle,
  Lock,
  Mail,
  Shield,
  User,
} from "lucide-react";

import { dashboardForRole } from "@/app/auth/role-routes";
import { loadUserProfile } from "@/lib/auth-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTheme } from "@/lib/theme";

import { DarkModeRow } from "./DarkModeRow";

export const dynamic = "force-dynamic";

/**
 * Settings hub — mobile equivalent of /settings. 7 link rows + 1
 * inline dark-mode toggle row. Back button routes to the user's
 * dashboard (or /mobile for signed-out users).
 *
 * Order matches the web hub deliberately so the spec's "single source
 * of truth for the user-facing row order" comment in app/settings/
 * page.tsx still holds across both surfaces.
 */
export default async function MobileSettingsPage() {
  const theme = getTheme();

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let backHref = "/mobile";
  let backLabel = "Back to home";
  if (user) {
    const { profile } = await loadUserProfile(user.id);
    const webDashboard = dashboardForRole(profile?.role);
    if (webDashboard !== "/") {
      backHref = `/mobile${webDashboard}`;
      backLabel = "Back to dashboard";
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#1a1d2e] font-sans px-5 py-6 flex flex-col">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="inline-flex items-center gap-2 text-sm text-[#6b7280] mb-6 -ml-1 self-start"
      >
        <ArrowLeft className="w-4 h-4" />
        {backLabel}
      </Link>

      <div className="flex-1 max-w-md mx-auto w-full">
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-black/5 mb-4">
          <div className="mb-6">
            <h2 className="text-lg font-extrabold tracking-tight">InternStellar</h2>
            <p className="text-[11px] text-[#6b7280] -mt-0.5">Settings</p>
          </div>

          <h1 className="text-2xl font-extrabold mb-1.5">Settings</h1>
          <p className="text-sm text-[#6b7280]">
            Account preferences, help, and the fine print.
          </p>
        </div>

        <ul className="flex flex-col gap-2">
          <li>
            <SettingsLinkRow
              icon={<User className="w-5 h-5" />}
              label="Account Manager"
              hint="Your profile, role, and sign-out"
              href="/mobile/settings/account"
            />
          </li>
          <li>
            <DarkModeRow theme={theme} />
          </li>
          <li>
            <SettingsLinkRow
              icon={<Mail className="w-5 h-5" />}
              label="Contact Us"
              hint="Get in touch with the team"
              href="/mobile/settings/contact"
            />
          </li>
          <li>
            <SettingsLinkRow
              icon={<Bug className="w-5 h-5" />}
              label="Report a Bug"
              hint="Tell us what broke"
              href="/mobile/settings/report-bug"
            />
          </li>
          <li>
            <SettingsLinkRow
              icon={<HelpCircle className="w-5 h-5" />}
              label="Help & FAQ"
              hint="Common questions and answers"
              href="/mobile/settings/help"
            />
          </li>
          <li>
            <SettingsLinkRow
              icon={<Shield className="w-5 h-5" />}
              label="Privacy Policy"
              hint="What we collect and why"
              href="/mobile/settings/privacy"
            />
          </li>
          <li>
            <SettingsLinkRow
              icon={<FileText className="w-5 h-5" />}
              label="Terms of Service"
              hint="Your agreement with InternStellar"
              href="/mobile/settings/terms"
            />
          </li>
          <li>
            <SettingsLinkRow
              icon={<Lock className="w-5 h-5" />}
              label="Data Privacy"
              hint="Your rights to your data"
              href="/mobile/settings/data-privacy"
            />
          </li>
        </ul>
      </div>
    </div>
  );
}

function SettingsLinkRow({
  icon,
  label,
  hint,
  href,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-black/5 shadow-sm hover:bg-slate-50 transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-[#1a1d2e]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1a1d2e]">{label}</p>
        <p className="text-[11px] text-[#6b7280] mt-0.5 truncate">{hint}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-[#9ca3af] shrink-0" />
    </Link>
  );
}
```

- [ ] **Step 4.2: Smoke test**

Run (background): `npm run dev`

Wait ~8 seconds.

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile/settings | grep -oE 'Settings|Account Manager|Dark Mode|Contact Us|Report a Bug|Help & FAQ|Privacy Policy|Terms of Service|Data Privacy|affects desktop pages' | sort -u
```

Expected: 10 unique markers (Settings, the 8 row labels, the hint substring "affects desktop pages").

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "%{http_code}\n" http://localhost:3000/mobile/settings
```

Expected: `200`.

- [ ] **Step 4.3: Stop dev server + commit**

Run (PowerShell): `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

Run:
```
git add app/mobile/settings/page.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add /mobile/settings hub page

8 rows in web order: Account, Dark Mode (inline toggle), Contact,
Report Bug, Help & FAQ, Privacy, Terms, Data Privacy. Back button
routes to the user's mobile dashboard via dashboardForRole(), or to
/mobile if signed out.

Spec: docs/specs/2026-05-21-mobile-phase-5-design.md §5

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Account sub-page (`/mobile/settings/account`)

**Files:**
- Create: `app/mobile/settings/account/page.tsx`

- [ ] **Step 5.1: Create the page**

Create `app/mobile/settings/account/page.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Lock, User } from "lucide-react";

import { signOutAction } from "@/app/auth/actions";
import { dashboardForRole } from "@/app/auth/role-routes";
import { loadUserProfile } from "@/lib/auth-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { MobileSettingsShell } from "../MobileSettingsShell";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  ofw: "OFW (sponsor)",
  family: "Family (recipient)",
  store: "Store (fulfillment)",
};

/**
 * Mobile equivalent of app/settings/account/page.tsx. Signed-out
 * variant shows a sign-in CTA. Signed-in variant shows profile +
 * sign-out form. Reuses signOutAction unchanged; on success
 * middleware rewrites the /login redirect to /mobile/login.
 */
export default async function MobileAccountPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <MobileSettingsShell
        title="Account Manager"
        description="You're signed out. Sign in to manage your account."
      >
        <Link
          href="/mobile/login"
          className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 flex items-center justify-center gap-2"
        >
          Sign in
          <ArrowRight className="w-4 h-4" />
        </Link>
      </MobileSettingsShell>
    );
  }

  const { profile } = await loadUserProfile(user.id);
  const webDashboard = dashboardForRole(profile?.role);
  const mobileDashboard = webDashboard === "/" ? "/mobile" : `/mobile${webDashboard}`;

  return (
    <MobileSettingsShell
      title="Account Manager"
      description="Your profile details and account actions."
    >
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#f5f7fa] mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] flex items-center justify-center shrink-0">
          <User className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-[#1a1d2e] truncate">
            {profile?.display_name ?? "Unnamed"}
          </p>
          <p className="text-xs text-[#6b7280] truncate">{user.email}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-3 mb-6">
        <Field label="Role" value={ROLE_LABELS[profile?.role ?? ""] ?? "Unknown"} />
        <Field label="Country" value={profile?.country ?? "Not set"} />
        <Field
          label="Account ID"
          value={<span className="font-mono text-[10px] break-all">{user.id}</span>}
        />
        <Field
          label="Email confirmed"
          value={user.email_confirmed_at ? "Yes" : "Pending"}
        />
      </dl>

      <div className="flex flex-col gap-3">
        <Link
          href={mobileDashboard}
          className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 flex items-center justify-center gap-2"
        >
          Go to your dashboard
          <ArrowRight className="w-4 h-4" />
        </Link>

        <div className="grid grid-cols-1 gap-2">
          {/* Change-password and connect-wallet are placeholders that route
              to the dashboard, matching web Account's intentional scope cut. */}
          <Link
            href={mobileDashboard}
            className="w-full bg-[#f5f7fa] text-[#1a1d2e] rounded-2xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            Change password
          </Link>
          <Link
            href={mobileDashboard}
            className="w-full bg-[#f5f7fa] text-[#1a1d2e] rounded-2xl py-3 text-sm font-semibold flex items-center justify-center"
          >
            Manage Stellar wallet
          </Link>
        </div>

        <form action={signOutAction} className="mt-2">
          <button
            type="submit"
            className="w-full text-center text-sm font-semibold text-red-600 py-3 hover:text-red-700"
          >
            Sign out
          </button>
        </form>
      </div>
    </MobileSettingsShell>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="p-3 rounded-2xl bg-[#f5f7fa]">
      <dt className="text-[10px] uppercase tracking-widest text-[#6b7280] font-bold">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[#1a1d2e]">{value}</dd>
    </div>
  );
}
```

- [ ] **Step 5.2: Smoke test (signed-out variant)**

Run (background): `npm run dev`

Wait ~8 seconds.

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile/settings/account | grep -oE 'Account Manager|signed out|mobile/login' | sort -u
```

Expected: 3 markers.

Stop dev: `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue` (PowerShell).

- [ ] **Step 5.3: Commit**

Run:
```
git add app/mobile/settings/account/page.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add /mobile/settings/account page

Profile + sign-out for signed-in users; sign-in CTA for signed-out.
Reuses signOutAction unchanged. Change-password and Stellar-wallet
buttons are placeholders matching the web's intentional hackathon-
scope cut (link to dashboard).

Spec: docs/specs/2026-05-21-mobile-phase-5-design.md §6.1

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Static-content pages (Contact, Help, Privacy, Terms, Data Privacy)

**Files:**
- Create: `app/mobile/settings/contact/page.tsx`
- Create: `app/mobile/settings/help/page.tsx`
- Create: `app/mobile/settings/privacy/page.tsx`
- Create: `app/mobile/settings/terms/page.tsx`
- Create: `app/mobile/settings/data-privacy/page.tsx`

All 5 are pure content. Bundled into one commit.

- [ ] **Step 6.1: Create contact page**

Create `app/mobile/settings/contact/page.tsx`:

```tsx
import { Mail } from "lucide-react";

import { MobileSettingsShell } from "../MobileSettingsShell";

export const dynamic = "force-dynamic";

/**
 * Mirrors app/settings/contact/page.tsx with mobile styling.
 */
export default function MobileContactPage() {
  return (
    <MobileSettingsShell
      title="Contact Us"
      description="Questions about the product, partnerships, or anything that doesn't fit a bug report? Drop us a line."
    >
      <div className="flex items-start gap-4 p-5 rounded-2xl bg-[#f5f7fa]">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] flex items-center justify-center shrink-0">
          <Mail className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-[#1a1d2e]">Email</p>
          <p className="text-xs text-[#6b7280] mt-1 leading-relaxed">
            We aim to reply within two business days. For urgent demo issues,
            mention &quot;demo&quot; in the subject line.
          </p>
          <p className="mt-3 font-mono text-xs text-[#5b7cff] break-all">
            Internstellar.hackathon@gmail.com
          </p>
        </div>
      </div>
    </MobileSettingsShell>
  );
}
```

- [ ] **Step 6.2: Create help page**

Create `app/mobile/settings/help/page.tsx`:

```tsx
import Link from "next/link";

import { MobileSettingsShell } from "../MobileSettingsShell";

export const dynamic = "force-dynamic";

const FAQ = [
  {
    q: "What is InternStellar?",
    a: "A smart remittance escrow platform for OFWs and their families, built on Stellar and Soroban. The OFW funds a category split (groceries, medicine, savings); the family builds a wishlist from a local store's inventory; funds lock in escrow on approval; the store delivers; the family confirms; escrow releases.",
  },
  {
    q: "How does the escrow flow work end-to-end?",
    a: "A wishlist moves through these states: draft → pending_approval → locked → delivered → released. The locked state is set when the on-chain lock_escrow call succeeds. Released is set when release_escrow succeeds. Every transition writes an append-only row to the settlement audit table.",
  },
  {
    q: "Why is money shown in stroops, not pesos?",
    a: "On-chain values live in stroops (1 XLM = 10,000,000 stroops) as bigint integers — that's the only way to do exact arithmetic without floating-point drift. The UI converts to XLM (up to 4 decimal places) for display only.",
  },
  {
    q: "I'm using a demo account. Will my data persist?",
    a: "Yes — the three demo accounts (Auntie Maria / Lola Cora / Aling Nena) all share the same Supabase project. Anything you do shows up for everyone else viewing that account. If you want isolated state, register your own account.",
  },
  {
    q: "I clicked a button and nothing happened.",
    a: "Most actions in the hackathon prototype either (a) navigate, (b) submit a form to a server action, or (c) hit the /api/escrow/* routes. If a click does nothing, check the browser console for errors and use Report a Bug.",
  },
  {
    q: "Why does dark mode look different from the marketing screenshots?",
    a: "The screenshots are in light mode (the default). Dark mode is a true neumorphic re-tuning — deep cool-grey surface, near-black shadows, subtle white-edge highlights. It's a different aesthetic on purpose.",
  },
];

export default function MobileHelpPage() {
  return (
    <MobileSettingsShell
      title="Help & FAQ"
      description="Common questions about the product, the flow, and the prototype's edges."
    >
      <ol className="flex flex-col gap-3">
        {FAQ.map((item, i) => (
          <li key={i} className="p-4 rounded-2xl bg-[#f5f7fa]">
            <p className="text-sm font-bold text-[#1a1d2e]">{item.q}</p>
            <p className="mt-1.5 text-xs text-[#6b7280] leading-relaxed">
              {item.a}
            </p>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-center text-xs text-[#6b7280]">
        Didn&apos;t see your question?{" "}
        <Link
          href="/mobile/settings/contact"
          className="text-[#5b7cff] font-semibold hover:underline"
        >
          Get in touch
        </Link>
        .
      </p>
    </MobileSettingsShell>
  );
}
```

- [ ] **Step 6.3: Create privacy page**

Create `app/mobile/settings/privacy/page.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

import { MobileSettingsShell } from "../MobileSettingsShell";

export const dynamic = "force-dynamic";

export default function MobilePrivacyPage() {
  return (
    <MobileSettingsShell
      title="Privacy Policy"
      description={
        <>
          Last updated:{" "}
          <span className="text-[#1a1d2e] font-medium">2026-05-21</span>{" "}
          · Prototype draft — not a final legal document.
        </>
      }
    >
      <div className="space-y-6 text-xs text-[#6b7280] leading-relaxed">
        <Section title="What we collect">
          <p>
            When you create an account, we collect your email address and the
            display name + role you choose during signup. We never see or
            store your password — Supabase handles that.
          </p>
          <p>
            When you build a wishlist, we store the items you pick, the
            quantities, and the prices at the time you added them. Every
            on-chain escrow event (deposit, lock, release) is recorded as an
            append-only audit row tied to your wishlist.
          </p>
        </Section>

        <Section title="What we don't collect">
          <p>
            No tracking cookies, no third-party analytics, no ad pixels. The
            only cookies we set are the Supabase auth session and your
            light/dark theme preference.
          </p>
        </Section>

        <Section title="Where it lives">
          <p>
            Personal and order data lives in a Supabase project we control.
            On-chain transaction hashes also live on the Stellar testnet
            ledger, which is public by design — anyone can look up an escrow
            transaction by its hash.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            For the prototype, account and order data is kept indefinitely so
            we can revisit demo flows. In production, we&apos;d delete
            inactive accounts after 12 months unless required to retain by
            applicable financial regulations.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can request access, correction, or deletion of your personal
            data at any time via{" "}
            <Link
              href="/mobile/settings/contact"
              className="text-[#5b7cff] hover:underline"
            >
              Contact Us
            </Link>
            . On-chain records are immutable by design and cannot be deleted
            after the fact.
          </p>
        </Section>
      </div>
    </MobileSettingsShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-bold text-[#1a1d2e] mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
```

- [ ] **Step 6.4: Create terms page**

Create `app/mobile/settings/terms/page.tsx`:

```tsx
import type { ReactNode } from "react";

import { MobileSettingsShell } from "../MobileSettingsShell";

export const dynamic = "force-dynamic";

export default function MobileTermsPage() {
  return (
    <MobileSettingsShell
      title="Terms of Service"
      description={
        <>
          Last updated:{" "}
          <span className="text-[#1a1d2e] font-medium">2026-05-21</span>{" "}
          · Prototype draft — not a final legal document.
        </>
      }
    >
      <div className="space-y-6 text-xs text-[#6b7280] leading-relaxed">
        <Section title="Using the prototype">
          <p>
            InternStellar is a hackathon prototype of an on-chain remittance
            escrow platform. By creating an account you agree to use it for
            evaluation, demo, and feedback purposes only. Do not use it for
            actual remittance traffic — there is no production support,
            uptime guarantee, or recourse path.
          </p>
        </Section>

        <Section title="Stellar testnet">
          <p>
            All on-chain activity runs against the Stellar testnet. Testnet
            XLM has no monetary value, and the testnet ledger is reset
            periodically. Any &quot;escrow&quot; transactions you see are
            real on-chain transactions on testnet, but they do not represent
            actual money.
          </p>
        </Section>

        <Section title="Account responsibility">
          <p>
            You&apos;re responsible for keeping your sign-in credentials safe.
            If you suspect your account has been compromised, sign out from
            all sessions and contact us. We can&apos;t recover lost passwords
            beyond Supabase&apos;s built-in reset flow.
          </p>
        </Section>

        <Section title="Limitations of liability">
          <p>
            The prototype is provided &quot;as is&quot; without warranty of
            any kind. We&apos;re not liable for lost demo data, broken flows,
            or any decision you make based on what you see here. Treat every
            output as a draft until production hardening is done.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update these terms as the prototype evolves. Material
            changes will be surfaced on the Settings page with an updated
            date stamp. Continued use after a change means you accept the
            new version.
          </p>
        </Section>
      </div>
    </MobileSettingsShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-bold text-[#1a1d2e] mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
```

- [ ] **Step 6.5: Create data-privacy page**

Create `app/mobile/settings/data-privacy/page.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { MobileSettingsShell } from "../MobileSettingsShell";

export const dynamic = "force-dynamic";

export default function MobileDataPrivacyPage() {
  return (
    <MobileSettingsShell
      title="Data Privacy"
      description="Your rights to your personal data, in plain language."
    >
      <div className="space-y-6 text-xs text-[#6b7280] leading-relaxed">
        <Section title="Access">
          <p>
            You can request a copy of everything we hold about you — your
            profile row, every wishlist you&apos;ve created, every settlement
            row tied to those wishlists. We&apos;ll send it as JSON within 30
            days.
          </p>
        </Section>

        <Section title="Correction">
          <p>
            If anything in your profile is wrong (display name, country,
            role), you can update it yourself from the{" "}
            <Link
              href="/mobile/settings/account"
              className="text-[#5b7cff] hover:underline"
            >
              Account Manager
            </Link>{" "}
            once those edit affordances ship. For now, contact us and
            we&apos;ll update it manually.
          </p>
        </Section>

        <Section title="Deletion">
          <p>
            You can request deletion of your account at any time. We&apos;ll
            remove your profile, wishlists, and wishlist items within 30
            days. The append-only settlement audit log is retained for our
            records but redacted of your identifying details.
          </p>
          <p className="text-[#1a1d2e]">
            On-chain transactions on the Stellar ledger are immutable by
            design. We can&apos;t remove them, but they&apos;re only linked
            to your account through the off-chain settlement table — once
            that&apos;s redacted, the chain entries are anonymous.
          </p>
        </Section>

        <Section title="Portability">
          <p>
            The exported JSON we provide for access requests is structured
            so you can import it into another wallet or escrow tool. Every
            on-chain event includes its tx hash so you can verify the
            history independently.
          </p>
        </Section>

        <Section title="Who to ask">
          <p>
            All data-privacy requests go to a single inbox so they get
            tracked together. Mention &quot;data privacy&quot; in the
            subject line and include the email address tied to your
            InternStellar account.
          </p>
        </Section>
      </div>

      <a
        href="mailto:Internstellar.hackathon@gmail.com?subject=Data%20privacy%20request"
        className="w-full mt-6 bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 flex items-center justify-center gap-2"
      >
        Send a data-privacy request
        <ArrowRight className="w-4 h-4" />
      </a>
    </MobileSettingsShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-bold text-[#1a1d2e] mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
```

- [ ] **Step 6.6: Smoke test all 5**

Run (background): `npm run dev`

Wait ~8 seconds.

Run:
```
for route in contact help privacy terms data-privacy; do
  curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "${route}=%{http_code}\n" "http://localhost:3000/mobile/settings/${route}"
done
```

Expected: 5 lines, all `=200`.

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile/settings/help | grep -oE 'Help & FAQ|What is InternStellar|Get in touch' | sort -u
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile/settings/terms | grep -oE 'Terms of Service|Stellar testnet|Limitations of liability' | sort -u
```

Expected: 3 + 3 markers per route.

Stop dev: `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue` (PowerShell).

- [ ] **Step 6.7: Commit**

Run:
```
git add app/mobile/settings/contact app/mobile/settings/help app/mobile/settings/privacy app/mobile/settings/terms app/mobile/settings/data-privacy
git commit -m "$(cat <<'EOF'
feat(mobile): add 5 static-content settings pages

Contact, Help & FAQ, Privacy Policy, Terms of Service, Data Privacy.
Each mirrors the corresponding web page's text content verbatim,
rewrapped in MobileSettingsShell. Internal links use /mobile/settings/*
paths directly to avoid the middleware redirect double-hop.

Spec: docs/specs/2026-05-21-mobile-phase-5-design.md §6.2, §6.4-6.7

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Report a Bug page + form

**Files:**
- Create: `app/mobile/settings/report-bug/page.tsx`
- Create: `app/mobile/settings/report-bug/MobileBugReportForm.tsx`

- [ ] **Step 7.1: Create the mobile bug form**

Create `app/mobile/settings/report-bug/MobileBugReportForm.tsx`:

```tsx
"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";

const BUG_INBOX = "Internstellar.hackathon@gmail.com";
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;

/**
 * Mobile twin of app/settings/report-bug/BugReportForm.tsx. Identical
 * client-side mailto: logic — no server action. The only differences
 * are visual: flat cards on #f5f7fa instead of neumorphic surfaces.
 *
 * The browser opens the user's default email client with a prefilled
 * subject + body. Screenshots aren't auto-attached (mailto: doesn't
 * support attachments cross-platform); we just include the filename
 * and ask the user to attach it manually before sending.
 */
export function MobileBugReportForm() {
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function handleScreenshotChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setScreenshot(null);
      setScreenshotError(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setScreenshot(null);
      setScreenshotError("Screenshot must be an image file.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setScreenshot(null);
      setScreenshotError("Screenshot must be 8 MB or smaller.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setScreenshot(file);
    setScreenshotError(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const lines = [`From: ${email}`, "", "Details:", details];
    if (screenshot) {
      lines.push(
        "",
        `Screenshot: ${screenshot.name} (${formatBytes(screenshot.size)})`,
        "→ Please attach this file in your email client before sending.",
      );
    }

    const subject = encodeURIComponent(`[Bug] ${title}`);
    const body = encodeURIComponent(lines.join("\n"));
    window.location.href = `mailto:${BUG_INBOX}?subject=${subject}&body=${body}`;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="bug-email"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Your email
        </label>
        <input
          id="bug-email"
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
          className="w-full bg-[#f5f7fa] border-0 rounded-2xl h-12 text-sm px-4 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
        <p className="text-[10px] text-[#9ca3af] mt-1.5 px-1">
          So we can follow up with questions or the fix.
        </p>
      </div>

      <div>
        <label
          htmlFor="bug-title"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Short title
        </label>
        <input
          id="bug-title"
          type="text"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Deposit fails with contract_error"
          maxLength={120}
          required
          className="w-full bg-[#f5f7fa] border-0 rounded-2xl h-12 text-sm px-4 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
      </div>

      <div>
        <label
          htmlFor="bug-details"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Details
        </label>
        <textarea
          id="bug-details"
          name="details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="What you did, what you expected, what happened. Paste any red console errors."
          rows={5}
          required
          className="w-full bg-[#f5f7fa] border-0 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40 resize-y min-h-[110px]"
        />
      </div>

      <div>
        <label
          htmlFor="bug-screenshot"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Screenshot{" "}
          <span className="normal-case tracking-normal text-[#9ca3af]">
            (optional)
          </span>
        </label>
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#f5f7fa]">
          <label
            htmlFor="bug-screenshot"
            className="cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold bg-white shadow-sm"
          >
            Choose file
          </label>
          <span className="text-xs text-[#6b7280] truncate flex-1 min-w-0">
            {screenshot
              ? `${screenshot.name} (${formatBytes(screenshot.size)})`
              : "No file selected"}
          </span>
          <input
            ref={fileRef}
            id="bug-screenshot"
            name="screenshot"
            type="file"
            accept="image/*"
            onChange={handleScreenshotChange}
            className="sr-only"
          />
        </div>
        {screenshotError ? (
          <p className="mt-2 text-xs text-red-600">{screenshotError}</p>
        ) : (
          <p className="mt-2 text-[10px] text-[#9ca3af]">
            Your email client will open — attach the file there before sending.
          </p>
        )}
      </div>

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
      >
        Send bug report
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

- [ ] **Step 7.2: Create the report-bug page**

Create `app/mobile/settings/report-bug/page.tsx`:

```tsx
import { Bug } from "lucide-react";

import { MobileSettingsShell } from "../MobileSettingsShell";

import { MobileBugReportForm } from "./MobileBugReportForm";

export const dynamic = "force-dynamic";

export default function MobileReportBugPage() {
  return (
    <MobileSettingsShell
      title="Report a Bug"
      description="Spotted something broken? Here's how to get it fixed fastest."
    >
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#f5f7fa] mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] flex items-center justify-center shrink-0">
          <Bug className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-[#1a1d2e]">Reports go to</p>
          <p className="text-xs text-[#6b7280] mt-1">
            Best for sensitive issues or screenshots.
          </p>
          <p className="mt-2 font-mono text-xs text-[#5b7cff] break-all">
            Internstellar.hackathon@gmail.com
          </p>
        </div>
      </div>

      <MobileBugReportForm />
    </MobileSettingsShell>
  );
}
```

- [ ] **Step 7.3: Smoke test**

Run (background): `npm run dev`

Wait ~8 seconds.

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile/settings/report-bug | grep -oE 'Report a Bug|Your email|Short title|Details|Send bug report' | sort -u
```

Expected: 5 markers.

Stop dev: `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue` (PowerShell).

- [ ] **Step 7.4: Commit**

Run:
```
git add app/mobile/settings/report-bug
git commit -m "$(cat <<'EOF'
feat(mobile): add /mobile/settings/report-bug page + form

Mobile-styled twin of the web BugReportForm. Identical client-side
mailto: logic — no server action, no API route. Screenshot validation
(image-only, ≤8 MB) matches the web behavior.

Spec: docs/specs/2026-05-21-mobile-phase-5-design.md §6.3

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: End-to-end smoke test

No code changes. Walks the spec §9 checklist end-to-end.

- [ ] **Step 8.1: Start dev server**

Run (background): `npm run dev`

Wait until "Ready" appears in the dev log (~6 seconds).

- [ ] **Step 8.2: All 8 settings routes compile and return 200**

Run:
```
for route in "" account contact help privacy terms data-privacy report-bug; do
  curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "/mobile/settings${route:+/}${route}=%{http_code}\n" "http://localhost:3000/mobile/settings${route:+/}${route}"
done
```

Expected: 8 lines, all `=200`.

- [ ] **Step 8.3: Hub renders all 8 rows + dark mode hint**

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile/settings | grep -oE 'Account Manager|Dark Mode|Contact Us|Report a Bug|Help & FAQ|Privacy Policy|Terms of Service|Data Privacy|affects desktop pages' | sort -u
```

Expected: 9 unique markers.

- [ ] **Step 8.4: Account signed-out variant**

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile/settings/account | grep -oE 'signed out|Sign in|mobile/login' | sort -u
```

Expected: 3 markers.

- [ ] **Step 8.5: Entry points work**

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile | grep -oE 'aria-label="Open settings"|href="/mobile/settings"' | sort -u
curl -s -A "Mozilla/5.0 (iPhone) Mobile" http://localhost:3000/mobile/store | grep -oE 'aria-label="Open settings"' | sort -u
```

Expected: 2 markers from /mobile, 1 from /mobile/store.

- [ ] **Step 8.6: Desktop bouncing intact**

Run:
```
curl -s -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120" -L -o /dev/null -w "%{url_effective}\n" http://localhost:3000/mobile/settings
curl -s -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120" -L -o /dev/null -w "%{url_effective}\n" http://localhost:3000/mobile/settings/account
```

Expected:
```
http://localhost:3000/settings
http://localhost:3000/settings/account
```

- [ ] **Step 8.7: Device unit test still passes**

Run: `npm run test:device`

Expected: `9 passed, 0 failed`.

- [ ] **Step 8.8: Inspect dev log for compile errors**

Read the dev server output file.

Expected: every /mobile/settings/* route shows `✓ Compiled ...`. No `Module not found`, no `Type error`.

- [ ] **Step 8.9: Stop dev server**

Run (PowerShell): `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 8.10: Manual browser walk-through (recommended)**

Open Chrome → DevTools → Toggle device toolbar → iPhone 14 Pro → hard refresh `http://localhost:3000/`. Walk:

1. Mobile landing → tap menu icon top-right → `/mobile/settings`. Hub renders with 8 rows.
2. Tap Account → "Sign in to continue" + Sign in CTA → `/mobile/login`. Log in as Maria. Back to `/mobile/settings/account` directly via URL → profile renders, four field cards, three CTAs (dashboard + change-password + wallet), Sign out at bottom.
3. Tap Sign out → URL becomes `/mobile/login`.
4. Sign back in, return to `/mobile/settings`. Tap each remaining sub-page; verify the back button on each returns to `/mobile/settings`.
5. From hub, tap Dark Mode row → toggle pill flips visual state. In another tab, toggle DevTools device toolbar OFF (desktop UA), visit `/settings` → confirm desktop renders in dark mode.
6. Tap Report a Bug. Fill in email + title + details, attach an image. Tap Send bug report → email client opens with prefilled subject and body.
7. Hub back button → user's `/mobile/<role>` dashboard.

If any step looks wrong, capture as a follow-up in the branch's commit log.

---

## Done

All 8 tasks complete. The repo now has:

- A mobile settings hub at `/mobile/settings` with 8 rows (7 link rows + 1 inline dark-mode toggle).
- Seven sub-pages: Account (with sign-out), Contact, Report a Bug (with form), Help & FAQ, Privacy Policy, Terms of Service, Data Privacy.
- Entry points wired from `/mobile`, `/mobile/ofw`, `/mobile/family`, and `/mobile/store`.
- Existing server actions (`signOutAction`, `setThemeAction`) reused unchanged.
- Zero changes to the web `/settings/*` tree.

Next: invoke superpowers:finishing-a-development-branch to verify tests, choose a merge/PR option, and clean up.
