# Mobile Parity Phase 4 (Store Dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/mobile/store` placeholder with a complete mobile store dashboard — welcome + stats, create-order form, pending/locked/delivered/settled order queues with Mark-Delivered, inventory list with inline stock+price edit, and the on-chain activity timeline — so store users can run their workflow entirely from mobile.

**Architecture:** New parallel `MobileStoreDashboardClient` (separate from `MobileDashboardClient` because store has no Send/Shop/Bills). 4-tab layout (Home / Orders / Inventory / Activity). Reuses existing server action (`storeUpdateInventory`) + API route (`/api/store/orders/create`) + direct Supabase write (Mark Delivered) + Phase 2's `MobileActivity` component. One additive change to `lib/dashboard/store.ts` for wishlist label joins.

**Tech Stack:** Next.js 14 App Router (TypeScript), React 18.3, `@supabase/ssr` browser client (RLS-bound), `lucide-react` icons, existing `apiPost` helper. No new dependencies.

**Spec reference:** [docs/specs/2026-05-22-mobile-phase-4-design.md](../specs/2026-05-22-mobile-phase-4-design.md)

---

## Working Directory Convention

All commands run from the repo root `c:\Users\user\Downloads\InternStellar-Hackathon`. The harness's CWD is already this directory.

---

## Pre-flight State Confirmation

- [ ] **Verify clean tree on main**

Run: `git status --short && git branch --show-current`

Expected:
```
?? docs/plans/2026-05-22-mobile-phase-4.md
?? docs/specs/2026-05-22-mobile-phase-4-design.md
main
```

If other modifications appear, surface to operator before continuing.

- [ ] **Verify spec exists**

Run: `ls docs/specs/2026-05-22-mobile-phase-4-design.md`

Expected: file prints.

- [ ] **Create feature branch**

Run: `git checkout -b feat/mobile-phase-4`

Expected: `Switched to a new branch 'feat/mobile-phase-4'`.

- [ ] **Commit baseline docs**

Run:
```
git add docs/specs/2026-05-22-mobile-phase-4-design.md docs/plans/2026-05-22-mobile-phase-4.md
git commit -m "$(cat <<'EOF'
docs(mobile): add Phase 4 (store dashboard) spec and implementation plan

Spec: replace /mobile/store placeholder with full dashboard.
Plan: 7 tasks across 5 new files + 2 edits, ~1000 net lines.

Spec: docs/specs/2026-05-22-mobile-phase-4-design.md
Plan: docs/plans/2026-05-22-mobile-phase-4.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1: Extend `lib/dashboard/store.ts` settlement loader

**Files:**
- Modify: `lib/dashboard/store.ts`

Mirrors the Phase 3 family fix. Without this, store's Activity tab would render every row as "Untitled wishlist".

- [ ] **Step 1.1: Extend `StoreSettlementRow` type**

Find:

```ts
export interface StoreSettlementRow {
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
export interface StoreSettlementRow {
  id: string;
  wishlist_id: string;
  event_type: SettlementEvent;
  tx_hash: string;
  amount_stroops: bigint;
  created_at: string;
  /** Inlined from the parent wishlist so MobileActivity can label
   *  rows without a second lookup. Null when the wishlist row is
   *  gone (settlement is intentionally not cascaded). */
  wishlist_notes: string | null;
  wishlist_status: WishlistStatus | null;
}
```

Confirm `WishlistStatus` is imported (it should be, near the top with `SettlementEvent`):

```
grep -n "WishlistStatus" lib/dashboard/store.ts | head -2
```

Expected: at least one import line. If missing, add:

```ts
import type { WishlistStatus, SettlementEvent } from "@/components/ui/StatusPill";
```

- [ ] **Step 1.2: Extend the settlement select**

Find (around line 194):

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

Find (around line 230):

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

- [ ] **Step 1.4: Smoke test the store route still compiles**

Run (background): `npm run dev`. Wait ~7 seconds.

Run:
```
curl -s -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120" -o /dev/null -w "web-store=%{http_code}\n" http://localhost:3000/store
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "mobile-store=%{http_code}\n" http://localhost:3000/mobile/store
```

Expected:
```
web-store=307
mobile-store=200
```

(Web `/store` 307 because auth gate. Mobile placeholder still 200.)

Read the dev log. Expect no errors mentioning `StoreSettlementRow` or `WishlistStatus`.

Stop dev (PowerShell):
`Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 1.5: Commit**

Run:
```
git add lib/dashboard/store.ts
git commit -m "$(cat <<'EOF'
feat(mobile): extend store settlement loader with wishlist join

Adds wishlist_notes + wishlist_status to StoreSettlementRow by
joining the parent wishlist row in the settlement select. Mirrors
the family loader's pattern (Phase 3) and the OFW loader's.

Phase 2's MobileActivity component already expects these fields;
this change lets store users see proper wishlist labels in the
Activity tab. Web /store is unaffected (additive query change).

Spec: docs/specs/2026-05-22-mobile-phase-4-design.md section 9

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `MobileStoreInventory` component

**Files:**
- Create: `app/mobile/store/components/MobileStoreInventory.tsx`

Standalone component — inventory list with inline expand-to-edit per
card. Reuses existing `storeUpdateInventory` server action.

- [ ] **Step 2.1: Create the component**

Create `app/mobile/store/components/MobileStoreInventory.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";

import { storeUpdateInventory } from "@/app/(app)/store/actions";
import { formatXlm, parseXlmToStroops } from "@/lib/format-xlm";

/**
 * Mobile inventory list with inline expand-to-edit per card.
 * Reuses the existing storeUpdateInventory server action (ownership
 * check + admin write). Simpler than web's 3-mode view/edit/confirm
 * card — mobile has just view ↔ edit.
 */

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  /** Stringified bigint for the server→client boundary. */
  price_stroops: string;
  stock: number;
  unit: string | null;
};

type MobileStoreInventoryProps = {
  inventory: InventoryItem[];
};

export function MobileStoreInventory({ inventory }: MobileStoreInventoryProps) {
  // Group by category for visual grouping.
  const byCategory = new Map<string, InventoryItem[]>();
  for (const item of inventory) {
    const arr = byCategory.get(item.category);
    if (arr) arr.push(item);
    else byCategory.set(item.category, [item]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold mb-2">Inventory</h2>
        <p className="text-sm text-[#6b7280] leading-relaxed">
          Tap an item to update its stock or price.
        </p>
      </div>

      {inventory.length === 0 ? (
        <div className="p-8 text-center bg-white border border-black/5 rounded-3xl">
          <p className="text-sm text-[#6b7280]">
            No inventory yet — add items via the desktop dashboard for now.
          </p>
        </div>
      ) : (
        Array.from(byCategory.entries()).map(([category, items]) => (
          <section key={category}>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#6b7280] ml-2 mb-2">
              {categoryLabel(category)}
            </h3>
            <ul className="space-y-3">
              {items.map((item) => (
                <InventoryRow key={item.id} item={item} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function InventoryRow({ item }: { item: InventoryItem }) {
  const router = useRouter();
  const initialPriceXlm = formatXlm(BigInt(item.price_stroops));
  const [editing, setEditing] = useState(false);
  const [priceValue, setPriceValue] = useState(initialPriceXlm);
  const [stockValue, setStockValue] = useState(String(item.stock));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const outOfStock = item.stock === 0;

  function startEdit() {
    setError(null);
    setPriceValue(initialPriceXlm);
    setStockValue(String(item.stock));
    setEditing(true);
  }

  function cancel() {
    setError(null);
    setEditing(false);
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const updates: { inventoryId: string; stock?: number; priceStroops?: string } = {
        inventoryId: item.id,
      };

      if (priceValue.trim() !== initialPriceXlm) {
        const parsed = parseXlmToStroops(priceValue);
        if (parsed === null) {
          setError("Price must be a positive number with up to 7 decimals.");
          return;
        }
        updates.priceStroops = parsed.toString();
      }

      const trimmedStock = stockValue.trim();
      if (trimmedStock !== String(item.stock)) {
        const parsedStock = Number(trimmedStock);
        if (!Number.isInteger(parsedStock) || parsedStock < 0) {
          setError("Stock must be a non-negative integer.");
          return;
        }
        updates.stock = parsedStock;
      }

      if (updates.priceStroops === undefined && updates.stock === undefined) {
        setEditing(false);
        return;
      }

      const result = await storeUpdateInventory(updates);
      if (!result.ok) {
        setError(result.error ?? "Update failed.");
        return;
      }
      setEditing(false);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="p-4 bg-white border border-black/5 shadow-sm rounded-3xl">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#1a1d2e] truncate">{item.name}</p>
          <p className="text-[12px] text-[#6b7280] mt-0.5">
            {formatXlm(BigInt(item.price_stroops))} XLM
            {item.unit ? ` / ${item.unit}` : ""}
          </p>
          <p
            className={
              outOfStock
                ? "text-[11px] mt-1 font-bold text-red-600"
                : "text-[11px] mt-1 text-[#9ca3af]"
            }
          >
            Stock: {item.stock}
            {outOfStock ? " · OUT" : ""}
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            aria-label={`Edit ${item.name}`}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f5f7fa] text-xs font-semibold text-[#5b7cff]"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-4 pt-4 border-t border-black/5 space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mb-1">
              Stock
            </label>
            <input
              type="number"
              min={0}
              value={stockValue}
              onChange={(e) => setStockValue(e.target.value)}
              className="w-full bg-[#f5f7fa] border-0 rounded-2xl h-11 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mb-1">
              Price (XLM)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={priceValue}
              onChange={(e) => setPriceValue(e.target.value)}
              className="w-full bg-[#f5f7fa] border-0 rounded-2xl h-11 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-full bg-[#f5f7fa] text-xs font-semibold text-[#1a1d2e] disabled:opacity-50"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white text-xs font-semibold shadow-sm disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}
```

- [ ] **Step 2.2: Commit**

Run:
```
git add app/mobile/store/components/MobileStoreInventory.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add MobileStoreInventory -- list with inline edit

Mobile inventory view grouped by category. Each item card has a
read-only summary (name, price, stock, out-of-stock badge); tap
Edit to expand inline stock + price inputs. Save calls the existing
storeUpdateInventory server action (ownership check + admin write).

Simpler than web's InventoryItemCard which has a 3-mode
view/edit/confirm flow — mobile is view <-> edit only.

Wired into the dashboard in a later task.

Spec: docs/specs/2026-05-22-mobile-phase-4-design.md section 8

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `MobileStoreCreateOrderForm` component

**Files:**
- Create: `app/mobile/store/components/MobileStoreCreateOrderForm.tsx`

Inline form rendered inside the Orders tab. Posts to existing
`/api/store/orders/create`.

- [ ] **Step 3.1: Create the form**

Create `app/mobile/store/components/MobileStoreCreateOrderForm.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle, Minus, Plus } from "lucide-react";

import { apiPost } from "@/lib/api/client";
import { formatXlm } from "@/lib/format-xlm";

type InventoryOption = {
  id: string;
  name: string;
  /** Stringified bigint. */
  price_stroops: string;
  stock: number;
  unit: string | null;
};

type FamilyOption = {
  id: string;
  display_name: string;
  country: string | null;
};

type MobileStoreCreateOrderFormProps = {
  storeId: string;
  families: FamilyOption[];
  inventory: InventoryOption[];
  onCreated: () => void;
};

/**
 * Mobile twin of web app/(app)/store/CreateOrderForm.tsx. Posts to
 * the same /api/store/orders/create route. On success: shows a
 * success banner, resets the form, and calls onCreated() so the
 * parent can collapse the inline form.
 *
 * Out-of-stock items are filtered out of the picker (matches web's
 * UX intent — can't add zero-stock items).
 */
export function MobileStoreCreateOrderForm({
  storeId,
  families,
  inventory,
  onCreated,
}: MobileStoreCreateOrderFormProps) {
  const router = useRouter();
  const [familyId, setFamilyId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stockedInventory = inventory.filter((inv) => inv.stock > 0);

  const totalStroops = stockedInventory.reduce<bigint>((sum, inv) => {
    const qty = quantities[inv.id] ?? 0;
    return sum + BigInt(inv.price_stroops) * BigInt(qty);
  }, 0n);

  const itemCount = Object.values(quantities).reduce((sum, q) => sum + q, 0);
  const canSubmit = familyId !== "" && itemCount > 0 && !submitting;

  function bump(id: string, delta: number) {
    setQuantities((prev) => {
      const current = prev[id] ?? 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  }

  async function submit() {
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const items = stockedInventory
        .filter((inv) => (quantities[inv.id] ?? 0) > 0)
        .map((inv) => ({
          inventory_id: inv.id,
          quantity: quantities[inv.id] as number,
        }));

      const result = await apiPost<{
        wishlist_id: string;
        item_count: number;
      }>("/api/store/orders/create", {
        store_id: storeId,
        family_id: familyId,
        items,
        notes: notes.trim() || undefined,
      });

      if (!result.ok) {
        setError(result.message ?? "Could not create the order.");
        return;
      }

      setSuccess(
        `Order created — ${result.data.item_count} item${
          result.data.item_count === 1 ? "" : "s"
        } in the queue.`,
      );
      setQuantities({});
      setNotes("");
      setFamilyId("");
      startTransition(() => router.refresh());
      // Brief delay so the user sees the success banner before the
      // parent collapses the form.
      window.setTimeout(() => {
        onCreated();
      }, 1200);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 bg-[#f5f7fa] rounded-3xl space-y-4">
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mb-1">
          Family
        </label>
        <select
          value={familyId}
          onChange={(e) => setFamilyId(e.target.value)}
          className="w-full bg-white border-0 rounded-2xl h-11 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        >
          <option value="">Select a family…</option>
          {families.map((f) => (
            <option key={f.id} value={f.id}>
              {f.display_name}
              {f.country ? ` (${f.country})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mb-1">
          Notes (optional)
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Weekly groceries"
          className="w-full bg-white border-0 rounded-2xl h-11 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mb-2">
          Items
        </p>
        {stockedInventory.length === 0 ? (
          <p className="text-xs text-[#9ca3af] p-3 bg-white rounded-2xl">
            No stocked items available.
          </p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {stockedInventory.map((inv) => {
              const qty = quantities[inv.id] ?? 0;
              return (
                <li
                  key={inv.id}
                  className="flex items-center gap-3 p-3 bg-white rounded-2xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1a1d2e] truncate">
                      {inv.name}
                    </p>
                    <p className="text-[11px] text-[#6b7280]">
                      {formatXlm(BigInt(inv.price_stroops))} XLM
                      {inv.unit ? ` / ${inv.unit}` : ""} · stock {inv.stock}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => bump(inv.id, -1)}
                      disabled={qty === 0}
                      aria-label={`Decrease ${inv.name}`}
                      className="w-7 h-7 rounded-full bg-[#f5f7fa] flex items-center justify-center disabled:opacity-30"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-bold w-5 text-center">{qty}</span>
                    <button
                      type="button"
                      onClick={() => bump(inv.id, 1)}
                      disabled={qty >= inv.stock}
                      aria-label={`Increase ${inv.name}`}
                      className="w-7 h-7 rounded-full bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] text-white flex items-center justify-center disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {itemCount > 0 && (
        <p className="text-xs text-[#6b7280] text-right">
          Total: <span className="font-bold text-[#1a1d2e]">{formatXlm(totalStroops)} XLM</span>{" "}
          · {itemCount} item{itemCount === 1 ? "" : "s"}
        </p>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-600 text-xs rounded-2xl border border-red-100">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-2xl border border-emerald-100 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-3 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create order"}
        {!submitting && <ArrowRight className="w-4 h-4" />}
      </button>
    </div>
  );
}
```

- [ ] **Step 3.2: Commit**

Run:
```
git add app/mobile/store/components/MobileStoreCreateOrderForm.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add MobileStoreCreateOrderForm -- inline create-order

Mobile twin of web CreateOrderForm. Family dropdown, optional notes,
per-item +/- chips (skips out-of-stock items), running total. POSTs
to existing /api/store/orders/create.

On success: shows brief banner, resets form, calls onCreated() so
the parent Orders tab can collapse the inline form. router.refresh()
re-renders parent with the new order in Pending.

Spec: docs/specs/2026-05-22-mobile-phase-4-design.md section 7

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `MobileStoreOrders` component

**Files:**
- Create: `app/mobile/store/components/MobileStoreOrders.tsx`

Top-level Orders tab body. Renders collapsible Create header,
Pending / Locked (with Mark Delivered) / Delivered / Settled
sections.

- [ ] **Step 4.1: Create the component**

Create `app/mobile/store/components/MobileStoreOrders.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CheckCircle,
  ChevronDown,
  Clock,
  Lock,
  Package,
  Plus,
} from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatXlmWithUnit, truncateHash } from "@/lib/format-xlm";
import { timeAgo } from "@/lib/time-ago";

import { MobileStoreCreateOrderForm } from "./MobileStoreCreateOrderForm";

type StoreOrder = {
  id: string;
  family_id: string;
  family_name: string;
  status: string;
  /** Stringified bigint. */
  total_stroops: string;
  notes: string | null;
  escrow_tx_hash: string | null;
  release_tx_hash: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
};

type StoreReceipt = {
  order: StoreOrder;
};

type InventoryOption = {
  id: string;
  name: string;
  price_stroops: string;
  stock: number;
  unit: string | null;
};

type FamilyOption = {
  id: string;
  display_name: string;
  country: string | null;
};

type MobileStoreOrdersProps = {
  storeId: string;
  orders: StoreOrder[];
  receipts: StoreReceipt[];
  inventory: InventoryOption[];
  families: FamilyOption[];
};

export function MobileStoreOrders({
  storeId,
  orders,
  receipts,
  inventory,
  families,
}: MobileStoreOrdersProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const pending = orders.filter((o) => o.status === "pending_approval");
  const locked = orders.filter((o) => o.status === "locked");
  const delivered = orders.filter((o) => o.status === "delivered");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold mb-2">Orders</h2>
        <p className="text-sm text-[#6b7280] leading-relaxed">
          Create orders, approve incoming wishlists, mark deliveries.
        </p>
      </div>

      {/* Collapsible Create Order */}
      <div className="bg-white border border-black/5 shadow-sm rounded-3xl overflow-hidden">
        <button
          type="button"
          onClick={() => setIsCreateOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 p-4 text-left"
          aria-expanded={isCreateOpen}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-[#1a1d2e]">
            <Plus className="w-4 h-4 text-[#5b7cff]" />
            Create Order
          </span>
          <ChevronDown
            className={
              isCreateOpen
                ? "w-4 h-4 text-[#9ca3af] rotate-180 transition-transform"
                : "w-4 h-4 text-[#9ca3af] transition-transform"
            }
          />
        </button>
        {isCreateOpen && (
          <div className="px-4 pb-4">
            <MobileStoreCreateOrderForm
              storeId={storeId}
              families={families}
              inventory={inventory}
              onCreated={() => setIsCreateOpen(false)}
            />
          </div>
        )}
      </div>

      <OrderSection
        title="Pending approval"
        empty="No pending orders."
        orders={pending}
        renderRow={(o) => <OrderCard key={o.id} order={o} variant="pending" />}
      />

      <OrderSection
        title="Locked, awaiting delivery"
        empty="No locked orders."
        orders={locked}
        renderRow={(o) => (
          <LockedOrderCard key={o.id} order={o} />
        )}
      />

      <OrderSection
        title="Delivered, awaiting family confirm"
        empty="No deliveries waiting."
        orders={delivered}
        renderRow={(o) => <OrderCard key={o.id} order={o} variant="delivered" />}
      />

      <OrderSection
        title="Settled"
        empty="No settled orders yet."
        orders={receipts.map((r) => r.order)}
        renderRow={(o) => <OrderCard key={o.id} order={o} variant="released" />}
      />
    </div>
  );
}

function OrderSection({
  title,
  empty,
  orders,
  renderRow,
}: {
  title: string;
  empty: string;
  orders: StoreOrder[];
  renderRow: (o: StoreOrder) => React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#6b7280] ml-2 mb-2">
        {title} {orders.length > 0 ? `(${orders.length})` : ""}
      </h3>
      {orders.length === 0 ? (
        <p className="text-xs text-[#9ca3af] ml-2">{empty}</p>
      ) : (
        <ul className="space-y-3">{orders.map(renderRow)}</ul>
      )}
    </section>
  );
}

function OrderCard({
  order,
  variant,
}: {
  order: StoreOrder;
  variant: "pending" | "delivered" | "released";
}) {
  const variantConfig = VARIANTS[variant];
  return (
    <li className="p-4 bg-white border border-black/5 shadow-sm rounded-3xl flex items-start gap-3">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${variantConfig.iconBg}`}
      >
        <variantConfig.Icon className={`w-5 h-5 ${variantConfig.iconColor}`} strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#1a1d2e] truncate">
          {order.family_name}&apos;s order
        </p>
        <p className="text-[12px] text-[#6b7280] mt-0.5">
          <span className="font-bold text-[#1a1d2e]">
            {formatXlmWithUnit(BigInt(order.total_stroops))}
          </span>
          {" · "}
          {order.item_count} item{order.item_count === 1 ? "" : "s"}
        </p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${variantConfig.pillClass}`}
          >
            {order.status.replace(/_/g, " ")}
          </span>
          {variant === "released" && order.release_tx_hash ? (
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${order.release_tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-[#5b7cff] hover:underline"
            >
              {truncateHash(order.release_tx_hash)}
            </a>
          ) : null}
          <span className="text-[11px] text-[#9ca3af]">{timeAgo(order.updated_at)}</span>
        </div>
      </div>
    </li>
  );
}

function LockedOrderCard({ order }: { order: StoreOrder }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function markDelivered() {
    setError(null);
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: uErr } = await supabase
        .from("wishlist")
        .update({
          status: "delivered",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      if (uErr) {
        setError(uErr.message);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="p-4 bg-white border border-black/5 shadow-sm rounded-3xl">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5 text-amber-600" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#1a1d2e] truncate">
            {order.family_name}&apos;s order
          </p>
          <p className="text-[12px] text-[#6b7280] mt-0.5">
            <span className="font-bold text-[#1a1d2e]">
              {formatXlmWithUnit(BigInt(order.total_stroops))}
            </span>
            {" · "}
            {order.item_count} item{order.item_count === 1 ? "" : "s"}
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
              locked
            </span>
            {order.escrow_tx_hash ? (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${order.escrow_tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono text-[#5b7cff] hover:underline"
              >
                {truncateHash(order.escrow_tx_hash)}
              </a>
            ) : null}
            <span className="text-[11px] text-[#9ca3af]">{timeAgo(order.updated_at)}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={markDelivered}
        disabled={submitting}
        className="w-full mt-4 bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-3 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {submitting ? "Marking…" : "Mark as delivered"}
        {!submitting && <CheckCircle className="w-4 h-4" />}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </li>
  );
}

const VARIANTS = {
  pending: {
    Icon: Clock,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    pillClass: "bg-slate-100 text-slate-700",
  },
  delivered: {
    Icon: Package,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    pillClass: "bg-blue-100 text-blue-700",
  },
  released: {
    Icon: CheckCircle,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    pillClass: "bg-emerald-100 text-emerald-700",
  },
} as const;
```

- [ ] **Step 4.2: Commit**

Run:
```
git add app/mobile/store/components/MobileStoreOrders.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add MobileStoreOrders -- queue + create + mark delivered

Top-level Orders tab body. Five sections in one scrollable view:
  1. Collapsible "+ Create Order" header that opens
     MobileStoreCreateOrderForm inline.
  2. Pending approval (read-only).
  3. Locked, awaiting delivery (with Mark as Delivered button --
     direct Supabase update, mirrors web's MarkDeliveredButton).
  4. Delivered, awaiting family confirm (read-only).
  5. Settled (receipts).

Each card shows family name + total XLM + item count + status pill +
tx hash link (when applicable) + timeAgo.

Spec: docs/specs/2026-05-22-mobile-phase-4-design.md section 6

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `MobileStoreDashboardClient`

**Files:**
- Create: `app/mobile/store/MobileStoreDashboardClient.tsx`

Top-level client component. Holds the activeTab state and branches
into the 4 bodies. Bottom tab bar.

- [ ] **Step 5.1: Create the component**

Create `app/mobile/store/MobileStoreDashboardClient.tsx`:

```tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Boxes,
  CheckCircle,
  History,
  Home,
  Lock,
  Menu,
  Package,
} from "lucide-react";

import { MobileActivity } from "@/app/mobile/components/MobileActivity";
import { formatXlmWithUnit } from "@/lib/format-xlm";

import { MobileStoreInventory } from "./components/MobileStoreInventory";
import { MobileStoreOrders } from "./components/MobileStoreOrders";

type StoreDashboardSerialized = {
  store: {
    id: string;
    display_name: string;
    country: string | null;
  };
  totals: {
    pendingCount: number;
    inEscrow: string;        // stringified bigint
    revenue: string;         // stringified bigint
    outOfStockCount: number;
  };
  orders: Array<{
    id: string;
    family_id: string;
    family_name: string;
    status: string;
    total_stroops: string;
    notes: string | null;
    escrow_tx_hash: string | null;
    release_tx_hash: string | null;
    item_count: number;
    created_at: string;
    updated_at: string;
  }>;
  receipts: Array<{
    order: {
      id: string;
      family_id: string;
      family_name: string;
      status: string;
      total_stroops: string;
      notes: string | null;
      escrow_tx_hash: string | null;
      release_tx_hash: string | null;
      item_count: number;
      created_at: string;
      updated_at: string;
    };
  }>;
  inventory: Array<{
    id: string;
    name: string;
    category: string;
    price_stroops: string;
    stock: number;
    unit: string | null;
  }>;
  /** Already-shaped settlement rows; bigints stringified. */
  activity: Array<{
    id: string;
    wishlist_id: string;
    event_type: "deposit" | "lock" | "release";
    tx_hash: string;
    amount_stroops: string;
    created_at: string;
    wishlist_notes: string | null;
    wishlist_status: string | null;
  }>;
  families: Array<{
    id: string;
    display_name: string;
    country: string | null;
  }>;
};

type Props = {
  storeData: StoreDashboardSerialized;
};

export function MobileStoreDashboardClient({ storeData }: Props) {
  const [activeTab, setActiveTab] = useState<
    "home" | "orders" | "inventory" | "activity"
  >("home");

  // The MobileActivity component expects bigint amount_stroops. Coerce.
  const activityRows = storeData.activity.map((a) => ({
    id: a.id,
    wishlist_id: a.wishlist_id,
    event_type: a.event_type,
    tx_hash: a.tx_hash,
    amount_stroops: BigInt(a.amount_stroops),
    created_at: a.created_at,
    wishlist_notes: a.wishlist_notes,
    wishlist_status: a.wishlist_status as any,
  }));

  return (
    <div className="relative flex flex-col h-screen max-w-md mx-auto bg-[#f5f7fa] text-[#1a1d2e] overflow-hidden font-sans">
      {/* Top Header */}
      <div className="px-6 py-5 flex items-center justify-between bg-white shrink-0 shadow-sm z-10">
        <h1 className="text-lg font-extrabold tracking-tight">InternStellar</h1>
        <Link
          href="/mobile/settings"
          aria-label="Open settings"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </Link>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-24 scroll-smooth">
        {activeTab === "home" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <p className="text-[11px] text-[#6b7280] uppercase tracking-widest mb-1.5 font-bold">
                WELCOME BACK
              </p>
              <h2 className="text-[2rem] font-extrabold mb-3 leading-tight tracking-tight">
                {firstName(storeData.store.display_name)}&apos;s desk.
              </h2>
              <p className="text-[#6b7280] text-[15px] leading-relaxed">
                {storeData.totals.pendingCount > 0 ? (
                  <>
                    <span className="text-[#1a1d2e] font-semibold">
                      {storeData.totals.pendingCount} order
                      {storeData.totals.pendingCount === 1 ? "" : "s"}
                    </span>{" "}
                    waiting on your approval.
                  </>
                ) : (
                  <>All caught up — no pending orders.</>
                )}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StoreStatCard
                icon={<Package className="w-4 h-4 text-white" strokeWidth={2.5} />}
                title="Pending"
                value={String(storeData.totals.pendingCount)}
                desc="To review"
                color="from-blue-500 to-blue-600"
              />
              <StoreStatCard
                icon={<Lock className="w-4 h-4 text-white" strokeWidth={2.5} />}
                title="Escrow"
                value={formatXlmWithUnit(BigInt(storeData.totals.inEscrow))}
                desc="Locked"
                color="from-amber-500 to-orange-500"
              />
              <StoreStatCard
                icon={<CheckCircle className="w-4 h-4 text-white" strokeWidth={2.5} />}
                title="Revenue"
                value={formatXlmWithUnit(BigInt(storeData.totals.revenue))}
                desc="Released"
                color="from-emerald-400 to-emerald-600"
              />
            </div>

            {storeData.totals.outOfStockCount > 0 && (
              <div className="p-5 bg-amber-50 border border-amber-100 rounded-3xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-900">
                    {storeData.totals.outOfStockCount} item
                    {storeData.totals.outOfStockCount === 1 ? "" : "s"} out of stock
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Tap{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("inventory")}
                      className="font-bold underline"
                    >
                      Inventory
                    </button>{" "}
                    to restock.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "orders" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <MobileStoreOrders
              storeId={storeData.store.id}
              orders={storeData.orders}
              receipts={storeData.receipts}
              inventory={storeData.inventory}
              families={storeData.families}
            />
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <MobileStoreInventory inventory={storeData.inventory} />
          </div>
        )}

        {activeTab === "activity" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <MobileActivity rows={activityRows} />
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <div className="absolute bottom-0 w-full bg-white border-t border-black/5 px-4 pb-safe pt-3 pb-6 flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-50">
        <TabItem
          icon={<Home />}
          label="Home"
          active={activeTab === "home"}
          onClick={() => setActiveTab("home")}
        />
        <TabItem
          icon={<Package />}
          label="Orders"
          active={activeTab === "orders"}
          onClick={() => setActiveTab("orders")}
        />
        <TabItem
          icon={<Boxes />}
          label="Inventory"
          active={activeTab === "inventory"}
          onClick={() => setActiveTab("inventory")}
        />
        <TabItem
          icon={<History />}
          label="Activity"
          active={activeTab === "activity"}
          onClick={() => setActiveTab("activity")}
        />
      </div>
    </div>
  );
}

function firstName(displayName: string): string {
  return displayName.split(" ")[0] ?? displayName;
}

function StoreStatCard({
  icon,
  title,
  value,
  desc,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  desc: string;
  color: string;
}) {
  return (
    <div className="p-3.5 bg-white border border-black/5 shadow-sm rounded-2xl flex flex-col">
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br ${color} shadow-sm mb-3`}
      >
        {icon}
      </div>
      <p className="text-[10px] text-[#6b7280] uppercase mb-0.5 font-bold tracking-wide">
        {title}
      </p>
      <p className="text-[15px] font-extrabold mb-0.5 truncate">{value}</p>
      <p className="text-[10px] text-[#9ca3af] font-medium">{desc}</p>
    </div>
  );
}

function TabItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 min-w-[50px] transition-all duration-300 ${active ? "text-[#5b7cff]" : "text-[#9ca3af] hover:text-[#6b7280]"}`}
    >
      <div
        className={`transition-transform duration-300 ${active ? "scale-110 -translate-y-1" : "scale-100"}`}
      >
        {React.cloneElement(icon as React.ReactElement, {
          strokeWidth: active ? 2.5 : 2,
          className: "w-[22px] h-[22px]",
        })}
      </div>
      <span className={`text-[10px] ${active ? "font-bold" : "font-medium"}`}>
        {label}
      </span>
    </button>
  );
}
```

- [ ] **Step 5.2: Commit**

Run:
```
git add app/mobile/store/MobileStoreDashboardClient.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add MobileStoreDashboardClient -- store-only dashboard shell

Parallel to MobileDashboardClient (OFW/family). 4 bottom tabs:
Home / Orders / Inventory / Activity. Home renders welcome +
3 stat cards + out-of-stock warning. Other tabs mount the
dedicated components built in prior tasks.

Activity reuses Phase 2's MobileActivity component -- bigints
re-hydrated from strings before passing.

Spec: docs/specs/2026-05-22-mobile-phase-4-design.md section 5

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Replace the `/mobile/store` placeholder

**Files:**
- Modify: `app/mobile/store/page.tsx`

Auth-gate the route, load the dashboard data, stringify bigints,
mount `MobileStoreDashboardClient`.

- [ ] **Step 6.1: Replace the page**

Replace `app/mobile/store/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

import { loadUserProfile } from "@/lib/auth-role";
import { loadStoreDashboard } from "@/lib/dashboard/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { MobileStoreDashboardClient } from "./MobileStoreDashboardClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Mobile Store dashboard. Mirrors the web /store route. signInAction
 * redirects a store caller to /store on success → middleware rewrites
 * to /mobile/store for mobile UAs, which lands here.
 */
export default async function MobileStorePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await loadUserProfile(user.id);
  if (profile?.role !== "store") {
    redirect("/");
  }

  const data = await loadStoreDashboard({ storeId: user.id });

  // Stringify bigints at the server→client boundary.
  const serialized = {
    store: data.store,
    totals: {
      pendingCount: data.totals.pendingCount,
      inEscrow: data.totals.inEscrow.toString(),
      revenue: data.totals.revenue.toString(),
      outOfStockCount: data.totals.outOfStockCount,
    },
    orders: data.orders.map((o) => ({
      id: o.id,
      family_id: o.family_id,
      family_name: o.family_name,
      status: o.status,
      total_stroops: o.total_stroops.toString(),
      notes: o.notes,
      escrow_tx_hash: o.escrow_tx_hash,
      release_tx_hash: o.release_tx_hash,
      item_count: o.item_count,
      created_at: o.created_at,
      updated_at: o.updated_at,
    })),
    receipts: data.receipts.map((r) => ({
      order: {
        id: r.order.id,
        family_id: r.order.family_id,
        family_name: r.order.family_name,
        status: r.order.status,
        total_stroops: r.order.total_stroops.toString(),
        notes: r.order.notes,
        escrow_tx_hash: r.order.escrow_tx_hash,
        release_tx_hash: r.order.release_tx_hash,
        item_count: r.order.item_count,
        created_at: r.order.created_at,
        updated_at: r.order.updated_at,
      },
    })),
    inventory: data.inventory.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      price_stroops: i.price_stroops.toString(),
      stock: i.stock,
      unit: i.unit,
    })),
    activity: data.activity.map((a) => ({
      id: a.id,
      wishlist_id: a.wishlist_id,
      event_type: a.event_type,
      tx_hash: a.tx_hash,
      amount_stroops: a.amount_stroops.toString(),
      created_at: a.created_at,
      wishlist_notes: a.wishlist_notes,
      wishlist_status: a.wishlist_status,
    })),
    families: data.families,
  };

  return <MobileStoreDashboardClient storeData={serialized} />;
}
```

- [ ] **Step 6.2: Smoke test all routes compile**

Run (background): `npm run dev`. Wait ~8 seconds.

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "store=%{http_code}\n" http://localhost:3000/mobile/store
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "ofw=%{http_code}\n" http://localhost:3000/mobile/ofw
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "family=%{http_code}\n" http://localhost:3000/mobile/family
curl -s -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120" -o /dev/null -w "web-store=%{http_code}\n" http://localhost:3000/store
```

Expected:
```
store=307
ofw=307
family=307
web-store=307
```

(All 307 because of auth gate — confirms compilation.)

Read the dev log. Expect no errors mentioning `MobileStoreDashboardClient`,
`MobileStoreOrders`, `MobileStoreInventory`, `MobileStoreCreateOrderForm`,
or `MobileActivity`.

Stop dev (PowerShell):
`Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 6.3: Commit**

Run:
```
git add app/mobile/store/page.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): replace /mobile/store placeholder with real dashboard

Auth-gates the route (signed-out -> /login, non-store -> /),
loads StoreDashboardData via loadStoreDashboard, stringifies
bigints at the server->client boundary, mounts
MobileStoreDashboardClient.

The old "Store dashboard -- coming soon" placeholder is replaced.
Store users now land on a full dashboard equivalent to web /store.

Spec: docs/specs/2026-05-22-mobile-phase-4-design.md section 4.2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: End-to-end smoke test

No code changes. Walks the spec §11 checklist.

- [ ] **Step 7.1: Start dev server**

Run (background): `npm run dev`. Wait until "Ready" appears (~7 seconds).

- [ ] **Step 7.2: All three mobile dashboards + web store compile**

Run:
```
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "mobile-ofw=%{http_code}\n" http://localhost:3000/mobile/ofw
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "mobile-family=%{http_code}\n" http://localhost:3000/mobile/family
curl -s -A "Mozilla/5.0 (iPhone) Mobile" -o /dev/null -w "mobile-store=%{http_code}\n" http://localhost:3000/mobile/store
curl -s -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120" -o /dev/null -w "web-store=%{http_code}\n" http://localhost:3000/store
```

Expected:
```
mobile-ofw=307
mobile-family=307
mobile-store=307
web-store=307
```

- [ ] **Step 7.3: Dev log clean**

Read the dev log. Verify:
- `✓ Compiled /mobile/store` no errors.
- `✓ Compiled /store` no errors (web tree untouched).
- No `Type error` about `StoreSettlementRow`, `StoreOrder`,
  `MobileStoreOrders`, or `MobileStoreCreateOrderForm`.

- [ ] **Step 7.4: Existing tests still pass**

Run: `npm run test:device`

Expected: `9 passed, 0 failed`.

- [ ] **Step 7.5: Stop dev server**

Run (PowerShell): `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`

- [ ] **Step 7.6: Manual browser walk-through (required)**

Open Chrome → DevTools → Toggle device toolbar → iPhone 14 Pro →
hard refresh `http://localhost:3000/`. Walk the spec §11 checklist:

1. Mobile landing → tap **Log in** → land on `/mobile/login`.
2. Sign in as **Aling Nena** (store, password `demo123456`). Land
   on `/mobile/store`. Confirm 4 tabs at bottom: Home / Orders /
   Inventory / Activity. The "coming soon" placeholder is gone.
3. **Home** — welcome shows "Nena's desk." (or similar). Three
   stat cards render with real values (pending, escrow, revenue).
   If any inventory is at stock 0, the amber out-of-stock card
   appears with a link to the Inventory tab.
4. Tap **Orders**.
   - Tap "+ Create Order" → form expands.
   - Pick "Lola Cora" from family dropdown. Pick 2 inventory items
     with qty 1 each via the +/- chips. Tap "Create order" →
     success banner appears briefly, form collapses, the new
     order appears in "Pending approval" section.
   - In another browser, log in as **Lola Cora** (family). Tap
     **Shop**, the new order's items should be in her draft (or
     she can build her own). She locks → status flips to "locked".
   - Switch back to store browser, refresh. The order moved from
     "Pending approval" to "Locked, awaiting delivery" with a
     "Mark as delivered" button.
   - Tap **Mark as delivered** → moves to "Delivered, awaiting
     family confirm".
   - As Lola Cora, tap **Orders** → "Confirm delivery". Back to
     store; order appears in "Settled" with the release tx hash.
5. Tap **Inventory**. Pick an item, tap **Edit** → inline panel
   expands. Change stock to 0 + price to 1.5 XLM → Save. Card
   updates; out-of-stock badge appears in red on the card.
6. Tap **Activity**. Settlement events render with proper wishlist
   labels (e.g., "Rice 5kg + Cooking Oil" — whatever notes were
   set), not "Untitled wishlist".
7. Tap the menu icon top-right → lands on `/mobile/settings`.
8. Resize DevTools to iPhone SE (375 × 667). All 4 tabs visible
   without horizontal scroll.

If any step fails visually, capture as a follow-up before merging.

---

## Done

All 7 tasks complete. The repo now has:

- A complete mobile store dashboard at `/mobile/store` replacing
  the placeholder, with 4 tabs (Home / Orders / Inventory / Activity).
- Order queue with five lifecycle sections + inline Create Order
  form + Mark as Delivered action.
- Inventory list with inline expand-to-edit per card (stock + price)
  using the existing storeUpdateInventory server action.
- Activity timeline (shared MobileActivity component) with proper
  wishlist labels via the loader extension.

This completes Phases 0+1, 2, 3, 4, 5 — all five phases of the
mobile parity roadmap. Mobile is functionally at parity with web.

Next: invoke `superpowers:finishing-a-development-branch` to verify
tests, choose merge/PR, and clean up.
