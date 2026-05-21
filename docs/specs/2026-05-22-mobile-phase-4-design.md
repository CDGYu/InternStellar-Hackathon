# Mobile Parity — Phase 4 (Store Dashboard) — Design Spec

- **Date:** 2026-05-22
- **Owner:** (frontend, new branch off `main` at execution time)
- **Repo:** `CDGYu/InternStellar-Hackathon`
- **Scope:** Replace the `/mobile/store` placeholder with a full mobile
  store dashboard mirroring every section on web `/store`: welcome +
  stats, create-order form, order queue with mark-delivered, inventory
  with stock/price edit, activity timeline, receipts.

## 1. Goal

After this work ships, a store user (e.g. Aling Nena) on a mobile
device can:

1. Sign in as a store role and land on `/mobile/store`. Instead of
   the "coming soon" placeholder, see a full dashboard with bottom
   tab bar: **Home / Orders / Inventory / Activity**.
2. **Home tab** — see welcome + 3 stat cards (pending count, in
   escrow, revenue).
3. **Orders tab** — see a collapsible "+ Create Order" form at top,
   then three queue sections: Pending approval, Locked (with **Mark
   as Delivered** button per row), Settled (receipts with release
   tx hash). The Create Order form posts to the existing
   `/api/store/orders/create` route.
4. **Inventory tab** — see all inventory items with stock + price.
   Tap a card to expand an inline edit panel with stock and price
   inputs + Save (reuses existing `storeUpdateInventory` server
   action).
5. **Activity tab** — see settlement timeline (deposit / lock /
   release events) via the existing Phase 2 `MobileActivity`
   component, now with proper wishlist labels (loader extension in
   §7 mirrors Phase 3's family fix).
6. Tap the menu icon top-right → reach `/mobile/settings` (Phase 5
   already wired this).

Web `/store` is unaffected.

## 2. Non-Goals

- ❌ Real-time order-queue refresh. Web's `OrdersRealtimeRefresher`
  subscribes to Supabase channels; mobile re-fetches on tab switch.
- ❌ Adding **new** inventory items. Mobile only edits stock and
  price of existing items. Adding new inventory is admin-tier and
  out of scope for the demo (the seed handles initial inventory).
- ❌ A bulk-action UI (multi-select wishlists, mass mark-delivered).
- ❌ Multi-quantity per-item picker in Create Order — start with
  qty-stepper (+/-) per inventory item, default 0.
- ❌ Inventory category editing or deletion.
- ❌ Inventory search/filter in mobile. Small dataset.
- ❌ Settings — Phase 5 already covers it. Menu icon on the store
  dashboard already links to `/mobile/settings` (from the placeholder
  header we built when scaffolding the route in Phase 0+1).

## 3. Constraints

- **No changes to web `app/(app)/store/*`.**
- **No new server actions.** Reuse `storeUpdateInventory` from
  [`app/(app)/store/actions.ts`](../../app/%28app%29/store/actions.ts).
- **No new API routes.** Reuse `/api/store/orders/create` and
  direct Supabase writes for `wishlist.status = "delivered"`.
- **No new dependencies.**
- **Reuse `MobileActivity` from Phase 2** — pass `storeData.activity`
  unchanged; component already accepts a `SettlementRow[]`-shaped
  array.
- **Parallel client component**, not extension of
  `MobileDashboardClient`. Store has no Send/Shop/Bills tabs — trying
  to make one component role-aware for all three roles would mean
  conditional branches everywhere.
- **All routes live under `/mobile/store`** via tab state. No new
  sub-routes — avoids the middleware bounce problem (no
  `/store/create-order` exists on web).
- **Bigint stringification** at server→client boundary for prices.
  Same pattern web `/store` uses for `inventory.price_stroops` and
  `orders.total_stroops`.

## 4. Architecture

### 4.1 File deltas

```
app/mobile/store/page.tsx                                  [edit]   replace placeholder; load StoreDashboardData
app/mobile/store/MobileStoreDashboardClient.tsx            [NEW]    tab state + Home + Activity bodies + bottom bar
app/mobile/store/components/MobileStoreOrders.tsx          [NEW]    Create form + Pending + Locked + Delivered + Settled sections
app/mobile/store/components/MobileStoreCreateOrderForm.tsx [NEW]    collapsible create-order form (family + inventory pickers)
app/mobile/store/components/MobileStoreInventory.tsx       [NEW]    inventory list with inline stock/price edit
lib/dashboard/store.ts                                     [edit]   StoreSettlementRow gets wishlist_notes/status
```

6 files. ~1000 net lines across the new ones; ~30 in the loader
edit. **Largest phase by line count.**

### 4.2 Data flow

```
Browser GET /mobile/store (mobile UA, signed in as store)
  → app/mobile/store/page.tsx
      - createSupabaseServerClient() → user
      - if no user → redirect("/login") (middleware bounces to /mobile/login)
      - loadUserProfile(user.id) → profile.role === "store" required;
        else redirect("/") (middleware bounces appropriately)
      - loadStoreDashboard({ storeId: user.id }) → StoreDashboardData
      - stringify bigints (inventory.price_stroops,
        orders.total_stroops, receipts.items[].price_stroops_at_add)
      - render <MobileStoreDashboardClient storeData={...} />

  In MobileStoreDashboardClient:
    activeTab state ∈ {"home", "orders", "inventory", "activity"}.
    Bodies branch on activeTab:
      home      → inline render: welcome + stats
      orders    → <MobileStoreOrders storeData={...} />
      inventory → <MobileStoreInventory storeData={...} />
      activity  → <MobileActivity rows={storeData.activity} />
```

### 4.3 Why parallel and not role-aware

`MobileDashboardClient` was written for OFW/family. It mounts
`MobileSendFunds` / `MobileShop` / `MobileBills` / `MobileWishlists` —
all family/OFW concepts. None apply to store. The store experience
needs: orders queue, inventory, mark-delivered, create-order. Trying
to bolt these into the existing component would mean either renaming
tabs based on role (confusing) or adding role conditionals around
every branch (fragile).

Two parallel files keep each role's dashboard understandable in
isolation. The shared piece — `MobileActivity` — is already role-
agnostic and reused as-is.

## 5. `MobileStoreDashboardClient`

### 5.1 Props

```ts
import type { StoreDashboardData } from "@/lib/dashboard/store";

type Props = {
  storeData: StoreDashboardDataSerialized;  // bigints stringified
  currentUserId: string;
};
```

Where `StoreDashboardDataSerialized` is the same shape as
`StoreDashboardData` but with bigint fields as strings (server→client
boundary). The page.tsx server component is responsible for
stringification.

### 5.2 Layout

Identical shell pattern to the OFW/family `MobileDashboardClient`:

- Outer: `relative flex flex-col h-screen max-w-md mx-auto overflow-hidden bg-[#f5f7fa] text-[#1a1d2e] font-sans`
- Header bar: brand "InternStellar" + menu icon `<Link href="/mobile/settings">`
- Scrollable middle: tab-keyed body
- Bottom tab bar: 4 tabs at `min-w-[50px]`, `px-4`

### 5.3 Tab bar

```tsx
<TabItem icon={<Home />}        label="Home"      ... "home" />
<TabItem icon={<Package />}     label="Orders"    ... "orders" />
<TabItem icon={<Boxes />}       label="Inventory" ... "inventory" />
<TabItem icon={<History />}     label="Activity"  ... "activity" />
```

`TabItem` component is duplicated minimally inside
`MobileStoreDashboardClient` (mirrors the pattern from
`MobileDashboardClient`).

### 5.4 Home tab body

Inline JSX, no separate component (it's small):

- Welcome strip: "Welcome back" eyebrow + "Aling Nena's desk." h2 +
  one-line subtitle ("X orders waiting on your approval." or "All
  caught up — no pending orders.")
- 3 stat cards in a single row (`grid grid-cols-3 gap-3`):
  - Pending approval: pendingCount + "needs review"
  - In escrow: formatXlmWithUnit(inEscrow) + "locked"
  - Revenue: formatXlmWithUnit(revenue) + "released"
- Optional: "Out of stock" warning card if `outOfStockCount > 0` —
  amber-tinted card with `AlertCircle` icon nudging to Inventory tab.

## 6. `MobileStoreOrders`

Single scrollable view with up to 5 sections. Order of appearance
top-to-bottom:

### 6.1 Create Order header (collapsible)

A row at the top:
```
+ Create Order                                    [chevron]
```

Tap toggles `isCreateOpen` state. When open, renders
`<MobileStoreCreateOrderForm>` below. When closed, only the header
shows. Default: closed.

### 6.2 Pending approval

`orders.filter(o => o.status === "pending_approval")`. Card per
order, **read-only** (no action button — store can't approve; family
locks):

```
[icon]  Lola Cora's order
        12.5 XLM · 3 items
        [pending_approval pill]
        2 hours ago
```

Empty state: collapsed header only ("No pending orders" muted
subtitle in the section header).

### 6.3 Locked, awaiting delivery

`orders.filter(o => o.status === "locked")`. Card per order with a
**Mark as Delivered** button:

```
[icon]  Lola Cora's order
        12.5 XLM · 3 items
        [locked pill]
        tx: a3c4...e91f · 1 hour ago
        [Mark as Delivered button]
```

Tap "Mark as Delivered" → direct Supabase update (cookie-bound):

```ts
supabase
  .from("wishlist")
  .update({ status: "delivered", updated_at: new Date().toISOString() })
  .eq("id", wishlistId);
```

Same logic as web's `MarkDeliveredButton.tsx`. Show inline spinner
+ disable button during submit; show inline error if update fails.
After success: `router.refresh()` so the order moves to the
"Delivered, awaiting confirm" section.

### 6.4 Delivered, awaiting confirm

`orders.filter(o => o.status === "delivered")`. Read-only:

```
[icon]  Lola Cora's order
        12.5 XLM · 3 items
        [delivered pill]
        Awaiting family confirmation
```

### 6.5 Settled

`storeData.receipts` (the loader already filters to released-status
orders with line items). Compact card per receipt:

```
[icon]  Lola Cora's order
        12.5 XLM · 3 items
        [released pill]
        release tx: 9d2e...4f01
        3 hours ago
```

Tap-to-expand to show line items? Out of scope. Just render the
summary; the line items array is on the row if a future detail view
needs it.

## 7. `MobileStoreCreateOrderForm`

Inline form inside the Orders tab. Renders when
`MobileStoreOrders.isCreateOpen` is true.

### 7.1 Fields

- **Family** — dropdown (`<select>`) of `storeData.families`.
  Default to empty; require selection.
- **Notes** — optional `<input>`, used as the wishlist's `notes`
  field.
- **Items** — list of inventory items (only those with `stock > 0`).
  Each row: name + price + `−` qty `+` chips with the current
  quantity (default 0). Local state map `quantities: Record<id, number>`.
- Submit button: "Create order" + arrow icon. Disabled when no
  family selected or all quantities are 0.

### 7.2 Submit

```ts
const items = inventory
  .filter((inv) => (quantities[inv.id] ?? 0) > 0)
  .map((inv) => ({
    inventory_id: inv.id,
    quantity: quantities[inv.id] as number,
  }));

const result = await apiPost<{ wishlist_id: string; item_count: number }>(
  "/api/store/orders/create",
  { store_id: storeId, family_id: familyId, items, notes: notes.trim() || undefined },
);
```

On success:
- Show transient success banner: "Order created — N item(s) in the queue."
- Reset form (`quantities = {}`, `notes = ""`)
- Collapse the form (`setIsCreateOpen(false)`)
- `router.refresh()` so the order appears in Pending section.

On failure:
- Inline red error banner with `result.message`.

### 7.3 Why inline, not bottom-sheet or new route

Inline matches web's pattern (the form is the first section on
`/store`). Bottom-sheet adds animation complexity. A new route
(`/mobile/store/create-order`) gets middleware-bounced for desktop
users since no `/store/create-order` exists on web. Inline avoids
all those issues.

## 8. `MobileStoreInventory`

List of inventory items, grouped by category. For each item, a card:

```
Rice 5kg                              [Edit]
0.5 XLM / 5kg · Stock: 12
```

Tap **Edit** → expand inline panel:

```
[Stock input: 12]
[Price input: 0.5] XLM
[Cancel] [Save]
```

Save → calls `storeUpdateInventory({ inventoryId, stock?, priceStroops? })`
(existing server action; performs ownership check + admin write).
On success: collapse + `router.refresh()`. On failure: inline error.

Out-of-stock items get an amber `Stock: 0` badge styled in red so
they stand out.

Why inline edit (not modal): mobile-native UX. One tap to edit, no
context switch.

## 9. Loader extension

`lib/dashboard/store.ts` — extend `StoreSettlementRow` and the
settlement select. Identical pattern to Phase 3's family fix:

```ts
export interface StoreSettlementRow {
  id: string;
  wishlist_id: string;
  event_type: SettlementEvent;
  tx_hash: string;
  amount_stroops: bigint;
  created_at: string;
  wishlist_notes: string | null;     // NEW
  wishlist_status: WishlistStatus | null;  // NEW
}
```

Settlement query (find around line 194):

```ts
supabase
  .from("settlement")
  .select(
    "id, wishlist_id, event_type, tx_hash, amount_stroops, created_at, " +
      "wishlist:wishlist_id (notes, status)",
  )
  ...
```

And the `.map(...)` updated with the array-or-object coercion +
new fields. Mirrors the OFW and family loaders' pattern.

Without this, the store Activity tab would render every row as
"Untitled wishlist".

## 10. Edge cases & error handling

| Case | Behavior |
|---|---|
| Store has zero inventory + zero orders (fresh account) | Home shows zeroes; Orders shows the Create form (collapsed) + section headers with "no orders" hints; Inventory shows "No inventory yet — add items via the desktop dashboard for now" empty state. |
| Store has families to choose from but the dropdown is empty (no family profiles in DB) | Create Order form's family dropdown shows "(no families yet)"; submit is disabled. |
| `storeUpdateInventory` returns `{ ok: false }` (RLS denied) | Inline red error on the inventory card. |
| `apiPost("/api/store/orders/create")` returns an envelope `{ ok: false }` | Inline red error in the Create Order form. |
| Mark-as-Delivered fails (RLS denied) | Inline red error on the order card; status doesn't flip. |
| Activity event with `wishlist_notes === null` (parent wishlist deleted) | `MobileActivity` already falls back to "Untitled wishlist". |
| Store user with sponsored family null and no orders | All sections degrade to empty states; no crash. |
| Store user opens Orders tab while a wishlist is being locked by family in another tab | Local state shows pre-lock view until next tab switch / refresh. Acceptable for demo. |
| Out-of-stock item still appears in Create Order picker | Filter out at render time (`inventory.filter(i => i.stock > 0)`). Stock change during form open is rare; submit-side will fail with the API's stock check (existing behavior). |

## 11. Manual smoke-test checklist

Chrome DevTools "Toggle device toolbar" + iPhone 14 Pro, log in as
**Aling Nena** (store):

1. Land on `/mobile/store`. Confirm 4 tabs at bottom: Home / Orders /
   Inventory / Activity. Placeholder is replaced.
2. **Home** — welcome shows "Aling Nena's desk." or similar. Three
   stat cards render with real values.
3. Tap **Orders**.
   - Tap "+ Create Order" header → form expands inline.
   - Pick "Lola Cora" from family dropdown. Pick 2 inventory items
     with qty 1 each via the +/- chips. Tap "Create order" →
     success banner, form collapses, the new order appears in
     "Pending approval" section.
   - As **Lola Cora** in another browser, log in and tap that
     order → lock funds. Switch back to store browser, refresh.
     The order now appears in "Locked, awaiting delivery" with a
     "Mark as Delivered" button.
   - Tap **Mark as Delivered** → order moves to "Delivered,
     awaiting confirm".
   - As Lola Cora again, tap "Confirm delivery" on her Orders tab
     (Phase 2 work). Switch back to store; the order appears in
     "Settled" section with the release tx hash.
4. Tap **Inventory**. Pick an item, tap Edit → inline panel
   expands. Change stock to 0 + price to 1.5 → Save. Card updates;
   out-of-stock badge appears.
5. Tap **Activity**. The lock + release events render with proper
   wishlist labels (e.g., "Rice 5kg + Cooking Oil" — whatever notes
   were entered), not "Untitled wishlist".
6. Tap the menu icon top-right → lands on `/mobile/settings`.
7. Resize DevTools to iPhone SE (375 × 667). All 4 tabs visible
   without horizontal scroll.

## 12. Open questions (resolved)

### 12.1 Why not 5 tabs with Create as its own tab?

Considered. Decision: 4 tabs with Create inline at top of Orders.
Reasons:
- Mobile bottom-bar best practice caps at 5 (Android) but 4 is
  cleaner.
- Create Order belongs conceptually with the order queue, not as
  a peer feature.
- Web has it inline at the top of `/store` too — closer to parity.

### 12.2 Receipts as a separate tab vs inline in Orders?

Decision: inline in Orders as the "Settled" section at the bottom.
Receipts are just orders at status `released` — they belong in the
order-lifecycle view.

### 12.3 Inventory add vs edit only?

Decision: edit only. Adding new inventory items is admin-tier; the
demo seed handles initial stock. Adding new items would need a
"new item" form with name/category/unit/price/stock — that's a
separate sub-spec.

### 12.4 Why direct Supabase write for Mark as Delivered instead of
an API route?

Mirrors web exactly — web's `MarkDeliveredButton.tsx` does a direct
Supabase update gated by the `store_updates_wishlist` RLS policy.
The chain release fires later when the family confirms; no chain
call belongs in this button. No need for a new API route.

## 13. Cross-references

- Master plan: [docs/specs/2026-05-21-mobile-phase-0-1-design.md §10](2026-05-21-mobile-phase-0-1-design.md)
  (this is Phase 4 deferred there).
- Web store dashboard: [app/(app)/store/page.tsx](../../app/%28app%29/store/page.tsx)
- Web CreateOrderForm: [app/(app)/store/CreateOrderForm.tsx](../../app/%28app%29/store/CreateOrderForm.tsx)
- Web MarkDeliveredButton: [app/(app)/store/MarkDeliveredButton.tsx](../../app/%28app%29/store/MarkDeliveredButton.tsx)
- Web InventoryItemCard: [app/(app)/store/InventoryItemCard.tsx](../../app/%28app%29/store/InventoryItemCard.tsx)
- Store actions: [app/(app)/store/actions.ts](../../app/%28app%29/store/actions.ts)
- Store loader: [lib/dashboard/store.ts](../../lib/dashboard/store.ts)
- Reused mobile pieces:
  [app/mobile/components/MobileActivity.tsx](../../app/mobile/components/MobileActivity.tsx) (Phase 2)
- Existing placeholder: [app/mobile/store/page.tsx](../../app/mobile/store/page.tsx)
- API route: [app/api/store/orders/create/route.ts](../../app/api/store/orders/create/route.ts)

## 14. Phase status after this work

All 5 phases will be complete:
- Phase 0+1 — foundation + mobile auth (merged)
- Phase 5 — mobile settings (merged)
- Phase 2 — OFW sub-flows (merged)
- Phase 3 — family Shop (merged)
- **Phase 4 — store dashboard (this spec)**

Mobile parity with web will be **functionally complete** after
Phase 4 lands.
