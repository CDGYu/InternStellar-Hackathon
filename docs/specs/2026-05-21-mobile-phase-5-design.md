# Mobile Parity — Phase 5 (Settings) — Design Spec

- **Date:** 2026-05-21
- **Owner:** (frontend, new branch off `main` at execution time)
- **Repo:** `CDGYu/InternStellar-Hackathon`
- **Scope:** Phase 5 of the mobile-parity effort. Builds the mobile
  equivalent of every page under `/settings/*` on the web, plus the
  entry point from the dashboard header.

## 1. Goal

After this work ships, a mobile user who has logged in and reached
their dashboard (`/mobile/ofw` or `/mobile/family`) can:

1. Tap the **Menu** icon at the top right of the dashboard header and
   land on a settings hub at `/mobile/settings`.
2. See all 8 rows that the web `/settings` page has (Account, Dark
   Mode, Contact, Report a Bug, Help & FAQ, Privacy, Terms, Data
   Privacy), styled for narrow viewports.
3. Tap any row → land on the equivalent mobile-styled sub-page at
   `/mobile/settings/<slug>`.
4. Use the back button on any sub-page to return to the hub; use the
   hub's back button to return to their dashboard.
5. Sign out from the Account sub-page → land on `/mobile/login`.
6. Toggle dark mode from the hub — cookie flips. The Dark Mode row's
   hint text explicitly says "Affects desktop pages — mobile UI is
   light-mode only for now" so users aren't surprised that the toggle
   has no visual effect on mobile.
7. Send a bug report from `/mobile/settings/report-bug` — fills out a
   short form and the browser opens their email client with a
   prefilled `mailto:` (identical mechanism to the web).

Desktop visitors hitting `/mobile/settings/<anything>` get middleware-
redirected to the equivalent `/settings/<anything>` (existing behavior
from Phase 0+1). The desktop `/settings` tree is **not modified**.

## 2. Non-Goals

- ❌ Dark-mode-aware mobile UI. Toggling dark mode flips the cookie and
  affects future desktop renders, but the mobile UI is light-mode-only.
  Making the mobile tree dark-mode-aware would touch every mobile
  component (MobileLanding, MobileDashboardClient, MobileSendFunds,
  MobileBills, MobileWishlists, all auth pages, all settings pages)
  with theme-aware Tailwind tokens. That's a separate phase.
- ❌ A "Change password" flow. Web Account page has the button as a
  placeholder that goes to the dashboard — mobile matches that exactly.
  Real password change is out of hackathon scope.
- ❌ "Manage Stellar wallet" flow. Same — placeholder button on web
  Account, mobile matches.
- ❌ Server-side bug submission. Web uses `mailto:` client-side; mobile
  matches. No new API route, no email-sending backend.
- ❌ A drawer or bottom-sheet alternative for the menu button. Explicit
  decision during brainstorming: full-screen pages under `/mobile/settings/*`.
- ❌ Phase 2-4 work (OFW/family/store sub-flows, mobile settings is
  independent of those).

## 3. Constraints

- **No new server actions.** Reuse:
  - `signOutAction` from [`app/auth/actions.ts`](../../app/auth/actions.ts) (Account page)
  - `setThemeAction` from [`app/theme/actions.ts`](../../app/theme/actions.ts) (Dark Mode toggle)
  - `loadUserProfile` from [`lib/auth-role.ts`](../../lib/auth-role.ts) (Account page)
  - `getTheme` from [`lib/theme.ts`](../../lib/theme.ts) (hub page server-side)
- **No new API routes.**
- **No new dependencies.** `lucide-react` is already installed.
- **No changes to the web tree.** `app/settings/*` stays untouched.
  The shared `SettingsPageShell` in `components/ui/` is web-only —
  mobile gets its own equivalent.
- **Text copy reuse.** Static content (Help FAQ items, Privacy
  sections, Terms sections, Data Privacy sections) is copied verbatim
  from the web pages into the mobile pages. If the legal text changes
  later, it changes in both files. Not worth extracting a shared
  module for hackathon — the duplication is shallow and obvious.
- **Visual language.** Mobile settings pages use the same palette as
  the existing mobile tree: `#f5f7fa` bg, white cards with
  `rounded-3xl shadow-xl shadow-black/5`, `#5b7cff→#7c9aff` gradient
  for primary CTAs, `#1a1d2e` ink, `#6b7280` muted.

## 4. Architecture

### 4.1 Route layout

```
app/mobile/settings/                          [NEW]
├── page.tsx                                  # hub: 8 rows + inline dark mode toggle
├── MobileSettingsShell.tsx                   # back-bar + title + body wrapper
├── DarkModeRow.tsx                           # client form posting to setThemeAction
├── account/page.tsx                          # profile + sign-out (or sign-in CTA if logged out)
├── contact/page.tsx                          # mailto card (static)
├── data-privacy/page.tsx                     # static content
├── help/page.tsx                             # static FAQ list
├── privacy/page.tsx                          # static content
├── report-bug/
│   ├── page.tsx                              # mobile bug-report shell
│   └── MobileBugReportForm.tsx               # mobile-styled mailto form (client)
└── terms/page.tsx                            # static content
```

Plus one edit:

```
app/mobile/MobileDashboardClient.tsx          # convert <button>Menu</button> to <Link href="/mobile/settings">
```

### 4.2 `MobileSettingsShell` interface

The shared shell every sub-page uses (mobile equivalent of
[`components/ui/SettingsPageShell.tsx`](../../components/ui/SettingsPageShell.tsx)):

```tsx
type Props = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  backHref?: string;          // default "/mobile/settings"
  backLabel?: string;         // default "Back to settings"
};
```

Renders: `min-h-screen bg-[#f5f7fa]` outer; `ArrowLeft` link top-left;
single column `max-w-md mx-auto`; bold title + optional description +
children inside a white `rounded-3xl shadow-xl` card. Roughly the
shape of the [`MobileLoginPage`](../../app/mobile/login/page.tsx) shell
without the inputs.

### 4.3 Request flow (hub example)

```
Mobile user, signed in, on /mobile/ofw
  → taps Menu icon (now a <Link href="/mobile/settings">)
  → Browser GET /mobile/settings
      → middleware: mobile UA + /mobile path → fall through to updateSession
      → app/mobile/settings/page.tsx renders
          - reads theme cookie via getTheme()
          - reads user + profile (if signed in) for back-button destination
          - renders 8 rows (7 Links + 1 inline DarkModeRow form)
  → User taps Account row
  → Browser GET /mobile/settings/account
      → renders MobileSettingsShell with profile + sign-out form
      → form action={signOutAction} on submit → server action signs out
        → redirect("/login") → middleware → /mobile/login
```

### 4.4 Why `MobileSettingsShell` instead of reusing `SettingsPageShell`

The web shell uses neumorphic primitives (`Card`, `BackToHomeButton`,
`shadow-neu` etc.) that don't match the mobile flat-card aesthetic.
Trying to make one shell render two different visual languages would
mean conditional props or theming hooks — overkill for two trees of
~7 pages each. Two shells, same shape, different visual style is the
simpler boundary.

## 5. Hub page (`/mobile/settings`)

### 5.1 What it renders

Server component. Reads `theme` cookie + (if signed in) the user's
profile for back-button routing. Renders:

1. Back-arrow link (`ArrowLeft` + "Back") top-left. Destination:
   - If `profile.role === "ofw"` → `/mobile/ofw`
   - If `profile.role === "family"` → `/mobile/family`
   - If `profile.role === "store"` → `/mobile/store`
   - If signed out → `/mobile`
2. Header: "InternStellar" + "Settings" subtitle.
3. Title: "Settings".
4. Subtitle: "Account preferences, help, and the fine print."
5. List of 8 rows in this order (matching the web order):
   1. **Account Manager** — `UserIcon` — `/mobile/settings/account`
   2. **Dark Mode** — `Moon` — inline toggle (no link), with hint:
      *"Affects desktop pages — mobile UI is light-mode only for now."*
   3. **Contact Us** — `Mail` — `/mobile/settings/contact`
   4. **Report a Bug** — `Bug` — `/mobile/settings/report-bug`
   5. **Help & FAQ** — `HelpCircle` — `/mobile/settings/help`
   6. **Privacy Policy** — `Shield` — `/mobile/settings/privacy`
   7. **Terms of Service** — `FileText` — `/mobile/settings/terms`
   8. **Data Privacy** — `Lock` — `/mobile/settings/data-privacy`

Each row is a tappable rounded card: icon chip on the left, label +
hint in the middle, `ChevronRight` on the right. Use `lucide-react`
icons throughout (already installed).

### 5.2 `DarkModeRow.tsx`

Client component. Renders the row visually like the others but with
a toggle pill on the right (no chevron). The toggle is a small
`<form action={setThemeAction}>` with a hidden input `name="theme"
value={next}` where `next` is the opposite of the current theme.
Submitting flips the cookie; `setThemeAction` already calls
`revalidatePath("/", "layout")` so the next render reflects the
change.

The toggle visual: a 40×24 pill, white bg in light mode, dark bg in
dark mode, with a circle that slides left/right. Tailwind only —
no react-spring, no framer-motion.

## 6. Sub-pages

### 6.1 Account (`/mobile/settings/account`)

Server component. If signed out → renders a "Sign in to continue"
state with one CTA `<Link href="/mobile/login">`. If signed in →
renders:

- A user chip: `UserIcon` + display name + email.
- 4 fields (Role, Country, Account ID, Email confirmed) in a
  2-column `dl` grid.
- A primary CTA: "Go to your dashboard" → `/mobile/<role>`.
- Two secondary buttons: "Change password" and "Manage Stellar
  wallet" — both link to the dashboard (placeholder, matches web).
- A sign-out form: `<form action={signOutAction}>` with a ghost
  button. After sign-out, `signOutAction` redirects to `/login`,
  middleware rewrites to `/mobile/login`.

### 6.2 Contact (`/mobile/settings/contact`)

Static. Card with `Mail` icon + "Email" heading + body text +
`Internstellar.hackathon@gmail.com` styled as monospace accent. Text
copied verbatim from [`app/settings/contact/page.tsx`](../../app/settings/contact/page.tsx).

### 6.3 Report a Bug (`/mobile/settings/report-bug`)

Page shell with intro card ("Reports go to" + email) + the
`MobileBugReportForm`. Form is the mobile-styled twin of
[`app/settings/report-bug/BugReportForm.tsx`](../../app/settings/report-bug/BugReportForm.tsx):

- Fields: email, short title, details (textarea), optional screenshot
  file picker.
- Same screenshot validation (image only, ≤ 8 MB).
- On submit, builds a `mailto:` URL identical to the web version:
  ```
  mailto:Internstellar.hackathon@gmail.com?subject=[Bug] <title>&body=...
  ```
- No server action. Pure client-side `window.location.href = mailto:`.

### 6.4 Help & FAQ (`/mobile/settings/help`)

Static. Same 6-item `FAQ` array as
[`app/settings/help/page.tsx`](../../app/settings/help/page.tsx),
rendered as 6 cards. Footer link "Get in touch" → `/mobile/settings/contact`.

### 6.5 Privacy Policy (`/mobile/settings/privacy`)

Static. Same 5 `<Section>` blocks as
[`app/settings/privacy/page.tsx`](../../app/settings/privacy/page.tsx).
"Last updated: 2026-05-21" subtitle. Internal link to Contact stays
inside `/mobile/settings/contact`.

### 6.6 Terms of Service (`/mobile/settings/terms`)

Static. Section blocks copied from
[`app/settings/terms/page.tsx`](../../app/settings/terms/page.tsx).

### 6.7 Data Privacy (`/mobile/settings/data-privacy`)

Static. Section blocks copied from
[`app/settings/data-privacy/page.tsx`](../../app/settings/data-privacy/page.tsx).

## 7. Edge cases & error handling

| Case | Behavior |
|---|---|
| Mobile user types `/mobile/settings/account` directly while signed out | Page renders Account's "signed out" state with `<Link href="/mobile/login">Sign in</Link>`. No redirect. (Matches web Account page.) |
| Mobile user types `/mobile/settings` while signed out | Hub renders normally. Back button destination resolves to `/mobile`. Static rows are reachable; Account row → signed-out variant of Account page. |
| Mobile user signs out from Account | `signOutAction` redirects to `/login` → middleware → `/mobile/login`. Identical flow to logout-anywhere-else. |
| Mobile user toggles Dark Mode | Cookie flips. `revalidatePath("/", "layout")` triggers Next to re-render. Mobile UI is unaffected visually (light-mode hardcoded). Hint text on the row already discloses this. |
| Mobile user opens Report a Bug, submits the form | Browser opens default email client with prefilled mailto link. If no email client configured, the browser shows an OS dialog or nothing — same UX as web. |
| Mobile user picks a >8MB screenshot in bug report | Inline error message ("Screenshot must be 8 MB or smaller."), same validation as web. |
| Desktop user types `/mobile/settings` (e.g., copy/paste from a phone) | Middleware 307 → `/settings`. Existing Phase 0+1 behavior. |
| Static content page opened while signed out | Renders normally — no auth requirement. Back goes to hub. |
| Mobile user clicks Help's "Get in touch" link | Navigates to `/mobile/settings/contact` (not `/settings/contact`). Need to use mobile URLs in the static text or rely on middleware. (Decision: use `/mobile/settings/contact` directly — see §8.1.) |

## 8. Open questions (resolved)

### 8.1 Internal links in static content

Web Help page has `<a href="/settings/contact">Get in touch</a>`. Web
Privacy has `<a href="/settings/contact">Contact Us</a>`. When we
copy these into mobile, do we leave them as `/settings/...` (let
middleware redirect) or use `/mobile/settings/...` directly?

**Decision:** use the mobile URL directly. The user is already on
`/mobile/settings/...` so we know they're mobile. Avoids the
middleware double-hop and keeps the URL bar stable.

### 8.2 What does the Menu icon do on the mobile landing page (`/mobile`)?

[`MobileLanding.tsx:8-11`](../../app/mobile/MobileLanding.tsx#L8-L11)
already has a `<button>` with the Menu icon. Currently it does
nothing.

**Decision:** also link it to `/mobile/settings`. Even signed-out
users can reach the static content pages from the landing. Aligns
with web — `/` doesn't show settings but `/settings` is publicly
reachable.

### 8.3 Should the dashboard's `BottomTabBar` get a 5th tab for Settings?

**Decision:** no. The Menu icon in the header is the entry point.
Adding a 5th tab would crowd the tab bar (it's already 4 tabs at
~25% each); turning it into a 5-up grid breaks the icon proportions.
Header-icon entry is the standard mobile pattern for "less
important than core features but always reachable."

## 9. Manual smoke-test checklist

Validate with Chrome DevTools "Toggle device toolbar" + iPhone 14
Pro profile:

1. Sign in as Maria → `/mobile/ofw`. Tap Menu icon (top right) →
   URL becomes `/mobile/settings`, hub renders with 8 rows.
2. Tap Account → URL `/mobile/settings/account`. Display name and
   email render. Tap "Sign out" → URL becomes `/mobile/login`.
3. Sign back in. Return to settings hub. Tap each of the other 7
   rows in turn; verify the page renders with mobile styling and
   the back button returns to the hub.
4. From the hub, tap the dark-mode toggle. Verify the toggle's
   visual state flips. Visit `/login` in the same browser tab in
   desktop UA mode (toggle DevTools off) → confirm the desktop
   page renders in dark mode.
5. Open Report a Bug. Fill in email + title + details, attach a
   <8MB image. Tap "Send bug report" → email client opens with
   prefilled subject and body.
6. Hub's back button → `/mobile/ofw`. Sub-page back buttons →
   `/mobile/settings`.
7. Open `/mobile/settings/account` in incognito (signed out). Verify
   the "Sign in to continue" state renders with the CTA.
8. Desktop UA: navigate to `http://localhost:3000/mobile/settings`.
   Middleware redirects to `/settings`. Web hub renders.

## 10. Cross-references

- Master plan: [docs/specs/2026-05-21-mobile-phase-0-1-design.md §10](2026-05-21-mobile-phase-0-1-design.md)
  (this is the Phase 5 deferred there).
- Web settings hub: [app/settings/page.tsx](../../app/settings/page.tsx) — pattern to mirror.
- Web settings shell: [components/ui/SettingsPageShell.tsx](../../components/ui/SettingsPageShell.tsx) — interface to mirror.
- Web bug report form: [app/settings/report-bug/BugReportForm.tsx](../../app/settings/report-bug/BugReportForm.tsx) — logic to mirror, styling to swap.
- Auth actions reused: [app/auth/actions.ts](../../app/auth/actions.ts).
- Theme action reused: [app/theme/actions.ts](../../app/theme/actions.ts).
- Dashboard entry point: [app/mobile/MobileDashboardClient.tsx](../../app/mobile/MobileDashboardClient.tsx) lines 64-68.

## 11. Phase 2-4 status (not in scope here)

For context only. Still deferred:

- **Phase 2** — OFW sub-flows (Transactions, dedicated Send/Bills/Wishlists routes)
- **Phase 3** — Family sub-flows (Shop, Activity)
- **Phase 4** — Store role mobile dashboard (`/mobile/store` currently a placeholder)
