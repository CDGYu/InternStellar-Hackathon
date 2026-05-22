# Mobile Parity Phase 2 (OFW Sub-Flows) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two OFW-side gaps between mobile and web — add an Activity tab (on-chain settlement timeline) and fix the Orders tab so OFWs see their sponsored family's wishlists in a read-only view.

**Architecture:** One new component (`MobileActivity`) renders the settlement timeline. `MobileWishlists` gets a `viewerRole` prop so the same rows work for OFW (read-only, "Wishlists" header) and family (with confirm-delivery, "Orders" header). `MobileDashboardClient` adds a 5th bottom tab and wires the existing `ofwData.activity` + `familyData.wishlists` into the right tabs. Zero data-loader changes — all needed data is already returned by `loadOfwDashboard`.

**Tech Stack:** Next.js 14 App Router (TypeScript), React 18.3, `lucide-react` icons, existing helpers (`formatXlmWithUnit`, `truncateHash`, `timeAgo`). No new dependencies.

**Spec reference:** [docs/specs/2026-05-22-mobile-phase-2-design.md](../specs/2026-05-22-mobile-phase-2-design.md)

---

## Working Directory Convention

All commands run from the repo root `c:\Users\user\Downloads\InternStellar-Hackathon`. The harness's CWD is already this directory. Use relative paths.

---

## Pre-flight State Confirmation

- [ ] **Verify clean working tree on main**

Run: `git status --short && git branch --show-current`

Expected:
```
?? docs/plans/2026-05-22-mobile-phase-2.md
?? docs/specs/2026-05-22-mobile-phase-2-design.md
main
```

If other modifications appear, surface to operator before continuing.

- [ ] **Verify spec exists**

Run: `ls docs/specs/2026-05-22-mobile-phase-2-design.md`

Expected: file prints.

- [ ] **Create feature branch**

Run: `git checkout -b feat/mobile-phase-2`

Expected: `Switched to a new branch 'feat/mobile-phase-2'`.

- [ ] **Commit baseline docs**

Run:
```
git add docs/specs/2026-05-22-mobile-phase-2-design.md docs/plans/2026-05-22-mobile-phase-2.md
git commit -m "$(cat <<'EOF'
docs(mobile): add Phase 2 (OFW sub-flows) spec and implementation plan

Spec: Activity tab + OFW Orders view, no data-loader changes.
Plan: 4 tasks, ~150 net lines across 3 files.

Spec: docs/specs/2026-05-22-mobile-phase-2-design.md
Plan: docs/plans/2026-05-22-mobile-phase-2.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1: `MobileActivity` component

**Files:**
- Create: `app/mobile/components/MobileActivity.tsx`

Pure-display component. Renders settlement event timeline.

- [ ] **Step 1.1: Create the component**

Create `app/mobile/components/MobileActivity.tsx`:

```tsx
import { ArrowDownCircle, CheckCircle, Lock, TrendingUp } from "lucide-react";

import type { SettlementRow } from "@/lib/dashboard/ofw";
import { formatXlmWithUnit, truncateHash } from "@/lib/format-xlm";
import { timeAgo } from "@/lib/time-ago";

type MobileActivityProps = {
  rows: SettlementRow[];
  stellarAddress?: string | null;
};

/**
 * On-chain settlement timeline. Renders the `activity` array from
 * `loadOfwDashboard` (or family's equivalent if Phase 3 wires it).
 * Each row is a deposit / lock / release event with the amount, the
 * tied wishlist (if any), a truncated tx hash linking to Stellar
 * Expert, and a relative timestamp.
 *
 * The component is role-agnostic — it just takes a row array.
 * `stellarAddress` is reserved for a future "from address" badge on
 * deposits; not used in Phase 2 but accepted so callers don't need
 * to change later.
 */
export function MobileActivity({ rows }: MobileActivityProps) {
  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-extrabold mb-2">Activity</h2>
          <p className="text-sm text-[#6b7280] leading-relaxed">
            Every on-chain event for your account, newest first.
          </p>
        </div>

        <div className="p-8 text-center bg-white border border-black/5 rounded-3xl">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-7 h-7 text-[#9ca3af]" />
          </div>
          <p className="text-sm font-semibold text-[#1a1d2e] mb-1">
            No on-chain activity yet
          </p>
          <p className="text-xs text-[#6b7280] leading-relaxed">
            Your deposits and escrow events will appear here once you
            send funds. Tap{" "}
            <span className="font-semibold text-[#5b7cff]">Send</span>{" "}
            to fund your first split.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold mb-2">Activity</h2>
        <p className="text-sm text-[#6b7280] leading-relaxed">
          Every on-chain event for your account, newest first.
        </p>
      </div>

      <ul className="space-y-3">
        {rows.map((row) => (
          <ActivityRow key={row.id} row={row} />
        ))}
      </ul>
    </div>
  );
}

function ActivityRow({ row }: { row: SettlementRow }) {
  const variant = VARIANTS[row.event_type];
  const wishlistLabel = row.wishlist_notes || "Untitled wishlist";

  return (
    <li className="p-4 bg-white border border-black/5 shadow-sm rounded-3xl flex items-start gap-3">
      <div
        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${variant.gradient} flex items-center justify-center shrink-0 shadow-sm`}
      >
        <variant.Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#1a1d2e]">
          {variant.verb} {formatXlmWithUnit(row.amount_stroops)}
        </p>
        <p className="text-[12px] text-[#6b7280] mt-0.5 truncate">
          {variant.preposition}{" "}
          <span className="italic">&ldquo;{wishlistLabel}&rdquo;</span>
        </p>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-[#9ca3af]">
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${row.tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[#5b7cff] hover:underline"
          >
            {truncateHash(row.tx_hash)}
          </a>
          <span>·</span>
          <span>{timeAgo(row.created_at)}</span>
        </div>
      </div>
    </li>
  );
}

const VARIANTS = {
  deposit: {
    Icon: ArrowDownCircle,
    gradient: "from-blue-500 to-blue-600",
    verb: "Deposited",
    preposition: "into",
  },
  lock: {
    Icon: Lock,
    gradient: "from-amber-500 to-orange-500",
    verb: "Locked",
    preposition: "for",
  },
  release: {
    Icon: CheckCircle,
    gradient: "from-emerald-400 to-emerald-600",
    verb: "Released",
    preposition: "from",
  },
} as const;
```

- [ ] **Step 1.2: Verify it parses (no TS errors)**

Run (background): `npm run dev`

Wait ~7 seconds.

Read the dev server output file — confirm no errors mentioning
`MobileActivity` or `SettlementRow`. (No route renders it yet, but
Next still type-checks on hot reload of any imported module.)

Stop dev (PowerShell): `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 1.3: Commit**

Run:
```
git add app/mobile/components/MobileActivity.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add MobileActivity -- on-chain settlement timeline

Renders the activity array from loadOfwDashboard with deposit / lock
/ release events. Each row: gradient icon chip color-coded by event
type, action verb + amount, wishlist label, truncated tx hash linking
to Stellar Expert testnet, timeAgo timestamp. Empty state nudges the
user to tap Send.

Component is role-agnostic -- takes a SettlementRow[] regardless of
viewer role. Phase 3 can wire family activity through the same
component without changes.

Spec: docs/specs/2026-05-22-mobile-phase-2-design.md section 5

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `MobileWishlists` — add `viewerRole` prop

**Files:**
- Modify: `app/mobile/components/MobileWishlists.tsx`

Header copy + confirm-delivery button behavior + empty state copy
become role-aware.

- [ ] **Step 2.1: Add the prop to the type + signature**

In `app/mobile/components/MobileWishlists.tsx`, find:

```tsx
type MobileWishlistsProps = {
  familyId: string;
  wishlists: any[];
};

export function MobileWishlists({ familyId, wishlists }: MobileWishlistsProps) {
```

Replace with:

```tsx
type MobileWishlistsProps = {
  familyId: string;
  wishlists: any[];
  viewerRole: "ofw" | "family";
};

export function MobileWishlists({
  familyId,
  wishlists,
  viewerRole,
}: MobileWishlistsProps) {
  const isOfw = viewerRole === "ofw";
```

- [ ] **Step 2.2: Make the header copy role-aware**

Find:

```tsx
      <div>
        <h2 className="text-2xl font-extrabold mb-2">Orders</h2>
        <p className="text-sm text-[#6b7280] leading-relaxed">
          Confirm delivery to release locked funds to the store.
        </p>
      </div>
```

Replace with:

```tsx
      <div>
        <h2 className="text-2xl font-extrabold mb-2">
          {isOfw ? "Wishlists" : "Orders"}
        </h2>
        <p className="text-sm text-[#6b7280] leading-relaxed">
          {isOfw
            ? "Your sponsored family's orders, on-chain."
            : "Confirm delivery to release locked funds to the store."}
        </p>
      </div>
```

- [ ] **Step 2.3: Hide the confirm-delivery button for OFW**

Find the confirm-delivery block (the `{w.status === "delivered" && (` and
its `<button onClick={() => confirmDelivery(w.id)} ...>` block — roughly
lines 78-87 in the current file).

Replace the opening conditional:

```tsx
              {w.status === "delivered" && (
```

with:

```tsx
              {!isOfw && w.status === "delivered" && (
```

This is one character of logic change (`!isOfw &&`) but it's the
whole point of the role-aware view. Leave the rest of the button
markup intact.

- [ ] **Step 2.4: Replace the empty-state copy**

Find:

```tsx
      {wishlists.length === 0 && (
        <div className="p-8 text-center bg-white border border-black/5 rounded-3xl">
          <p className="text-sm text-[#6b7280]">No orders found.</p>
        </div>
      )}
```

Replace with:

```tsx
      {wishlists.length === 0 && (
        <div className="p-8 text-center bg-white border border-black/5 rounded-3xl">
          <p className="text-sm text-[#6b7280]">
            {isOfw
              ? "No wishlists yet — your sponsored family hasn't built one."
              : "No orders yet — your wishlists will appear here once you start one."}
          </p>
        </div>
      )}
```

- [ ] **Step 2.5: Verify no TS errors**

Run (background): `npm run dev`. Wait ~7 seconds.

Read the dev log. Expect: no errors. Stop dev (PowerShell):
`Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

(Note: this file is consumed by `MobileDashboardClient` which still
passes the old prop set — TypeScript will error on the **call site**
about missing `viewerRole` once the new prop is required. That's
expected and resolved in Task 3. Until Task 3 is applied, the dev
server log will show a TS error like
`Property 'viewerRole' is missing in type ... but required in
type 'MobileWishlistsProps'`. **Treat this as expected** — don't
roll back. Commit and move to Task 3.)

- [ ] **Step 2.6: Commit**

Run:
```
git add app/mobile/components/MobileWishlists.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): MobileWishlists -- add viewerRole for OFW read-only view

OFW sees the same wishlist rows the family does but with role-aware
copy and no confirm-delivery action:
  - header: "Wishlists" (was "Orders") + "Your sponsored family's
    orders, on-chain." subtitle
  - confirm-delivery button hidden (only family can release)
  - empty state copy keyed on role

Caller MobileDashboardClient must pass viewerRole; wired in the next
commit.

Spec: docs/specs/2026-05-22-mobile-phase-2-design.md section 6

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `MobileDashboardClient` — 5th tab + OFW Orders + Activity mount

**Files:**
- Modify: `app/mobile/MobileDashboardClient.tsx`

Three coordinated edits in one file. Order matters because the imports
need to land before they're referenced.

- [ ] **Step 3.1: Update imports**

Find:

```tsx
import {
  BarChart3,
  Lock,
  CheckCircle,
  TrendingUp,
  ArrowUpRight,
  Menu,
  Home,
  CreditCard,
  Package,
  User,
  ArrowRight
} from "lucide-react";
```

Replace with:

```tsx
import {
  BarChart3,
  Lock,
  CheckCircle,
  TrendingUp,
  ArrowUpRight,
  Menu,
  Home,
  CreditCard,
  Package,
  User,
  ArrowRight,
  History
} from "lucide-react";
```

Then find the existing imports block (just below the lucide imports):

```tsx
import { MobileSendFunds } from "./components/MobileSendFunds";
import { MobileBills } from "./components/MobileBills";
import { MobileWishlists } from "./components/MobileWishlists";
import { formatXlmWithUnit, formatXlm } from "@/lib/format-xlm";
```

Insert one new import line for `MobileActivity` directly after
`MobileWishlists`:

```tsx
import { MobileSendFunds } from "./components/MobileSendFunds";
import { MobileBills } from "./components/MobileBills";
import { MobileWishlists } from "./components/MobileWishlists";
import { MobileActivity } from "./components/MobileActivity";
import { formatXlmWithUnit, formatXlm } from "@/lib/format-xlm";
```

- [ ] **Step 3.2: Extend the activeTab state union**

Find:

```tsx
  const [activeTab, setActiveTab] = useState<"home" | "send" | "bills" | "orders">("home");
```

Replace with:

```tsx
  const [activeTab, setActiveTab] = useState<
    "home" | "send" | "bills" | "orders" | "activity"
  >("home");
```

- [ ] **Step 3.3: Fix the Orders tab for OFW**

Find:

```tsx
        {activeTab === "orders" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            {familyData ? (
              <MobileWishlists 
                familyId={familyData.family.id} 
                wishlists={familyData.wishlists} 
              />
            ) : (
              <div className="text-center py-20 text-[#6b7280]">
                <p>Orders & Deliveries requires a Family account.</p>
              </div>
            )}
          </div>
        )}
```

Replace with:

```tsx
        {activeTab === "orders" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            {familyData ? (
              <MobileWishlists
                familyId={familyData.family.id}
                wishlists={familyData.wishlists}
                viewerRole={currentUserRole}
              />
            ) : (
              <div className="text-center py-20 text-[#6b7280]">
                <p>
                  {currentUserRole === "ofw"
                    ? "Your sponsored family hasn't been linked yet."
                    : "Orders & Deliveries requires a Family account."}
                </p>
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 3.4: Add the Activity tab body**

Locate the Orders tab block you just edited (Step 3.3). Directly
after its closing `)}` (and before the Bottom Tab Bar comment), add a
new block:

```tsx
        {activeTab === "activity" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <MobileActivity
              rows={ofwData?.activity || familyData?.activity || []}
              stellarAddress={ofwData?.ofw.stellar_public_key}
            />
          </div>
        )}
```

- [ ] **Step 3.5: Add the 5th tab to the bottom bar**

Find the bottom tab bar:

```tsx
      {/* Bottom Tab Bar */}
      <div className="absolute bottom-0 w-full bg-white border-t border-black/5 px-6 pb-safe pt-3 pb-6 flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-50">
        <TabItem icon={<Home />} label="Home" active={activeTab === "home"} onClick={() => setActiveTab("home")} />
        <TabItem icon={<TrendingUp />} label="Send" active={activeTab === "send"} onClick={() => setActiveTab("send")} />
        <TabItem icon={<CreditCard />} label="Bills" active={activeTab === "bills"} onClick={() => setActiveTab("bills")} />
        <TabItem icon={<Package />} label="Orders" active={activeTab === "orders"} onClick={() => setActiveTab("orders")} />
      </div>
```

Replace with:

```tsx
      {/* Bottom Tab Bar */}
      <div className="absolute bottom-0 w-full bg-white border-t border-black/5 px-4 pb-safe pt-3 pb-6 flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-50">
        <TabItem icon={<Home />} label="Home" active={activeTab === "home"} onClick={() => setActiveTab("home")} />
        <TabItem icon={<TrendingUp />} label="Send" active={activeTab === "send"} onClick={() => setActiveTab("send")} />
        <TabItem icon={<CreditCard />} label="Bills" active={activeTab === "bills"} onClick={() => setActiveTab("bills")} />
        <TabItem icon={<Package />} label="Orders" active={activeTab === "orders"} onClick={() => setActiveTab("orders")} />
        <TabItem icon={<History />} label="Activity" active={activeTab === "activity"} onClick={() => setActiveTab("activity")} />
      </div>
```

(Two changes: outer container `px-6` → `px-4` for tighter horizontal
padding on 5 tabs, and the new `<TabItem icon={<History />}` line.)

- [ ] **Step 3.6: Shrink the TabItem min-width**

Find the `TabItem` function definition at the bottom of the file:

```tsx
function TabItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 min-w-[60px] transition-all duration-300 ${active ? "text-[#5b7cff]" : "text-[#9ca3af] hover:text-[#6b7280]"}`}
    >
```

Change `min-w-[60px]` to `min-w-[50px]`:

```tsx
function TabItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 min-w-[50px] transition-all duration-300 ${active ? "text-[#5b7cff]" : "text-[#9ca3af] hover:text-[#6b7280]"}`}
    >
```

- [ ] **Step 3.7: Smoke test all 5 tabs render + Orders works for both roles**

Run (background): `npm run dev`. Wait ~8 seconds.

Run:
```
echo "=== /mobile/ofw redirects unauth -> /login -> /mobile/login ==="
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "%{http_code}\n" http://localhost:3000/mobile/ofw
echo "=== /mobile/family same behavior ==="
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "%{http_code}\n" http://localhost:3000/mobile/family
```

Expected: both return 307 (auth-redirect — this just confirms the
pages still compile + the auth gate still works).

Read the dev log. Expect: lines like
`✓ Compiled /mobile/ofw in ...` and `✓ Compiled /mobile/family in ...`
with no `Module not found`, no `Type error`, no `Cannot find name
'viewerRole'`.

Stop dev (PowerShell):
`Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 3.8: Commit**

Run:
```
git add app/mobile/MobileDashboardClient.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add Activity tab + OFW Orders view to dashboard

Dashboard now has 5 bottom tabs: Home / Send / Bills / Orders /
Activity. Activity is the new on-chain settlement timeline. Orders
now also works for OFW -- shows their sponsored family's wishlists
read-only (no confirm-delivery button); OFW with no family linked
sees an OFW-specific empty state.

TabItem min-width tightened 60px -> 50px and tab-bar padding
tightened px-6 -> px-4 so 5 tabs fit on a 360px viewport.

Spec: docs/specs/2026-05-22-mobile-phase-2-design.md section 7

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: End-to-end smoke test

No code changes. Walks the spec §9 checklist.

- [ ] **Step 4.1: Start dev server**

Run (background): `npm run dev`. Wait until "Ready" appears (~6 seconds).

- [ ] **Step 4.2: Dashboard routes compile + auth-redirect properly**

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "ofw=%{http_code}\n" http://localhost:3000/mobile/ofw
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "family=%{http_code}\n" http://localhost:3000/mobile/family
```

Expected:
```
ofw=307
family=307
```

- [ ] **Step 4.3: Dev log shows clean compilation**

Read the dev log. Verify:
- `✓ Compiled /mobile/ofw` with no errors.
- `✓ Compiled /mobile/family` with no errors.
- No `Type error` about `viewerRole`, `currentUserRole`, or `History`
  icon imports.

- [ ] **Step 4.4: Existing tests still pass**

Run: `npm run test:device`

Expected: `9 passed, 0 failed`.

- [ ] **Step 4.5: Stop dev server**

Run (PowerShell): `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 4.6: Manual browser walk-through (required for visual verification)**

Open Chrome → DevTools → Toggle device toolbar → iPhone 14 Pro →
hard refresh `http://localhost:3000/`. Walk the spec §9 checklist:

1. Mobile landing → tap "Log in" → land on `/mobile/login`.
2. Sign in as **Auntie Maria** (OFW). Land on `/mobile/ofw`. Confirm
   5 tabs visible at the bottom: Home / Send / Bills / Orders /
   Activity.
3. Tap **Activity**. Verify the timeline renders with at least the
   seeded events (deposits + locks from earlier demo flows). Each
   row shows: gradient icon chip (blue/amber/emerald by event type),
   action verb + amount, wishlist label, tx-hash link (mono accent),
   timeAgo timestamp. Tap a tx-hash link → opens stellar.expert in
   new tab.
4. Tap **Orders**. Now shows wishlists (was previously "requires
   Family account"). Header reads "Wishlists" + "Your sponsored
   family's orders, on-chain." For any `delivered`-status wishlist,
   confirm NO "Confirm delivery" button is visible.
5. Sign out. Log in as **Lola Cora** (Family). Land on
   `/mobile/family`. Tap **Orders** → still works. Header reads
   "Orders". Confirm-delivery button appears for delivered
   wishlists (unchanged from today).
6. Tap **Activity** as family user. If `familyData.activity` is
   empty (Phase 3 hasn't wired family activity), the friendly empty
   state renders. If family has any settlement rows, they render.
7. Resize DevTools to iPhone SE (375×667). Confirm all 5 tabs fit
   without horizontal scroll. Labels still readable.

If any step looks wrong, capture as a follow-up before merging.

---

## Done

All 4 tasks complete. The repo now has:

- A new `MobileActivity` component rendering the settlement timeline.
- A `MobileWishlists` component that works for both OFW and family
  via a `viewerRole` prop.
- A 5-tab mobile dashboard wiring Activity into the bottom bar and
  fixing the OFW Orders view.

Next: invoke superpowers:finishing-a-development-branch to verify
tests, choose a merge/PR option, and clean up.
