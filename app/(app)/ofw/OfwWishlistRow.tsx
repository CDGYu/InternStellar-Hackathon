"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { IconWell } from "@/components/ui/IconWell";
import { StatusPill, type WishlistStatus } from "@/components/ui/StatusPill";
import {
  ArrowUpRightIcon,
  CheckCircleIcon,
  LockIcon,
  PackageIcon,
} from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import {
  ofwAddWishlistItem,
  ofwRemoveWishlistItem,
  ofwUpdateInventoryStock,
} from "@/app/(app)/ofw/actions";
import { apiPost } from "@/lib/api/client";
import { formatXlm, formatXlmWithUnit, truncateHash } from "@/lib/format-xlm";
import { STELLAR_EXPLORER_BASE } from "@/lib/stellar/explorer";
import { timeAgo } from "@/lib/time-ago";

/**
 * One row in the OFW dashboard's "Active wishlists" panel.
 *
 * Owns the entire row including the trailing per-status action button.
 * For `draft` wishlists, also owns an expandable editor below the row
 * that lets the OFW add/remove items via service-role server actions
 * (see app/(app)/ofw/actions.ts for the why-not-cookie-bound rationale).
 *
 *   draft               → "Edit wishlist" toggle → inline editor
 *   pending_approval    → "Lock funds" → POST /api/escrow/lock
 *   locked | delivered  → "Confirm delivery" → POST /api/escrow/release
 *                         (plus explorer-link icon for the lock tx)
 *   released | cancelled → no trailing action
 */
export interface OfwRowLine {
  id: string;
  inventory_id: string;
  inventory_name: string;
  inventory_unit: string | null;
  quantity: number;
  /** Stringified bigint for the server→client boundary. */
  price_stroops_at_add: string;
}

export interface OfwRowInventoryItem {
  id: string;
  name: string;
  category: string;
  /** Stringified bigint. */
  price_stroops: string;
  stock: number;
  unit: string | null;
}

export interface OfwWishlistRowProps {
  familyId: string;
  wishlistId: string;
  status: WishlistStatus;
  notes: string | null;
  /** Stringified bigint — computed from the loader. */
  totalStroops: string;
  escrowTxHash: string | null;
  updatedAt: string;
  items: OfwRowLine[];
  inventory: OfwRowInventoryItem[];
}

export function OfwWishlistRow(props: OfwWishlistRowProps) {
  const {
    familyId,
    wishlistId,
    status,
    notes,
    totalStroops,
    escrowTxHash,
    updatedAt,
    items,
    inventory,
  } = props;

  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingApi, setPendingApi] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const editable = status === "draft" || status === "pending_approval";

  async function add(invId: string) {
    setError(null);
    setBusyId(invId);
    try {
      const result = await ofwAddWishlistItem({ wishlistId, inventoryId: invId });
      if (!result.ok) setError(result.error ?? "Add failed.");
      else startTransition(() => router.refresh());
    } finally {
      setBusyId(null);
    }
  }

  async function remove(itemId: string) {
    setError(null);
    setBusyId(itemId);
    try {
      const result = await ofwRemoveWishlistItem({ itemId });
      if (!result.ok) setError(result.error ?? "Remove failed.");
      else startTransition(() => router.refresh());
    } finally {
      setBusyId(null);
    }
  }

  async function updateStock(invId: string, stock: number): Promise<boolean> {
    setError(null);
    setBusyId(invId);
    try {
      const result = await ofwUpdateInventoryStock({ inventoryId: invId, stock });
      if (!result.ok) {
        setError(result.error ?? "Stock update failed.");
        return false;
      }
      startTransition(() => router.refresh());
      return true;
    } finally {
      setBusyId(null);
    }
  }

  async function lockFunds() {
    setError(null);
    setPendingApi(true);
    try {
      const r = await apiPost("/api/escrow/lock", {
        family_id: familyId,
        wishlist_id: wishlistId,
      });
      if (!r.ok) setError(r.message);
      else startTransition(() => router.refresh());
    } finally {
      setPendingApi(false);
    }
  }

  async function confirmDelivery() {
    setError(null);
    setPendingApi(true);
    try {
      const r = await apiPost("/api/escrow/release", {
        family_id: familyId,
        wishlist_id: wishlistId,
      });
      if (!r.ok) setError(r.message);
      else startTransition(() => router.refresh());
    } finally {
      setPendingApi(false);
    }
  }

  return (
    <li>
      <div className="flex flex-col gap-0 rounded-2xl bg-surface shadow-neu-inset-sm">
        {/* ---- Top: standard row ------------------------------------- */}
        <div className="flex items-start gap-5 p-5">
          <IconWell size="sm" tone="default" depth="shallow">
            <PackageIcon className="h-5 w-5" />
          </IconWell>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <StatusPill status={status} />
              <span className="text-xs text-ink-muted">
                Updated {timeAgo(updatedAt)}
              </span>
            </div>
            <p className="text-ink font-medium truncate">
              {notes ?? "Untitled wishlist"}
            </p>
            <p className="text-ink-muted text-sm mt-1">
              <span className="text-ink font-medium tabular-nums">
                {formatXlmWithUnit(BigInt(totalStroops))}
              </span>
              <span className="mx-2">·</span>
              {items.length} item{items.length === 1 ? "" : "s"}
              {escrowTxHash ? (
                <>
                  <span className="mx-2">·</span>
                  <span className="font-mono">{truncateHash(escrowTxHash)}</span>
                </>
              ) : null}
            </p>
          </div>

          {/* Trailing action — per status */}
          <TrailingAction
            status={status}
            editing={editing}
            onToggleEdit={() => setEditing((v) => !v)}
            onLock={lockFunds}
            onConfirmDelivery={confirmDelivery}
            pendingApi={pendingApi}
            escrowTxHash={escrowTxHash}
          />
        </div>

        {/* ---- Bottom: editor (draft only, when expanded) ----------- */}
        {editing && editable ? (
          <div className="border-t border-ink/5 px-5 py-5">
            <Editor
              items={items}
              inventory={inventory}
              busyId={busyId}
              onAdd={add}
              onRemove={remove}
              onUpdateStock={updateStock}
            />
          </div>
        ) : null}

        {/* ---- Inline error ------------------------------------------ */}
        {error ? (
          <p
            role="alert"
            className="px-5 pb-4 text-xs text-red-500"
          >
            {error}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------- */
/* Trailing action — switches on status                                  */
/* -------------------------------------------------------------------- */

function TrailingAction({
  status,
  editing,
  onToggleEdit,
  onLock,
  onConfirmDelivery,
  pendingApi,
  escrowTxHash,
}: {
  status: WishlistStatus;
  editing: boolean;
  onToggleEdit: () => void;
  onLock: () => void;
  onConfirmDelivery: () => void;
  pendingApi: boolean;
  escrowTxHash: string | null;
}) {
  if (status === "draft" || status === "pending_approval") {
    // Both statuses are editable. For pending_approval we also want a
    // "Lock funds" CTA — but to keep the row clean we keep the edit
    // toggle for both, and add a primary Lock action only for pending.
    return (
      <div className="flex flex-col items-stretch gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleEdit}
          aria-expanded={editing}
          className={cn(
            "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-medium",
            "bg-surface text-ink shadow-neu",
            "transition-all duration-300 ease-soft",
            "hover:-translate-y-0.5 hover:shadow-neu-hover",
            "active:translate-y-0 active:shadow-neu-inset-sm",
          )}
        >
          <PackageIcon className="h-4 w-4" />
          {editing ? "Done" : "Edit wishlist"}
        </button>
        {status === "pending_approval" ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onLock}
            disabled={pendingApi}
          >
            {pendingApi ? "Locking…" : "Lock funds"}
            {pendingApi ? null : <LockIcon className="h-4 w-4" />}
          </Button>
        ) : null}
      </div>
    );
  }

  if (status === "locked" || status === "delivered") {
    // Release only succeeds once the store marks the order delivered.
    // /api/escrow/release 409s with invalid_status (expected "delivered")
    // if Confirm delivery fires while still "locked", so show a disabled
    // waiting state until the store updates it.
    return (
      <div className="flex items-center gap-2 shrink-0">
        {status === "delivered" ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onConfirmDelivery}
            disabled={pendingApi}
          >
            {pendingApi ? "Confirming…" : "Confirm delivery"}
            {pendingApi ? null : <CheckCircleIcon className="h-4 w-4" />}
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="sm" disabled>
            Awaiting delivery
          </Button>
        )}
        {escrowTxHash ? (
          <a
            href={`${STELLAR_EXPLORER_BASE}/tx/${escrowTxHash}`}
            target="_blank"
            rel="noreferrer"
            aria-label="View lock tx on Stellar Expert"
            className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-surface shadow-neu hover:shadow-neu-hover hover:-translate-y-0.5 active:translate-y-0 active:shadow-neu-inset-sm transition-all duration-300 ease-soft text-ink"
          >
            <ArrowUpRightIcon className="h-4 w-4" />
          </a>
        ) : null}
      </div>
    );
  }

  // released / cancelled — explorer link only if there's a tx hash.
  if (escrowTxHash) {
    return (
      <a
        href={`${STELLAR_EXPLORER_BASE}/tx/${escrowTxHash}`}
        target="_blank"
        rel="noreferrer"
        aria-label="View on Stellar Expert"
        className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-xl bg-surface shadow-neu hover:shadow-neu-hover hover:-translate-y-0.5 active:translate-y-0 active:shadow-neu-inset-sm transition-all duration-300 ease-soft text-ink"
      >
        <ArrowUpRightIcon className="h-4 w-4" />
      </a>
    );
  }
  return null;
}

/* -------------------------------------------------------------------- */
/* Editor — cart + inventory                                             */
/* -------------------------------------------------------------------- */

function Editor({
  items,
  inventory,
  busyId,
  onAdd,
  onRemove,
  onUpdateStock,
}: {
  items: OfwRowLine[];
  inventory: OfwRowInventoryItem[];
  busyId: string | null;
  onAdd: (inventoryId: string) => void;
  onRemove: (itemId: string) => void;
  onUpdateStock: (inventoryId: string, stock: number) => Promise<boolean>;
}) {
  const total = items.reduce<bigint>(
    (sum, it) => sum + BigInt(it.price_stroops_at_add) * BigInt(it.quantity),
    0n,
  );

  // Group inventory by category for tidy browsing.
  const inCartByInventoryId = new Map<string, number>();
  for (const it of items) {
    inCartByInventoryId.set(
      it.inventory_id,
      (inCartByInventoryId.get(it.inventory_id) ?? 0) + it.quantity,
    );
  }
  const byCategory = new Map<string, OfwRowInventoryItem[]>();
  for (const inv of inventory) {
    const arr = byCategory.get(inv.category);
    if (arr) arr.push(inv);
    else byCategory.set(inv.category, [inv]);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Cart (left) ---------------------------------------------------- */}
      <div className="lg:col-span-2">
        <p className="text-xs uppercase tracking-[0.18em] text-ink-muted font-medium mb-4">
          In this wishlist
        </p>
        {items.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Family hasn&apos;t added anything yet — pick items from the right.
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-2 mb-4">
              {items.map((it) => {
                const lineTotal =
                  BigInt(it.price_stroops_at_add) * BigInt(it.quantity);
                const busy = busyId === it.id;
                return (
                  <li
                    key={it.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface shadow-neu-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink truncate">
                        {it.inventory_name}
                        {it.inventory_unit ? (
                          <span className="text-ink-muted">
                            {" "}· {it.inventory_unit}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-ink-muted tabular-nums">
                        × {it.quantity} · {formatXlm(lineTotal)} XLM
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(it.id)}
                      disabled={busy}
                      aria-label={`Remove one ${it.inventory_name}`}
                      className={cn(
                        "inline-flex items-center justify-center h-8 w-8 rounded-lg text-sm font-medium",
                        "bg-surface text-ink-muted shadow-neu-sm",
                        "transition-all duration-300 ease-soft",
                        "hover:text-ink hover:shadow-neu hover:-translate-y-0.5",
                        "active:translate-y-0 active:shadow-neu-inset-sm",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                      )}
                    >
                      {busy ? "…" : "−"}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-baseline justify-between pt-3 border-t border-ink/5">
              <span className="text-xs uppercase tracking-[0.14em] text-ink-muted font-medium">
                Subtotal
              </span>
              <span className="font-display text-lg font-bold text-ink tabular-nums">
                {formatXlmWithUnit(total)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Inventory (right) ---------------------------------------------- */}
      <div className="lg:col-span-3">
        <p className="text-xs uppercase tracking-[0.18em] text-ink-muted font-medium mb-4">
          Add from inventory
        </p>
        {inventory.length === 0 ? (
          <p className="text-sm text-ink-muted">No inventory available.</p>
        ) : (
          <div className="space-y-5">
            {Array.from(byCategory.entries()).map(([category, list]) => (
              <div key={category}>
                <p className="text-[10px] uppercase tracking-[0.14em] text-ink-muted font-medium mb-2">
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {list.map((inv) => {
                    const inCart = inCartByInventoryId.get(inv.id) ?? 0;
                    const outOfStock = inv.stock === 0;
                    const busy = busyId === inv.id;
                    return (
                      <li
                        key={inv.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-surface shadow-neu-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">
                            {inv.name}
                          </p>
                          <div className="text-xs text-ink-muted tabular-nums flex items-center gap-1.5 flex-wrap">
                            <span>{formatXlm(BigInt(inv.price_stroops))} XLM</span>
                            <span>·</span>
                            <StockInput
                              inventoryId={inv.id}
                              initialStock={inv.stock}
                              busy={busy}
                              onSave={onUpdateStock}
                            />
                            <span>stock</span>
                            {inCart > 0 ? (
                              <span className="text-accent">· {inCart} in cart</span>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onAdd(inv.id)}
                          disabled={outOfStock || busy}
                          aria-label={`Add ${inv.name}`}
                          className={cn(
                            "inline-flex items-center justify-center h-8 w-8 rounded-lg text-sm font-bold",
                            "bg-surface text-accent shadow-neu-sm",
                            "transition-all duration-300 ease-soft",
                            "hover:shadow-neu hover:-translate-y-0.5",
                            "active:translate-y-0 active:shadow-neu-inset-sm",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                          )}
                        >
                          {busy ? "…" : "+"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* Stock input — inline editable stock count                            */
/* -------------------------------------------------------------------- */

function StockInput({
  inventoryId,
  initialStock,
  busy,
  onSave,
}: {
  inventoryId: string;
  initialStock: number;
  busy: boolean;
  onSave: (inventoryId: string, stock: number) => Promise<boolean>;
}) {
  const [value, setValue] = useState(String(initialStock));
  const [saving, setSaving] = useState(false);

  async function commit() {
    const next = Number.parseInt(value, 10);
    if (!Number.isFinite(next) || next < 0) {
      setValue(String(initialStock));
      return;
    }
    if (next === initialStock) return;
    setSaving(true);
    const ok = await onSave(inventoryId, next);
    setSaving(false);
    if (!ok) setValue(String(initialStock));
  }

  return (
    <input
      type="number"
      min={0}
      step={1}
      inputMode="numeric"
      value={value}
      disabled={busy || saving}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setValue(String(initialStock));
          (e.target as HTMLInputElement).blur();
        }
      }}
      aria-label="Stock"
      className={cn(
        "w-14 px-1.5 py-0.5 rounded-md text-xs text-ink font-medium tabular-nums text-center",
        "bg-surface shadow-neu-inset-sm",
        "focus:outline-none focus:ring-2 focus:ring-accent/40",
        "disabled:opacity-50",
      )}
    />
  );
}
