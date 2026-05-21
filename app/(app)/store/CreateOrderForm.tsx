"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconWell } from "@/components/ui/IconWell";
import { ArrowUpRightIcon, PackageIcon } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { apiPost } from "@/lib/api/client";
import { formatXlmWithUnit } from "@/lib/format-xlm";

/**
 * Store-side "Create order on family's behalf" form.
 *
 * Use case: walk-ins / phone-in customers whose order didn't come from the
 * family's WishlistBuilder. The store picks the family, sets quantities on
 * its own inventory rows, and submits — POSTs to /api/store/orders/create
 * which inserts a new `wishlist` (status='pending_approval') + items so the
 * order appears in the queue immediately.
 *
 * Quantity state is a Map<inventory_id, qty>. Items with qty=0 are skipped
 * on submit. Stock is clamped at the input level so the server-side
 * insufficient_stock check is rarely hit (still validated server-side).
 */

export interface OrderInventoryRow {
  id: string;
  name: string;
  category: string;
  /** Stringified bigint. */
  price_stroops: string;
  stock: number;
  unit: string | null;
}

export interface OrderFamilyOption {
  id: string;
  display_name: string;
  country: string | null;
}

export function CreateOrderForm({
  storeId,
  families,
  inventory,
}: {
  storeId: string;
  families: OrderFamilyOption[];
  inventory: OrderInventoryRow[];
}) {
  const router = useRouter();
  const [familyId, setFamilyId] = useState<string>(families[0]?.id ?? "");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Compute running total + selected count from the quantity map.
  const { totalStroops, selectedCount } = useMemo(() => {
    let total = 0n;
    let count = 0;
    for (const inv of inventory) {
      const qty = quantities[inv.id] ?? 0;
      if (qty > 0) {
        total += BigInt(inv.price_stroops) * BigInt(qty);
        count += 1;
      }
    }
    return { totalStroops: total, selectedCount: count };
  }, [inventory, quantities]);

  const familyOk = familyId !== "";
  const itemsOk = selectedCount > 0;
  const canSubmit = familyOk && itemsOk && !submitting;

  function setQty(invId: string, value: number, stock: number) {
    const clamped = Math.max(0, Math.min(stock, Math.floor(value)));
    setQuantities((prev) => {
      if (clamped === 0) {
        // Drop the key entirely so the count is correct (rather than
        // leaving a 0 entry that still iterates).
        const { [invId]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [invId]: clamped };
    });
  }

  function bump(invId: string, delta: number, stock: number) {
    const current = quantities[invId] ?? 0;
    setQty(invId, current + delta, stock);
  }

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const items = inventory
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
      startTransition(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  }

  if (families.length === 0) {
    return (
      <Card className="p-8 md:p-10">
        <div className="flex items-start gap-5">
          <IconWell tone="accent" size="md">
            <PackageIcon className="h-6 w-6" />
          </IconWell>
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
              Create order
            </h2>
            <p className="text-ink-muted mt-2 text-sm md:text-base">
              No family profiles found yet. Once a family registers (or the
              demo seed runs), you can place orders on their behalf here.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (inventory.length === 0) {
    return (
      <Card className="p-8 md:p-10">
        <div className="flex items-start gap-5">
          <IconWell tone="accent" size="md">
            <PackageIcon className="h-6 w-6" />
          </IconWell>
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
              Create order
            </h2>
            <p className="text-ink-muted mt-2 text-sm md:text-base">
              Your store has no inventory yet. Add items via{" "}
              <code className="font-mono text-ink">db/seed.sql</code> before
              creating walk-in orders.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Group inventory by category so the picker mirrors the shelf layout used
  // in InventoryPanel.
  const byCategory = new Map<string, OrderInventoryRow[]>();
  for (const item of inventory) {
    const arr = byCategory.get(item.category);
    if (arr) arr.push(item);
    else byCategory.set(item.category, [item]);
  }

  return (
    <Card className="p-8 md:p-10">
      <div className="flex items-end justify-between gap-6 mb-8">
        <div className="flex items-start gap-5 min-w-0">
          <IconWell tone="accent" size="md">
            <PackageIcon className="h-6 w-6" />
          </IconWell>
          <div className="min-w-0">
            <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
              Create order
            </h2>
            <p className="text-ink-muted mt-2 text-sm md:text-base">
              Build a walk-in order on a family&apos;s behalf. It lands in
              the queue at <span className="text-ink font-medium">pending approval</span>{" "}
              and follows the same lock / deliver / release flow.
            </p>
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end shrink-0 text-right">
          <span className="text-xs uppercase tracking-[0.16em] text-ink-muted font-medium">
            Order total
          </span>
          <span className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink">
            {formatXlmWithUnit(totalStroops)}
          </span>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-8"
      >
        {/* Family picker + notes -------------------------------------- */}
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="create-order-family"
              className="block text-xs uppercase tracking-[0.16em] text-ink-muted font-medium mb-2.5"
            >
              For family
            </label>
            <select
              id="create-order-family"
              value={familyId}
              onChange={(e) => setFamilyId(e.target.value)}
              className={cn(
                "w-full bg-surface text-ink rounded-2xl px-5 py-3.5",
                "shadow-neu-inset placeholder:text-ink-placeholder",
                "transition-shadow duration-300 ease-soft",
                "focus:outline-none focus:shadow-neu-inset-deep",
                "appearance-none",
              )}
            >
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.display_name}
                  {f.country ? ` · ${f.country}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="create-order-notes"
              className="block text-xs uppercase tracking-[0.16em] text-ink-muted font-medium mb-2.5"
            >
              Notes (optional)
            </label>
            <input
              id="create-order-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Walk-in for Lola Cora, pantry restock"
              className={cn(
                "w-full bg-surface text-ink rounded-2xl px-5 py-3.5",
                "shadow-neu-inset placeholder:text-ink-placeholder",
                "transition-shadow duration-300 ease-soft",
                "focus:outline-none focus:shadow-neu-inset-deep",
              )}
            />
          </div>
        </div>

        {/* Inventory grid --------------------------------------------- */}
        <div>
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <span className="text-xs uppercase tracking-[0.16em] text-ink-muted font-medium">
              Items ({selectedCount} selected)
            </span>
            <span className="text-xs text-ink-muted md:hidden tabular-nums">
              {formatXlmWithUnit(totalStroops)}
            </span>
          </div>
          <div className="space-y-8">
            {Array.from(byCategory.entries()).map(([category, items]) => (
              <div key={category}>
                <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-medium mb-3">
                  {categoryLabel(category)}
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {items.map((inv) => (
                    <ItemRow
                      key={inv.id}
                      item={inv}
                      qty={quantities[inv.id] ?? 0}
                      onSet={(v) => setQty(inv.id, v, inv.stock)}
                      onBump={(d) => bump(inv.id, d, inv.stock)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-2xl bg-surface shadow-neu-inset-sm px-4 py-3 text-sm text-red-500"
          >
            {error}
          </div>
        ) : null}

        {success ? (
          <div
            role="status"
            className="rounded-2xl bg-surface shadow-neu-inset-sm px-4 py-3 text-sm text-accent-teal"
          >
            {success}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-ink-muted">
            New orders land at <span className="text-ink font-medium">pending_approval</span>.
            The family / OFW can then lock escrow as usual.
          </p>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!canSubmit}
          >
            {submitting
              ? "Creating…"
              : `Create order${selectedCount > 0 ? ` · ${selectedCount} item${selectedCount === 1 ? "" : "s"}` : ""}`}
            {submitting ? null : <ArrowUpRightIcon className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function ItemRow({
  item,
  qty,
  onSet,
  onBump,
}: {
  item: OrderInventoryRow;
  qty: number;
  onSet: (v: number) => void;
  onBump: (delta: number) => void;
}) {
  const outOfStock = item.stock === 0;
  return (
    <li
      className={cn(
        "p-4 rounded-2xl bg-surface shadow-neu-inset-sm flex items-center gap-4",
        outOfStock ? "opacity-60" : "",
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="font-display text-sm font-bold text-ink truncate">
          {item.name}
          {item.unit ? (
            <span className="text-ink-muted font-normal"> · {item.unit}</span>
          ) : null}
        </p>
        <p className="text-xs text-ink-muted mt-1 tabular-nums">
          {formatXlmWithUnit(BigInt(item.price_stroops))}
          <span className="mx-2">·</span>
          {outOfStock ? (
            <span className="text-red-500">Out of stock</span>
          ) : (
            <>stock {item.stock}</>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          aria-label="Decrease"
          onClick={() => onBump(-1)}
          disabled={qty === 0}
          className={cn(
            "h-9 w-9 rounded-xl bg-surface text-ink shadow-neu",
            "transition-all duration-200 ease-soft",
            "hover:-translate-y-0.5 hover:shadow-neu-hover",
            "active:translate-y-0 active:shadow-neu-inset-sm",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-neu",
          )}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={qty}
          min={0}
          max={item.stock}
          disabled={outOfStock}
          onChange={(e) => {
            const v = Number(e.target.value);
            onSet(Number.isFinite(v) ? v : 0);
          }}
          className={cn(
            "w-14 text-center bg-surface text-ink rounded-xl py-2",
            "shadow-neu-inset placeholder:text-ink-placeholder tabular-nums",
            "focus:outline-none focus:shadow-neu-inset-deep",
            "disabled:opacity-40",
          )}
        />
        <button
          type="button"
          aria-label="Increase"
          onClick={() => onBump(1)}
          disabled={outOfStock || qty >= item.stock}
          className={cn(
            "h-9 w-9 rounded-xl bg-surface text-ink shadow-neu",
            "transition-all duration-200 ease-soft",
            "hover:-translate-y-0.5 hover:shadow-neu-hover",
            "active:translate-y-0 active:shadow-neu-inset-sm",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-neu",
          )}
        >
          +
        </button>
      </div>
    </li>
  );
}
