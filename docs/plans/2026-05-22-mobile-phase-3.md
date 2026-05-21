# Mobile Parity Phase 3 (Family Shop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mobile Shop tab for family users so they can browse store inventory, add/remove items to a draft wishlist, and lock funds via the existing escrow API — closing the last family-side gap with the web `WishlistBuilder`. Also fix the family Activity tab so settlement rows show proper wishlist labels instead of "Untitled wishlist".

**Architecture:** New `MobileShop` client component (mobile twin of web `WishlistBuilder`) calls the same Supabase RLS writes + `/api/escrow/lock` route. `MobileDashboardClient` role-swaps tab #2: family sees Shop, OFW sees Send (existing 5-tab layout preserved). One additive change to `lib/dashboard/family.ts` adds the wishlist-notes join to the settlement query.

**Tech Stack:** Next.js 14 App Router (TypeScript), React 18.3, `@supabase/ssr` browser client (RLS-bound), `lucide-react` icons, existing `apiPost` helper. No new dependencies.

**Spec reference:** [docs/specs/2026-05-22-mobile-phase-3-design.md](../specs/2026-05-22-mobile-phase-3-design.md)

---

## Working Directory Convention

All commands run from the repo root `c:\Users\user\Downloads\InternStellar-Hackathon`. The harness's CWD is already this directory.

---

## Pre-flight State Confirmation

- [ ] **Verify clean tree on main**

Run: `git status --short && git branch --show-current`

Expected:
```
?? docs/plans/2026-05-22-mobile-phase-3.md
?? docs/specs/2026-05-22-mobile-phase-3-design.md
main
```

If other modifications appear, surface to operator before continuing.

- [ ] **Verify spec exists**

Run: `ls docs/specs/2026-05-22-mobile-phase-3-design.md`

Expected: file prints.

- [ ] **Create feature branch**

Run: `git checkout -b feat/mobile-phase-3`

Expected: `Switched to a new branch 'feat/mobile-phase-3'`.

- [ ] **Commit baseline docs**

Run:
```
git add docs/specs/2026-05-22-mobile-phase-3-design.md docs/plans/2026-05-22-mobile-phase-3.md
git commit -m "$(cat <<'EOF'
docs(mobile): add Phase 3 (family Shop) spec and implementation plan

Spec: new MobileShop component + role-aware tab swap + settlement
loader extension for wishlist labels.
Plan: 4 tasks, ~280 net lines across 3 files.

Spec: docs/specs/2026-05-22-mobile-phase-3-design.md
Plan: docs/plans/2026-05-22-mobile-phase-3.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1: Extend `lib/dashboard/family.ts` settlement loader

**Files:**
- Modify: `lib/dashboard/family.ts`

Adds the `wishlist:wishlist_id (notes, status)` join to the existing
settlement select so `FamilySettlementRow` carries the same
`wishlist_notes` + `wishlist_status` fields that `SettlementRow` on
the OFW side has. After this lands, `MobileActivity` (built in Phase 2)
starts showing real wishlist labels for family users without any UI
change.

- [ ] **Step 1.1: Extend the type**

In `lib/dashboard/family.ts`, find the `FamilySettlementRow` interface
(near the top of the file, just above `InventoryItem`):

```ts
export interface FamilySettlementRow {
  id: string;
  wishlist_id: string;
  event_type: SettlementEvent;
  tx_hash: string;
  amount_stroops: bigint;
  created_at: string;
}
```

Replace with:

```ts
export interface FamilySettlementRow {
  id: string;
  wishlist_id: string;
  event_type: SettlementEvent;
  tx_hash: string;
  amount_stroops: bigint;
  created_at: string;
  /** Inlined from the parent wishlist so MobileActivity can label
   *  rows without a second lookup. Null when the wishlist row is
   *  gone (settlement is intentionally not cascaded — same as OFW). */
  wishlist_notes: string | null;
  wishlist_status: WishlistStatus | null;
}
```

The `WishlistStatus` type is already imported at the top of the file:

```ts
import type { WishlistStatus, SettlementEvent } from "@/components/ui/StatusPill";
```

Confirm with: `grep -n "WishlistStatus" lib/dashboard/family.ts | head -2`

Expected: at least one import line printing.

- [ ] **Step 1.2: Extend the settlement select**

In the same file, find the settlement query (around line 239):

```ts
      supabase
        .from("settlement")
        .select("id, wishlist_id, event_type, tx_hash, amount_stroops, created_at")
        .in("wishlist_id", wishlistIds)
        .order("created_at", { ascending: false }),
```

Replace with:

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

- [ ] **Step 1.3: Update the row mapping**

In the same file, find the `settlements = (settlementsResult.data ?? []).map((s) => ({` block (around line 257):

```ts
    settlements = (settlementsResult.data ?? []).map((s) => ({
      id: s.id as string,
      wishlist_id: s.wishlist_id as string,
      event_type: s.event_type as SettlementEvent,
      tx_hash: s.tx_hash as string,
      amount_stroops: toBig(s.amount_stroops),
      created_at: s.created_at as string,
    }));
```

Replace with:

```ts
    settlements = (settlementsResult.data ?? []).map((s) => {
      // Supabase nested-join can return either a single object or an
      // array depending on FK shape. Coerce defensively — same pattern
      // the OFW loader uses (see lib/dashboard/ofw.ts).
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

- [ ] **Step 1.4: Smoke test the family route still compiles**

Run (background): `npm run dev`. Wait ~7 seconds.

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "family=%{http_code}\n" http://localhost:3000/mobile/family
curl -s -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120" -o /dev/null -w "web-family=%{http_code}\n" http://localhost:3000/family
```

Expected:
```
family=307
web-family=307
```

(Both 307 because the auth gate redirects — that's fine; it confirms
the routes compile.)

Read the dev log. Expect:
- `✓ Compiled /mobile/family in ...` no errors.
- `✓ Compiled /family in ...` no errors.
- No errors mentioning `FamilySettlementRow`, `wishlist_notes`, or
  `WishlistStatus`.

Stop dev (PowerShell):
`Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 1.5: Commit**

Run:
```
git add lib/dashboard/family.ts
git commit -m "$(cat <<'EOF'
feat(mobile): extend family settlement loader with wishlist join

Adds wishlist_notes + wishlist_status to FamilySettlementRow by
joining the parent wishlist row in the settlement select. Mirrors
the OFW loader's pattern exactly (lib/dashboard/ofw.ts:262).

Phase 2's MobileActivity component already expects these fields on
the row shape; this change lets family users see proper wishlist
labels in the Activity tab instead of every row saying "Untitled
wishlist". Web /family is unaffected (additive query change).

Spec: docs/specs/2026-05-22-mobile-phase-3-design.md section 7

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `MobileShop` component

**Files:**
- Create: `app/mobile/components/MobileShop.tsx`

Big file — mobile twin of `WishlistBuilder`. Logic is line-for-line
analogous to the web component's `addItem` / `removeItem` /
`lockFunds`; only the visual surface differs.

- [ ] **Step 2.1: Create the component**

Create `app/mobile/components/MobileShop.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, ArrowUpRight, Lock, Minus, Plus } from "lucide-react";

import { apiPost } from "@/lib/api/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatXlm, formatXlmWithUnit, truncateHash } from "@/lib/format-xlm";
import type {
  BuilderInventoryItem,
  BuilderLineItem,
} from "@/app/(app)/family/WishlistBuilder";
import type { WishlistStatus } from "@/components/ui/StatusPill";

/**
 * Mobile family Shop — inventory grid + cart + lock-funds CTA.
 *
 * Mirrors app/(app)/family/WishlistBuilder.tsx with mobile-flat
 * visuals. The write paths are identical:
 *   - Add / Remove → Supabase browser client (RLS-bound via cookie).
 *   - Lock funds → apiPost to /api/escrow/lock (Bearer JWT to the
 *     existing route; calls Soroban contract).
 *
 * After every successful write we router.refresh() so the rest of
 * the dashboard (totals, Orders tab, Activity tab) re-renders with
 * the server's view.
 */

const LOCKABLE_STATUSES: WishlistStatus[] = ["draft", "pending_approval"];

type MobileShopProps = {
  familyId: string;
  inventory: BuilderInventoryItem[];
  initialWishlistId: string | null;
  initialStatus: WishlistStatus | null;
  initialItems: BuilderLineItem[];
  initialEscrowTxHash: string | null;
};

export function MobileShop({
  familyId,
  inventory,
  initialWishlistId,
  initialStatus,
  initialItems,
  initialEscrowTxHash,
}: MobileShopProps) {
  const router = useRouter();
  const [wishlistId, setWishlistId] = useState<string | null>(initialWishlistId);
  const [status, setStatus] = useState<WishlistStatus | null>(initialStatus);
  const [items, setItems] = useState<BuilderLineItem[]>(initialItems);
  const [escrowTxHash, setEscrowTxHash] = useState<string | null>(initialEscrowTxHash);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const editable = status === null || LOCKABLE_STATUSES.includes(status);
  const totalStroops = items.reduce<bigint>(
    (sum, it) => sum + BigInt(it.price_stroops_at_add) * BigInt(it.quantity),
    0n,
  );

  // Map from inventory_id → current qty in cart, for the "+/-" controls.
  const inCartByInventoryId = new Map<string, BuilderLineItem>();
  for (const it of items) {
    inCartByInventoryId.set(it.inventory_id, it);
  }

  // Group inventory by category.
  const byCategory = new Map<string, BuilderInventoryItem[]>();
  for (const item of inventory) {
    const arr = byCategory.get(item.category);
    if (arr) arr.push(item);
    else byCategory.set(item.category, [item]);
  }

  async function addItem(inv: BuilderInventoryItem) {
    if (!editable) return;
    setError(null);
    setBusyItemId(inv.id);
    try {
      const supabase = createSupabaseBrowserClient();

      // Get-or-create the draft wishlist on first add.
      let wid = wishlistId;
      if (!wid) {
        const { data: newWishlist, error: wErr } = await supabase
          .from("wishlist")
          .insert({ family_id: familyId, status: "draft", total_stroops: 0 })
          .select("id, status")
          .single();
        if (wErr || !newWishlist) {
          throw new Error(wErr?.message ?? "Could not create wishlist.");
        }
        wid = newWishlist.id as string;
        setWishlistId(wid);
        setStatus(newWishlist.status as WishlistStatus);
      }

      // Bump qty if already present, else insert.
      const existing = items.find((it) => it.inventory_id === inv.id);
      if (existing) {
        const { data: updated, error: uErr } = await supabase
          .from("wishlist_item")
          .update({ quantity: existing.quantity + 1 })
          .eq("id", existing.id)
          .select("id, quantity")
          .single();
        if (uErr || !updated) {
          throw new Error(uErr?.message ?? "Could not increment quantity.");
        }
        setItems((prev) =>
          prev.map((it) =>
            it.id === existing.id
              ? { ...it, quantity: updated.quantity as number }
              : it,
          ),
        );
      } else {
        const { data: inserted, error: iErr } = await supabase
          .from("wishlist_item")
          .insert({
            wishlist_id: wid,
            inventory_id: inv.id,
            quantity: 1,
            price_stroops_at_add: inv.price_stroops,
          })
          .select("id, inventory_id, quantity, price_stroops_at_add")
          .single();
        if (iErr || !inserted) {
          throw new Error(iErr?.message ?? "Could not add item.");
        }
        setItems((prev) => [
          ...prev,
          {
            id: inserted.id as string,
            inventory_id: inserted.inventory_id as string,
            inventory_name: inv.name,
            inventory_unit: inv.unit,
            quantity: Number(inserted.quantity),
            price_stroops_at_add: String(inserted.price_stroops_at_add),
          },
        ]);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function removeItem(item: BuilderLineItem) {
    if (!editable) return;
    setError(null);
    setBusyItemId(item.id);
    try {
      const supabase = createSupabaseBrowserClient();
      if (item.quantity > 1) {
        const { data: updated, error: uErr } = await supabase
          .from("wishlist_item")
          .update({ quantity: item.quantity - 1 })
          .eq("id", item.id)
          .select("id, quantity")
          .single();
        if (uErr || !updated) {
          throw new Error(uErr?.message ?? "Could not decrement quantity.");
        }
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, quantity: updated.quantity as number } : it,
          ),
        );
      } else {
        const { error: dErr } = await supabase
          .from("wishlist_item")
          .delete()
          .eq("id", item.id);
        if (dErr) throw new Error(dErr.message);
        setItems((prev) => prev.filter((it) => it.id !== item.id));
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function lockFunds() {
    if (!wishlistId || items.length === 0 || !editable) return;
    setError(null);
    setLocking(true);
    try {
      const result = await apiPost<{
        tx_hash: string;
        status: string;
        amount_stroops: string;
      }>("/api/escrow/lock", {
        family_id: familyId,
        wishlist_id: wishlistId,
      });
      if (!result.ok) {
        setError(`Lock failed: ${result.message}`);
        return;
      }
      setStatus("locked");
      setEscrowTxHash(result.data.tx_hash);
      startTransition(() => router.refresh());
    } finally {
      setLocking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold mb-2">Shop</h2>
        <p className="text-sm text-[#6b7280] leading-relaxed">
          Pick what you need; funds lock in escrow until delivery.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm rounded-2xl font-medium border border-red-100">
          {error}
        </div>
      )}

      {items.length > 0 && (
        <div className="p-5 bg-white border border-black/5 shadow-sm rounded-3xl">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] uppercase tracking-widest text-[#6b7280] font-bold">
              In your cart
            </p>
            <p className="text-sm font-bold text-[#1a1d2e]">
              {items.length} item{items.length === 1 ? "" : "s"} ·{" "}
              {formatXlmWithUnit(totalStroops)}
            </p>
          </div>

          {!editable && escrowTxHash ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">
                  <Lock className="w-3 h-3" />
                  {status === "locked"
                    ? "Locked — awaiting delivery"
                    : (status ?? "locked")}
                </span>
              </div>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${escrowTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-mono text-[#5b7cff] hover:underline"
              >
                {truncateHash(escrowTxHash, 12, 8)}
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <button
              type="button"
              onClick={lockFunds}
              disabled={locking || items.length === 0}
              className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {locking
                ? "Locking…"
                : `Lock funds ${formatXlm(totalStroops)} XLM`}
              {!locking && <ArrowRight className="w-4 h-4" />}
            </button>
          )}
        </div>
      )}

      {inventory.length === 0 ? (
        <div className="p-8 text-center bg-white border border-black/5 rounded-3xl">
          <p className="text-sm text-[#6b7280]">
            No items in stock — check back later.
          </p>
        </div>
      ) : (
        Array.from(byCategory.entries()).map(([category, catItems]) => (
          <section key={category}>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#6b7280] ml-2 mb-2">
              {categoryLabel(category)}
            </h3>
            <ul className="grid grid-cols-2 gap-3">
              {catItems.map((inv) => {
                const inCart = inCartByInventoryId.get(inv.id);
                return (
                  <li
                    key={inv.id}
                    className="p-3 bg-white border border-black/5 shadow-sm rounded-3xl flex flex-col gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#1a1d2e] truncate">
                        {inv.name}
                      </p>
                      <p className="text-[11px] text-[#6b7280] mt-0.5">
                        {formatXlm(BigInt(inv.price_stroops))} XLM
                        {inv.unit ? ` / ${inv.unit}` : ""}
                      </p>
                      <p className="text-[10px] text-[#9ca3af] mt-1">
                        Stock: {inv.stock}
                      </p>
                    </div>
                    {inCart ? (
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => removeItem(inCart)}
                          disabled={!editable || busyItemId === inCart.id}
                          aria-label={`Remove ${inv.name}`}
                          className="w-8 h-8 rounded-full bg-[#f5f7fa] flex items-center justify-center disabled:opacity-50"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-bold text-[#1a1d2e]">
                          {inCart.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => addItem(inv)}
                          disabled={!editable || busyItemId === inv.id}
                          aria-label={`Add ${inv.name}`}
                          className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] text-white flex items-center justify-center disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addItem(inv)}
                        disabled={!editable || busyItemId === inv.id}
                        aria-label={`Add ${inv.name}`}
                        className="w-full py-2 rounded-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function categoryLabel(category: string): string {
  // Title-case the category. Inventory category strings are short
  // free-text from the store (groceries / utilities / emergency etc.).
  return category.charAt(0).toUpperCase() + category.slice(1);
}
```

- [ ] **Step 2.2: Verify it parses**

Run (background): `npm run dev`. Wait ~7 seconds.

Read the dev log. Expect no errors mentioning `MobileShop`,
`BuilderInventoryItem`, `BuilderLineItem`, or `WishlistStatus`.
(No route renders the component yet — it's only typecheck-imported.)

Stop dev (PowerShell):
`Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 2.3: Commit**

Run:
```
git add app/mobile/components/MobileShop.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add MobileShop -- inventory grid + cart + lock CTA

Mobile twin of app/(app)/family/WishlistBuilder.tsx. Identical write
paths:
  - Add/Remove items: Supabase browser client with RLS (cookie-bound).
  - Lock funds: apiPost to existing /api/escrow/lock route.

Inventory rendered as a 2-column grid grouped by category. Cart
summary card at top shows item count + total + gradient Lock CTA
when editable; shows status pill + tx-hash link when locked.

Reuses BuilderInventoryItem + BuilderLineItem types from
WishlistBuilder for shape parity between the two surfaces.

Wired into MobileDashboardClient in the next commit.

Spec: docs/specs/2026-05-22-mobile-phase-3-design.md section 5

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `MobileDashboardClient` — role-aware tab swap + Shop body

**Files:**
- Modify: `app/mobile/MobileDashboardClient.tsx`

Three coordinated edits in one file: add `ShoppingBag` icon + import
`MobileShop`, extend the `activeTab` union to include `"shop"`,
swap tab #2 in the bottom bar, mount the Shop body branch.

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
  ArrowRight,
  History
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
  History,
  ShoppingBag
} from "lucide-react";
```

Find:

```tsx
import { MobileSendFunds } from "./components/MobileSendFunds";
import { MobileBills } from "./components/MobileBills";
import { MobileWishlists } from "./components/MobileWishlists";
import { MobileActivity } from "./components/MobileActivity";
import { formatXlmWithUnit, formatXlm } from "@/lib/format-xlm";
```

Insert one new import directly after `MobileActivity`:

```tsx
import { MobileSendFunds } from "./components/MobileSendFunds";
import { MobileBills } from "./components/MobileBills";
import { MobileWishlists } from "./components/MobileWishlists";
import { MobileActivity } from "./components/MobileActivity";
import { MobileShop } from "./components/MobileShop";
import { formatXlmWithUnit, formatXlm } from "@/lib/format-xlm";
```

- [ ] **Step 3.2: Extend activeTab union to include "shop"**

Find:

```tsx
  const [activeTab, setActiveTab] = useState<
    "home" | "send" | "bills" | "orders" | "activity"
  >("home");
```

Replace with:

```tsx
  const [activeTab, setActiveTab] = useState<
    "home" | "send" | "shop" | "bills" | "orders" | "activity"
  >("home");
```

- [ ] **Step 3.3: Add Shop tab body branch**

Locate the existing `bills` tab body block:

```tsx
        {activeTab === "bills" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <MobileBills 
              ofwId={ofwData?.ofw.id || currentUserId}
              familyId={familyData?.family.id}
              bills={ofwData?.bills || familyData?.bills || []} 
            />
          </div>
        )}
```

Directly **above** that block, add the Shop branch:

```tsx
        {activeTab === "shop" && familyData && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <MobileShop
              familyId={familyData.family.id}
              inventory={familyData.inventory.map((i: any) => ({
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
                familyData.activeDraft?.items.map((it: any) => ({
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

(The `(i: any)` and `(it: any)` casts mirror the existing pattern in
the same file — the dashboard data types use `any` at boundaries to
sidestep Supabase's array-vs-object nested-join shape. Consistent
with how the Bills branch already does this.)

- [ ] **Step 3.4: Role-aware tab #2 in the bottom bar**

Find the bottom tab bar:

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

Replace the `<TabItem icon={<TrendingUp />}` line with the role-aware
swap:

```tsx
      {/* Bottom Tab Bar */}
      <div className="absolute bottom-0 w-full bg-white border-t border-black/5 px-4 pb-safe pt-3 pb-6 flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-50">
        <TabItem icon={<Home />} label="Home" active={activeTab === "home"} onClick={() => setActiveTab("home")} />
        {currentUserRole === "family" ? (
          <TabItem icon={<ShoppingBag />} label="Shop" active={activeTab === "shop"} onClick={() => setActiveTab("shop")} />
        ) : (
          <TabItem icon={<TrendingUp />} label="Send" active={activeTab === "send"} onClick={() => setActiveTab("send")} />
        )}
        <TabItem icon={<CreditCard />} label="Bills" active={activeTab === "bills"} onClick={() => setActiveTab("bills")} />
        <TabItem icon={<Package />} label="Orders" active={activeTab === "orders"} onClick={() => setActiveTab("orders")} />
        <TabItem icon={<History />} label="Activity" active={activeTab === "activity"} onClick={() => setActiveTab("activity")} />
      </div>
```

- [ ] **Step 3.5: Smoke test routes still compile**

Run (background): `npm run dev`. Wait ~8 seconds.

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "ofw=%{http_code}\n" http://localhost:3000/mobile/ofw
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "family=%{http_code}\n" http://localhost:3000/mobile/family
```

Expected: both `307` (auth-redirect).

Read the dev log. Expect:
- `✓ Compiled /mobile/ofw` no errors.
- `✓ Compiled /mobile/family` no errors.
- No errors mentioning `MobileShop`, `ShoppingBag`, or `activeDraft`.

Stop dev (PowerShell):
`Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 3.6: Commit**

Run:
```
git add app/mobile/MobileDashboardClient.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): role-aware tab #2 -- family gets Shop, OFW gets Send

Dashboard's 2nd bottom-bar slot now rotates by role:
  family -> ShoppingBag/Shop -> mounts MobileShop with the family's
            inventory + active draft.
  ofw    -> TrendingUp/Send  -> mounts MobileSendFunds (unchanged).

activeTab state extended with "shop". Shop body branch stringifies
bigints at the server->client boundary using the same pattern web
/family already uses.

Slots 1/3/4/5 (Home/Bills/Orders/Activity) stay role-invariant.

Spec: docs/specs/2026-05-22-mobile-phase-3-design.md section 6

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: End-to-end smoke test

No code changes. Walks the spec §9 checklist.

- [ ] **Step 4.1: Start dev server**

Run (background): `npm run dev`. Wait until "Ready" appears (~7 sec).

- [ ] **Step 4.2: Verify both dashboards compile clean**

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "ofw=%{http_code}\n" http://localhost:3000/mobile/ofw
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "family=%{http_code}\n" http://localhost:3000/mobile/family
curl -s -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120" -o /dev/null -w "web-family=%{http_code}\n" http://localhost:3000/family
```

Expected:
```
ofw=307
family=307
web-family=307
```

(All 307 because of auth redirect — confirms compilation.)

- [ ] **Step 4.3: Inspect dev log**

Read the dev server output file.

Expected: every route shows `✓ Compiled ...`; no `Module not found`,
no `Type error`, no `Cannot find name 'BuilderInventoryItem'`.

- [ ] **Step 4.4: Device unit test still passes**

Run: `npm run test:device`

Expected: `9 passed, 0 failed`.

- [ ] **Step 4.5: Stop dev server**

Run (PowerShell): `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 4.6: Manual browser walk-through (required)**

Open Chrome → DevTools → Toggle device toolbar → iPhone 14 Pro →
hard refresh `http://localhost:3000/`. Walk the spec §9 checklist:

1. Mobile landing → tap **Log in** → land on `/mobile/login`.
2. Sign in as **Lola Cora** (family). Land on `/mobile/family`.
   Bottom bar shows: Home / **Shop** (shopping-bag icon) / Bills /
   Orders / Activity.
3. Tap **Shop**. Inventory grid renders, grouped by category.
   Cart summary card is hidden (empty cart).
4. Tap `+` on an inventory item (e.g. "Rice 5kg"). Cart summary
   card appears at top with count + XLM total + gradient "Lock funds
   X XLM →" button.
5. Tap `+` on the same item again. The card switches from a single
   "Add" button to a `−` / qty / `+` row. Cart qty bumps.
6. Tap `−` until qty hits 0. Item leaves the cart; if cart empties,
   summary card disappears.
7. Add 2-3 items. Tap **Lock funds X XLM**. Brief "Locking…" state;
   then the cart summary changes to show a "Locked — awaiting
   delivery" pill and a stellar.expert link to the tx hash. The
   `+`/`−` controls on inventory cards become disabled.
   (If `/api/escrow/lock` returns an error because of testnet/signer
   misconfiguration, the red banner shows it — verify the error
   surfaces correctly.)
8. Tap **Orders** tab. The just-locked wishlist appears in the
   in-flight list with status "locked".
9. Tap **Activity** tab. The lock event appears in the timeline.
   The wishlist label is no longer "Untitled wishlist" — it shows
   the wishlist's notes (or "Untitled wishlist" only when notes
   are truly null).
10. Sign out, log in as **Auntie Maria** (OFW). Land on
    `/mobile/ofw`. Confirm bottom bar shows: Home / **Send**
    (trending-up icon) / Bills / Orders / Activity. Shop tab is not
    visible to OFW.
11. As OFW, tap **Activity** — still works (Phase 2 functionality
    intact).

If any step fails visually, capture as a follow-up before merging.

---

## Done

All 4 tasks complete. The repo now has:

- A `MobileShop` component letting family users browse inventory,
  add/remove items to a draft wishlist, and lock funds via escrow.
- A role-aware tab #2 in the mobile dashboard: family sees Shop,
  OFW sees Send.
- A loader extension giving family Activity rows proper wishlist
  labels.

Next: invoke `superpowers:finishing-a-development-branch` to verify
tests, choose merge/PR, and clean up.
