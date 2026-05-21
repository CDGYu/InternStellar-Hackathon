# Mobile Parity — Phase 2 (OFW Sub-Flows) — Design Spec

- **Date:** 2026-05-22
- **Owner:** (frontend, new branch off `main` at execution time)
- **Repo:** `CDGYu/InternStellar-Hackathon`
- **Scope:** Close the two OFW-side gaps between mobile and web: add an
  Activity tab (on-chain settlement timeline) and fix the Orders tab so
  OFWs can see their sponsored family's wishlists.

## 1. Goal

After this work ships, an OFW user on a mobile device can:

1. Tap **Activity** (a new 5th tab in the bottom bar) and see every
   on-chain settlement event for their account — deposits, locks, and
   releases — with amounts in XLM, the wishlist each event ties to,
   the truncated transaction hash linking to stellar.expert, and a
   relative timestamp.
2. Tap **Orders** and see their sponsored family's wishlists in a
   read-only OFW view (currently the Orders tab shows "requires a
   Family account" for OFW). The status pill, amount, item count, and
   tx-hash links remain; the "Confirm delivery" button is hidden
   (only the family can confirm).
3. The 4 existing tabs (Home / Send / Bills / Orders) keep their
   current behavior. Family users see the Activity tab too — when
   their `familyData.activity` is populated (Phase 3 may extend), it
   renders; until then the tab shows the empty state.

Web `/ofw` users are **unaffected** — this is a mobile-only change.

## 2. Non-Goals

- ❌ Dedicated routes per sub-view (`/mobile/ofw/transactions`,
  `/mobile/ofw/send`, etc.). The master spec §10 mentioned this as an
  open question; explicit decision during brainstorming was to keep
  the tab pattern.
- ❌ Real-time updates on the Activity tab. The tab re-fetches when
  the user re-navigates to `/mobile/ofw`; live subscriptions are
  outside hackathon scope.
- ❌ Wishlist item-level detail page (`/mobile/wishlist/[id]`).
- ❌ Editing or approving wishlists from the OFW Orders view. The web
  OFW dashboard has an "edit wishlist" expand panel; mobile shows
  read-only rows only.
- ❌ Family Activity content shape — Phase 3 will add family Activity
  data plumbing if needed. The `MobileActivity` component this spec
  introduces is role-agnostic, so Phase 3 only adds data, not UI.

## 3. Constraints

- **No changes to web `app/(app)/ofw/*` routes.**
- **No changes to data loaders.** `loadOfwDashboard` already returns
  `activity: SettlementRow[]` and `familyData.wishlists`. Phase 2
  consumes existing data; it doesn't add new queries.
- **No new server actions, no new API routes, no new dependencies.**
- **Reuse existing helpers** — `formatXlmWithUnit`, `formatXlm`,
  `truncateHash` from [`lib/format-xlm.ts`](../../lib/format-xlm.ts);
  `timeAgo` from [`lib/time-ago.ts`](../../lib/time-ago.ts).
- **Tab bar must remain usable on 360px-wide phones.** Adding a 5th
  tab requires tightening per-tab min-width from 60px to 50px;
  verify in DevTools at iPhone SE width (375px).

## 4. Architecture

### 4.1 File deltas

```
app/mobile/components/MobileActivity.tsx       [NEW]   timeline component
app/mobile/components/MobileWishlists.tsx      [edit]  +viewerRole prop
app/mobile/MobileDashboardClient.tsx           [edit]  5th tab + OFW Orders + Activity mount
```

Three files. ~150 lines new, ~30 lines modified.

### 4.2 Data flow

Current state (post-Phase 0+1+5):

```
app/mobile/ofw/page.tsx
  → loadOfwDashboard() → { ofw, family, totals, releasedCount,
                            activeWishlists, activity, allocation,
                            bills, inventory }
  → loadFamilyDashboard() (if familyId) → familyData

  Both passed to:
  <MobileDashboardClient
     ofwData={...}
     familyData={...}
     currentUserRole="ofw"
     currentUserId={user.id}
  />
```

After Phase 2:

```
MobileDashboardClient renders 5 tabs:
  home    — current overview (unchanged)
  send    — MobileSendFunds (unchanged; OFW only)
  bills   — MobileBills (unchanged)
  orders  — MobileWishlists, NOW with viewerRole
              viewerRole="ofw"    → reads familyData.wishlists
              viewerRole="family" → reads familyData.wishlists (own)
  activity— MobileActivity, NEW
              rows = ofwData?.activity || familyData?.activity || []
              stellarAddress = ofwData?.ofw.stellar_public_key
```

The Orders tab change is subtle: for OFW it now reads
`familyData.wishlists` (was previously gated by `familyData ? ... :
"requires Family account"`). The fact that OFW + family both ultimately
look at the same wishlist rows is correct — they just see different
affordances on those rows.

## 5. `MobileActivity` component (new)

### 5.1 Props

```ts
import type { SettlementRow } from "@/lib/dashboard/ofw";

type MobileActivityProps = {
  rows: SettlementRow[];
  stellarAddress?: string | null;
};
```

`SettlementRow` shape (already exported from
[`lib/dashboard/ofw.ts`](../../lib/dashboard/ofw.ts)):

```ts
{
  id: string;
  wishlist_id: string;
  event_type: "deposit" | "lock" | "release";
  tx_hash: string;
  amount_stroops: bigint;
  created_at: string;          // ISO timestamp
  wishlist_notes: string | null;
  wishlist_status: WishlistStatus | null;
}
```

### 5.2 Rendering

- Header: bold "Activity" + 1-line subtitle ("Every on-chain event for
  your account, oldest at the bottom.").
- Empty state if `rows.length === 0`: large icon + friendly copy:
  "No on-chain activity yet — your deposits and escrow events will
  appear here once you send funds." + a CTA-style note ("Tap **Send**
  to fund your first split.").
- Otherwise: vertical list of rows, newest at top (already sorted by
  the loader's `order by created_at desc`).

Each row:

```
[icon chip]  Deposited 50.0000 XLM
             into "Lola Cora's grocery wishlist"
             a2c3...e91f · 2 hours ago
```

- Icon chip color by event type:
  - `deposit` — blue (`from-blue-500 to-blue-600`), arrow-down-circle
  - `lock`    — amber (`from-amber-500 to-orange-500`), lock
  - `release` — emerald (`from-emerald-400 to-emerald-600`), check-circle
- Action verb by type:
  - `deposit` → "Deposited"
  - `lock`    → "Locked"
  - `release` → "Released"
- Amount: `formatXlmWithUnit(row.amount_stroops)`.
- Wishlist label: `row.wishlist_notes` if present, else `"Untitled
  wishlist"`. Italicized in muted text.
- Tx-hash link: `truncateHash(row.tx_hash)` styled mono-accent. Opens
  `https://stellar.expert/explorer/testnet/tx/<full-hash>` in a new
  tab (target="_blank", rel="noopener noreferrer").
- Timestamp: `timeAgo(row.created_at)` — "2 hours ago" etc.

### 5.3 Why no grouping by date

The web `TransactionHistory` groups by date (Today / Yesterday /
This week / Older). Mobile is intentionally simpler — just a flat
chronological list. The `timeAgo` already conveys time bucket;
double-grouping adds visual chrome without information.

## 6. `MobileWishlists` update

### 6.1 New prop

```ts
type MobileWishlistsProps = {
  familyId: string;
  wishlists: any[];
  viewerRole: "ofw" | "family";   // NEW
};
```

### 6.2 Behavior changes

For `viewerRole === "ofw"`:
- Header h2: `"Wishlists"` (was `"Orders"`).
- Subtitle: `"Your sponsored family's orders, on-chain."` (was
  `"Confirm delivery to release locked funds to the store."`).
- The "Confirm delivery" button (currently rendered when
  `w.status === "delivered"`) is **hidden**. Family is the role with
  release authority — OFW sees the delivered status but can't act.

For `viewerRole === "family"` — unchanged from today.

### 6.3 Why a prop, not a separate component

Both views show the same wishlist rows, the same status pills, the
same amount + item-count metadata. The only divergence is the action
button and the header copy. A `viewerRole` prop keeps the row
rendering DRY and signals intent without duplicating ~120 lines.

## 7. `MobileDashboardClient` update

### 7.1 Tab bar (5 items)

Reduce `min-w-[60px]` → `min-w-[50px]` on each `TabItem`. Add a 5th
item:

```tsx
<TabItem
  icon={<History />}    // lucide-react
  label="Activity"
  active={activeTab === "activity"}
  onClick={() => setActiveTab("activity")}
/>
```

Update the `activeTab` type:

```ts
const [activeTab, setActiveTab] = useState<
  "home" | "send" | "bills" | "orders" | "activity"
>("home");
```

### 7.2 Orders tab body

Replace the family-gate:

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

OFW still falls into the empty state when `familyData === null` (no
sponsored family linked yet) — but with copy that makes sense for
their context.

### 7.3 Activity tab body (new branch)

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

`ofwData?.activity` is the SettlementRow[] loaded by
`loadOfwDashboard`. The `|| familyData?.activity` branch is forward-
looking: if Phase 3 wires family Activity, it falls through here.
For Phase 2, families see the empty state (which is honest — their
own role doesn't trigger settlement events the same way; an OFW
funds, locks; family confirms delivery to trigger release).

## 8. Edge cases & error handling

| Case | Behavior |
|---|---|
| OFW has no family linked (`familyData === null`) | Orders tab shows "Your sponsored family hasn't been linked yet." Activity tab still works (deposit rows can exist without a family). |
| OFW has family but no wishlists yet | Orders tab shows `MobileWishlists` with empty `wishlists` array. (Existing component already handles this — both `inFlight` and `released` empty → no content sections; we may want a friendlier empty state, see §10.) |
| OFW has activity but no family | Activity tab populates with deposit rows (deposits can predate family link). Each row's wishlist label falls back to "Untitled wishlist" if `wishlist_notes` is null. |
| Settlement row's `wishlist_notes` is null (parent wishlist deleted) | Row renders with "Untitled wishlist" label and the action verb + amount + tx hash + timeAgo still show — audit trail preserved. |
| Family user opens Activity tab | Empty state if `familyData.activity` is missing/empty. Doesn't error. |
| Mobile viewport at 320px wide (iPhone SE 1st gen) | 5 tabs at `min-w-[50px]` = 250px content + gaps. Viable. Text labels still readable at 10px. If we see clipping in smoke test, drop the label-text on the inactive tabs (icons only) on smallest viewports — not in scope here unless smoke test catches it. |
| Tx hash link tap on phone | Opens Stellar Expert in a new tab/window. iOS Safari may prompt for tab-open allowance; standard behavior. |

## 9. Manual smoke-test checklist

Chrome DevTools "Toggle device toolbar" + iPhone 14 Pro + log in as
Maria (OFW):

1. Land on `/mobile/ofw`. Confirm 5 tabs visible at the bottom: Home /
   Send / Bills / Orders / Activity.
2. Tap **Activity**. Verify the timeline renders. Each event shows:
   icon chip with correct color, action verb + amount, wishlist
   label, tx-hash link (mono accent), timeAgo timestamp. Tap a
   tx-hash link → opens stellar.expert in new tab.
3. Tap **Orders**. Now shows wishlists (was previously "requires
   Family account"). Header reads "Wishlists" + "Your sponsored
   family's orders, on-chain." For any `delivered`-status wishlist,
   confirm NO "Confirm delivery" button is visible.
4. Sign out. Log in as Cora (Family). Land on `/mobile/family`. Tap
   **Orders** → still works (header reads "Orders", confirm button
   appears for delivered wishlists — unchanged from today).
5. Tap **Activity** as family user. Empty state renders with
   friendly copy.
6. Resize DevTools to iPhone SE (375×667). Confirm all 5 tabs fit
   without horizontal scroll. Labels still readable.

## 10. Open questions (resolved)

### 10.1 Activity tab label

Considered: "Activity", "Transactions", "History", "Tx". Decision:
**"Activity"**. Matches the data shape's name (`activity: SettlementRow[]`),
generic enough for future event types, single word that fits the
narrow tab label slot. Mirrors what web's `TransactionHistory`
component header says ("Activity").

### 10.2 Empty state copy when OFW has no wishlists yet

Currently `MobileWishlists` doesn't render an explicit empty state
when both `inFlight` and `released` are empty — it just shows the
header + subtitle and no row sections. For OFW (likely to see this
empty state often early in onboarding) this could feel broken.

Decision: **add an empty state inside `MobileWishlists`** when
`wishlists.length === 0`, with copy keyed on `viewerRole`:
- ofw: "No wishlists yet — your sponsored family hasn't built one."
- family: "No orders yet — tap Shop to start a wishlist." *(Family
  Shop arrives in Phase 3; for now the message just nudges to the
  desktop or future Shop tab.)*

This is a tiny inline change to `MobileWishlists` (already in §6
scope) — fold it into the same edit.

### 10.3 Why 5 tabs instead of moving Activity to the header

Activity is a peer feature to Bills/Orders, not a settings-style
thing. Header icons are reserved for utility (settings menu). The
5th tab is the right home.

## 11. Cross-references

- Master plan: [docs/specs/2026-05-21-mobile-phase-0-1-design.md §10](2026-05-21-mobile-phase-0-1-design.md)
  (this is the Phase 2 deferred there).
- Web OFW dashboard: [app/(app)/ofw/page.tsx](../../app/%28app%29/ofw/page.tsx) — pattern reference for sections.
- Web TransactionHistory: [app/(app)/ofw/TransactionHistory.tsx](../../app/%28app%29/ofw/TransactionHistory.tsx) — text/copy reference.
- Data loader: [lib/dashboard/ofw.ts](../../lib/dashboard/ofw.ts) — `SettlementRow`, `WishlistRow` types.
- Existing mobile dashboard: [app/mobile/MobileDashboardClient.tsx](../../app/mobile/MobileDashboardClient.tsx).
- Existing wishlists component: [app/mobile/components/MobileWishlists.tsx](../../app/mobile/components/MobileWishlists.tsx).
- Helpers: [lib/format-xlm.ts](../../lib/format-xlm.ts), [lib/time-ago.ts](../../lib/time-ago.ts).

## 12. Phase 3-4 status (not in scope here)

For context only. Still deferred:

- **Phase 3** — Family Shop + Activity. Shop = browse store inventory,
  add items to a wishlist. Activity for family = its own settlement
  events (release events visible from family side).
- **Phase 4** — Store mobile dashboard. Currently `/mobile/store` is
  a placeholder; Phase 4 builds the real dashboard with pending order
  queue, locked orders, inventory CRUD, receipts.
