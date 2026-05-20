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
} from "@/app/(app)/ofw/actions";
import { apiPost } from "@/lib/api/client";
import { formatXlm, formatXlmWithUnit, truncateHash } from "@/lib/format-xlm";
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
    return (
      <div className="flex items-center gap-2 shrink-0">
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
        {escrowTxHash ? (
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${escrowTxHash}`}
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
        href={`https://stellar.expert/explorer/testnet/tx/${escrowTxHash}`}
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
}: {
  items: OfwRowLine[];
  inventory: OfwRowInventoryItem[];
  busyId: string | null;
  onAdd: (inventoryId: string) => void;
  onRemove: (itemId: string) => void;
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
                          <p className="text-xs text-ink-muted tabular-nums">
                            {formatXlm(BigInt(inv.price_stroops))} XLM
                            {inCart > 0 ? (
                              <span className="text-accent"> · {inCart} in cart</span>
                            ) : (
                              <span> · {inv.stock} stock</span>
                            )}
                          </p>
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
