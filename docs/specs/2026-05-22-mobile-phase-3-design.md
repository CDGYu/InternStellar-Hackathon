# Mobile Parity — Phase 3 (Family Shop) — Design Spec

- **Date:** 2026-05-22
- **Owner:** (frontend, new branch off `main` at execution time)
- **Repo:** `CDGYu/InternStellar-Hackathon`
- **Scope:** Build the mobile **Shop** experience for family users — a
  mobile twin of the web `WishlistBuilder` so families can browse
  store inventory, add/remove items to a wishlist, and lock funds via
  escrow. Plus a tiny data-layer fix so the (already-working) family
  Activity tab from Phase 2 shows proper wishlist labels.

## 1. Goal

After this work ships, a family user on a mobile device can:

1. Tap **Shop** (a new 2nd tab in the bottom bar, replacing **Send**
   which is OFW-only) and see the full store inventory grouped by
   category (Groceries / Utilities / Emergency).
2. Tap `+` on any inventory item to add it to their current draft
   wishlist. If no draft exists yet, the first add creates one. If
   the same item is added twice, its quantity bumps instead of
   duplicating rows. The cart summary at the top of the Shop view
   updates in real-time (optimistic state + `router.refresh()`).
3. Tap `-` on a cart item (or `−` chip on the inventory card if
   already in cart) to decrement; quantity going to 0 deletes the
   row entirely.
4. Once at least one item is in the cart, tap **Lock funds X XLM** at
   the top of the cart summary. This POSTs to `/api/escrow/lock` (the
   existing endpoint that calls Soroban's `lock_escrow`). On success,
   the wishlist's status flips to `"locked"`, the editor freezes, and
   the cart shows the on-chain tx hash linked to stellar.expert.
5. Tap **Activity** and see their on-chain settlement events with
   proper wishlist labels (currently they say "Untitled wishlist"
   because the loader doesn't join wishlist notes — Phase 3 fixes
   this with a one-line query change).

OFW users are unaffected — their tab #2 stays **Send**.
Web `/family` and `/ofw` are unaffected.

## 2. Non-Goals

- ❌ Inventory search / filter UI. The hackathon demo has < 50 items;
  scrolling the grouped grid is fine.
- ❌ Pagination of inventory. Same reason.
- ❌ Image thumbnails on inventory cards. Matches the web's text-only
  approach.
- ❌ Editing a wishlist after it's locked. Frozen on both surfaces.
- ❌ Real-time inventory stock updates. Refresh-on-tab-switch is
  acceptable for the hackathon; the store-side `OrdersRealtimeRefresher`
  is web-only.
- ❌ A Cart "summary" screen separate from Shop. Cart visible inline
  at the top of Shop; no second navigation step.
- ❌ Multi-wishlist concurrent editing. Only the active draft is
  editable; older wishlists shown in **Orders** are read-only after
  lock.
- ❌ Phase 4 — Store role mobile dashboard. Still deferred.

## 3. Constraints

- **No changes to web `app/(app)/family/*` routes.**
- **No changes to the existing API routes.** `MobileShop` calls the
  same `/api/escrow/lock` the web uses (via `apiPost` from
  [`lib/api/client.ts`](../../lib/api/client.ts)).
- **No new server actions, no new dependencies.**
- **Reuse the types from `WishlistBuilder.tsx`** — `BuilderInventoryItem`
  and `BuilderLineItem` are already exported. `MobileShop` imports
  them so the two surfaces can't drift on data shape.
- **Reuse the same Supabase RLS write pattern.** Mobile Shop uses
  `createSupabaseBrowserClient()` for `wishlist` and `wishlist_item`
  inserts/updates/deletes, with the cookie-bound session enforcing
  the existing `family_writes_own_wishlist` and
  `family_writes_wishlist_item` policies. **Do not** add new RLS
  policies.
- **Tab bar stays at 5 slots.** The role-aware swap rotates tab #2
  (Send ↔ Shop); the other 4 tabs are role-invariant.
- **Bigint serialization at server→client boundary** — same trick as
  web: stringify `price_stroops` and `price_stroops_at_add` in the
  server component before passing to the client `MobileShop`.

## 4. Architecture

### 4.1 File deltas

```
app/mobile/components/MobileShop.tsx       [NEW]   inventory grid + cart + lock CTA
app/mobile/MobileDashboardClient.tsx       [edit]  role-aware tab #2; mount Shop body
lib/dashboard/family.ts                    [edit]  add wishlist_notes/status to settlement select
```

3 files. ~250 lines new, ~30 lines modified.

### 4.2 Data flow

```
Browser GET /mobile/family (mobile UA, logged in as family)
  → app/mobile/family/page.tsx
      → loadFamilyDashboard({ familyId })
          → returns { family, wishlists, activeDraft, inventory, bills,
                      activity, billers }
      → stringifies inventory + activeDraft items (bigint → string)
      → renders <MobileDashboardClient familyData={...} currentUserRole="family" />

  In MobileDashboardClient:
    - tab #2 = Shop (because role === "family")
    - activeTab = "shop" body branch passes:
        familyId           = familyData.family.id
        inventory          = familyData.inventory (stringified)
        initialWishlistId  = familyData.activeDraft?.wishlist.id ?? null
        initialStatus      = familyData.activeDraft?.wishlist.status ?? null
        initialItems       = familyData.activeDraft?.items (stringified) ?? []
        initialEscrowTxHash= familyData.activeDraft?.wishlist.escrow_tx_hash ?? null
      to <MobileShop>.

  MobileShop:
    - Holds local items/status/wishlistId state (optimistic mirror).
    - Add/Remove → Supabase browser client → router.refresh() to re-sync.
    - Lock → apiPost("/api/escrow/lock") → on success, freeze + show tx hash.
```

## 5. `MobileShop` component (new)

### 5.1 Props

```ts
import type {
  BuilderInventoryItem,
  BuilderLineItem,
} from "@/app/(app)/family/WishlistBuilder";
import type { WishlistStatus } from "@/components/ui/StatusPill";

type MobileShopProps = {
  familyId: string;
  inventory: BuilderInventoryItem[];
  initialWishlistId: string | null;
  initialStatus: WishlistStatus | null;
  initialItems: BuilderLineItem[];
  initialEscrowTxHash: string | null;
};
```

### 5.2 State

```ts
const [wishlistId, setWishlistId] = useState<string | null>(initialWishlistId);
const [status, setStatus] = useState<WishlistStatus | null>(initialStatus);
const [items, setItems] = useState<BuilderLineItem[]>(initialItems);
const [escrowTxHash, setEscrowTxHash] = useState<string | null>(initialEscrowTxHash);
const [busyItemId, setBusyItemId] = useState<string | null>(null);
const [error, setError] = useState<string | null>(null);

const LOCKABLE: WishlistStatus[] = ["draft", "pending_approval"];
const editable = status === null || LOCKABLE.includes(status);
```

### 5.3 Layout

**(a) Header (sticky at top)**

```
Shop                                         (text-2xl font-extrabold)
Pick what you need; funds lock in escrow.    (text-sm text-[#6b7280])
```

**(b) Cart summary card** — only visible when `items.length > 0`:

White rounded-3xl card with:
- Row 1: "X items in cart" + total XLM (right-aligned, bold).
- Row 2 (if `editable`): big gradient button "Lock funds X XLM →".
- Row 2 (if NOT editable, e.g. status = locked|delivered|released):
  pill showing the status + tx-hash link to
  `https://stellar.expert/explorer/testnet/tx/<escrowTxHash>` + a
  small "Wait for delivery" subtitle.

**(c) Error banner** — visible when `error !== null`:

Red-tinted rounded-2xl alert card with the error message.

**(d) Inventory grid** — main scrollable body. For each category:

- Section heading: `<h3>` with the category name (e.g. "Groceries"),
  uppercase, small, muted.
- Grid of cards: 2-column (`grid-cols-2 gap-3`). Each card:
  - Name (sm, bold).
  - "X XLM / unit" (sm, muted).
  - "Stock: N" badge (10px, muted).
  - If already in cart: an "In cart × N" chip (small, accent).
  - Action button:
    - If NOT in cart and `editable`: `+` button (full-width, gradient).
    - If in cart and `editable`: `−` button + qty + `+` button in a
      small inline row.
    - If NOT `editable`: button disabled.
  - During add/remove: button shows spinner state (uses `busyItemId`).

### 5.4 Action handlers (logic mirrors web WishlistBuilder)

`async function addItem(inv: BuilderInventoryItem)`:
1. If `!editable`, return.
2. `setBusyItemId(inv.id)`.
3. Get-or-create draft wishlist via Supabase browser client (RLS
   handles family_id check via cookie session).
4. If item already in `items`, update its row's `quantity`. Else
   insert a new `wishlist_item` row with `quantity: 1`.
5. Update local `items` state.
6. `router.refresh()` in a transition.
7. `setBusyItemId(null)`.
8. On exception, `setError(e.message)`.

`async function removeItem(item: BuilderLineItem)`:
1. If `!editable`, return.
2. `setBusyItemId(item.id)`.
3. If `quantity > 1`, decrement via update. Else delete the row.
4. Update local `items` state.
5. `router.refresh()` + `setBusyItemId(null)`.

`async function lockFunds()`:
1. If `!wishlistId || items.length === 0 || !editable`, return.
2. `apiPost("/api/escrow/lock", { family_id: familyId, wishlist_id: wishlistId })`.
3. If `!ok`, `setError("Lock failed: " + message)`; return.
4. `setStatus("locked")`, `setEscrowTxHash(result.data.tx_hash)`.
5. `router.refresh()` so Orders + Activity tabs reflect.

These are line-for-line analogous to [WishlistBuilder.tsx:105-247](../../app/%28app%29/family/WishlistBuilder.tsx#L105-L247).

## 6. `MobileDashboardClient` updates

### 6.1 Imports

Add `ShoppingBag` from `lucide-react`. Add `MobileShop` import.

### 6.2 activeTab union

```ts
const [activeTab, setActiveTab] = useState<
  "home" | "send" | "shop" | "bills" | "orders" | "activity"
>("home");
```

(adds `"shop"`.)

### 6.3 Tab #2 in the bottom bar

Current:

```tsx
<TabItem icon={<TrendingUp />} label="Send" active={activeTab === "send"} onClick={() => setActiveTab("send")} />
```

After:

```tsx
{currentUserRole === "family" ? (
  <TabItem icon={<ShoppingBag />} label="Shop" active={activeTab === "shop"} onClick={() => setActiveTab("shop")} />
) : (
  <TabItem icon={<TrendingUp />} label="Send" active={activeTab === "send"} onClick={() => setActiveTab("send")} />
)}
```

### 6.4 Shop tab body

Inserted after the existing `bills` branch and before the `orders`
branch (keeps source order consistent with tab visual order):

```tsx
{activeTab === "shop" && familyData && (
  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
    <MobileShop
      familyId={familyData.family.id}
      inventory={familyData.inventory.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        price_stroops: i.price_stroops.toString(),
        stock: i.stock,
        unit: i.unit,
      }))}
      initialWishlistId={familyData.activeDraft?.wishlist.id ?? null}
      initialStatus={familyData.activeDraft?.wishlist.status ?? null}
      initialItems={
        familyData.activeDraft?.items.map((it) => ({
          id: it.id,
          inventory_id: it.inventory_id,
          inventory_name: it.inventory_name,
          inventory_unit: it.inventory_unit,
          quantity: it.quantity,
          price_stroops_at_add: it.price_stroops_at_add.toString(),
        })) ?? []
      }
      initialEscrowTxHash={familyData.activeDraft?.wishlist.escrow_tx_hash ?? null}
    />
  </div>
)}
```

### 6.5 Send tab body — preserved

The existing `activeTab === "send"` branch stays untouched. It only
renders when OFW is on the dashboard (tab is invisible to family).
If a family user somehow arrives with `activeTab === "send"` (state
preserved across role-switch demos), nothing renders for that branch
but the default Home view doesn't auto-restore — fine; they'll just
tap a visible tab.

## 7. `lib/dashboard/family.ts` update

### 7.1 Extend the settlement select

In the `settlement` query (around lib/dashboard/family.ts:239), add
the inline wishlist join:

```ts
supabase
  .from("settlement")
  .select(
    "id, wishlist_id, event_type, tx_hash, amount_stroops, created_at, " +
      "wishlist:wishlist_id (notes, status)",
  )
  .in("wishlist_id", wishlistIds)
  .order("created_at", { ascending: false }),
```

### 7.2 Update `FamilySettlementRow` type

```ts
import type { WishlistStatus, SettlementEvent } from "@/components/ui/StatusPill";

export interface FamilySettlementRow {
  id: string;
  wishlist_id: string;
  event_type: SettlementEvent;
  tx_hash: string;
  amount_stroops: bigint;
  created_at: string;
  wishlist_notes: string | null;
  wishlist_status: WishlistStatus | null;
}
```

### 7.3 Update the mapping

In the `.map` that converts `settlementsResult.data` to
`FamilySettlementRow`:

```ts
settlements = (settlementsResult.data ?? []).map((s) => {
  // Supabase's nested-join can return either a single object or an
  // array depending on the FK shape. Coerce defensively.
  const wishlist = Array.isArray((s as any).wishlist)
    ? (s as any).wishlist[0]
    : (s as any).wishlist;
  return {
    id: s.id as string,
    wishlist_id: s.wishlist_id as string,
    event_type: s.event_type as SettlementEvent,
    tx_hash: s.tx_hash as string,
    amount_stroops: toBig(s.amount_stroops),
    created_at: s.created_at as string,
    wishlist_notes: (wishlist?.notes as string | null) ?? null,
    wishlist_status: (wishlist?.status as WishlistStatus | null) ?? null,
  };
});
```

This pattern (array-or-object coercion) is documented in
NEEDED-UPDATES §5.2 — same issue the dashboard data shaping already
has on the web.

## 8. Edge cases & error handling

| Case | Behavior |
|---|---|
| Family has no inventory loaded (store hasn't added anything) | Shop renders the cart summary (if any items) + an empty state in the grid: "No items in stock — check back later." |
| Family adds an item but stock is 0 | The web allows the add (stock is informational, not enforced). Mobile matches — we display the stock badge but don't gate adds on it. |
| Family taps Lock funds while the demo signer is misconfigured | `/api/escrow/lock` returns `contract_not_configured` or similar; `setError` shows it in the red banner. The wishlist stays at `draft`. |
| Family signs out mid-cart | Their draft persists in DB. Next sign-in re-loads it via `familyData.activeDraft`. |
| Family is on Shop tab and their wishlist gets locked by another tab (multi-device) | The local optimistic state is stale until `router.refresh()` fires (next tab switch). Acceptable for demo. |
| Add-item Supabase write fails (RLS denies, network drop) | Local items state stays consistent (we only update after the write succeeds); the red error banner shows the message. |
| `wishlistId` is null and items.length === 0 and family taps Lock funds | Function returns early — Lock button isn't rendered anyway when items is empty. |
| Inventory has items in a new category not in [Groceries, Utilities, Emergency] | We don't hardcode the categories — group by whatever `category` field returns. Same as web. |
| Family Activity row with `wishlist_notes === null` (orphaned settlement after wishlist delete) | MobileActivity falls back to "Untitled wishlist" (already handled by Phase 2's component). |

## 9. Manual smoke-test checklist

Chrome DevTools "Toggle device toolbar" + iPhone 14 Pro, log in as
Cora (family):

1. Land on `/mobile/family`. Confirm bottom bar shows: Home / **Shop**
   / Bills / Orders / Activity. The 2nd-slot icon should be the
   shopping-bag, not the up-arrow.
2. Tap **Shop**. Inventory grid renders, grouped by category. Cart
   summary card is hidden (empty cart).
3. Tap `+` on an inventory item (e.g. "Rice 5kg"). Brief spinner;
   then the card shows "In cart × 1" and the top cart summary card
   appears with the item count + XLM total + "Lock funds X XLM"
   button.
4. Tap `+` on the same item again. Card shows "In cart × 2"; cart
   total doubles.
5. Tap `−` until quantity reaches 0. The item leaves the cart;
   summary updates.
6. Add 2-3 items. Tap **Lock funds X XLM**. Brief loading state;
   then the cart summary changes: status pill shows "Locked", a
   stellar.expert link to the tx hash, and the `+`/`−` controls on
   inventory cards become disabled. (If a `contract_not_configured`
   error happens because demo signer isn't set, that's OK for the
   smoke test — verify the error banner shows.)
7. Tap **Orders** tab. The just-locked wishlist appears in the
   in-flight list with status "locked".
8. Tap **Activity** tab. The corresponding `lock` event appears in
   the timeline with its proper wishlist label ("Rice 5kg + Cooking
   Oil + ..." — whatever the family typed as notes, falling back to
   "Untitled wishlist" if no notes).
9. Sign out, log in as Maria (OFW). Confirm tab #2 is **Send** (not
   Shop) — role-aware swap working.
10. Run `npm run test:device`. Expect 9/9 pass.

## 10. Open questions (resolved)

### 10.1 Should Shop have its own wishlist or share Orders' rows?

Decision: Shop edits the **active draft** (single wishlist with
status `draft|pending_approval`). Orders tab shows all wishlists
(including locked, delivered, released). They're the same DB rows
seen from two angles — Shop is the editor view, Orders is the
status/history view. This mirrors web.

### 10.2 Should the lock-funds button live in Shop or Orders?

Decision: **Shop**, alongside the cart. Locking is the act of
"checking out" — it belongs next to the cart, not in a separate
tab. Once locked, the wishlist moves "down" into Orders' purview
visually; Shop's cart summary then shows the read-only locked
state with the tx hash.

### 10.3 Why extend the family settlement loader instead of joining
on the client?

The loader is already doing the parallel queries pattern. Adding
one nested column to the existing `select()` is cheap (single
ledger of fields) and matches the OFW loader's pattern exactly
(see `lib/dashboard/ofw.ts:262` for the equivalent
`wishlist:wishlist_id (notes, status)` join). Keeps both loaders
shape-aligned.

## 11. Cross-references

- Master plan: [docs/specs/2026-05-21-mobile-phase-0-1-design.md §10](2026-05-21-mobile-phase-0-1-design.md)
  (this is the Phase 3 deferred there).
- Phase 2 spec: [docs/specs/2026-05-22-mobile-phase-2-design.md](2026-05-22-mobile-phase-2-design.md).
- Web family dashboard: [app/(app)/family/page.tsx](../../app/%28app%29/family/page.tsx) — sections to mirror.
- Web WishlistBuilder (logic source of truth): [app/(app)/family/WishlistBuilder.tsx](../../app/%28app%29/family/WishlistBuilder.tsx).
- Family data loader: [lib/dashboard/family.ts](../../lib/dashboard/family.ts) — extending the settlement select.
- OFW loader's settlement join (pattern reference): [lib/dashboard/ofw.ts:262](../../lib/dashboard/ofw.ts#L262).
- Escrow lock route: [app/api/escrow/lock/route.ts](../../app/api/escrow/lock/route.ts) — unchanged; called from `apiPost`.
- Existing mobile dashboard: [app/mobile/MobileDashboardClient.tsx](../../app/mobile/MobileDashboardClient.tsx).
- Existing MobileActivity (Phase 2): [app/mobile/components/MobileActivity.tsx](../../app/mobile/components/MobileActivity.tsx) — will start showing real wishlist labels for family rows after §7 lands.

## 12. Phase 4 status (not in scope here)

Still deferred:

- **Phase 4** — Store role mobile dashboard. Replace the
  `/mobile/store` placeholder with a real dashboard: stats overview,
  pending order queue (approve/lock), locked orders (mark delivered),
  inventory CRUD, activity/receipts.
