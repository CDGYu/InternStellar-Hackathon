"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconWell } from "@/components/ui/IconWell";
import { StatusPill, type WishlistStatus } from "@/components/ui/StatusPill";
import { ArrowUpRightIcon, LockIcon, PackageIcon } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { apiPost } from "@/lib/api/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatXlm, formatXlmWithUnit, truncateHash } from "@/lib/format-xlm";
import { useExplorerBase } from "@/lib/stellar/explorer-context";

/**
 * Family's interactive wishlist builder.
 *
 * Two write paths:
 *   - Add / Remove items → cookie-bound Supabase writes (RLS:
 *     family_writes_own_wishlist + family_writes_wishlist_item).
 *   - Lock funds → POST /api/escrow/lock (Bearer-token; calls the
 *     Soroban contract before flipping wishlist.status to 'locked').
 *
 * After every successful write we router.refresh() so the rest of the
 * page (totals, activity feed, wishlist groups) re-renders with the
 * server's view of the world. The local state is the optimistic mirror
 * — refresh makes it authoritative again.
 *
 * Lockable statuses: draft, pending_approval. Anything past that (locked,
 * delivered, released) freezes the editing UI.
 */

export interface BuilderInventoryItem {
  id: string;
  name: string;
  category: string;
  /** Stringified bigint — easier to pass through a server → client boundary. */
  price_stroops: string;
  stock: number;
  unit: string | null;
}

export interface BuilderLineItem {
  id: string;
  inventory_id: string;
  inventory_name: string;
  inventory_unit: string | null;
  quantity: number;
  /** Stringified bigint. */
  price_stroops_at_add: string;
}

export interface WishlistBuilderProps {
  familyId: string;
  inventory: BuilderInventoryItem[];
  initialWishlistId: string | null;
  initialStatus: WishlistStatus | null;
  initialItems: BuilderLineItem[];
  initialEscrowTxHash: string | null;
}

const LOCKABLE_STATUSES: WishlistStatus[] = ["draft", "pending_approval"];

export function WishlistBuilder({
  familyId,
  inventory,
  initialWishlistId,
  initialStatus,
  initialItems,
  initialEscrowTxHash,
}: WishlistBuilderProps) {
  const STELLAR_EXPLORER_BASE = useExplorerBase();
  const router = useRouter();
  const [wishlistId, setWishlistId] = useState<string | null>(initialWishlistId);
  const [status, setStatus] = useState<WishlistStatus | null>(initialStatus);
  const [items, setItems] = useState<BuilderLineItem[]>(initialItems);
  const [escrowTxHash, setEscrowTxHash] = useState<string | null>(initialEscrowTxHash);
  const [pending, startTransition] = useTransition();
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editable = status === null || LOCKABLE_STATUSES.includes(status);

  const totalStroops = items.reduce<bigint>(
    (sum, it) => sum + BigInt(it.price_stroops_at_add) * BigInt(it.quantity),
    0n,
  );

  // Group inventory by category for the grid. Quantity in the cart per
  // inventory id, so the card can show "In cart × 2".
  const inCartByInventoryId = new Map<string, number>();
  for (const it of items) {
    inCartByInventoryId.set(
      it.inventory_id,
      (inCartByInventoryId.get(it.inventory_id) ?? 0) + it.quantity,
    );
  }
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

      // Get-or-create the draft wishlist on the first add. The cookie
      // session carries family_id = auth.uid() through the RLS check.
      let wid = wishlistId;
      if (!wid) {
        const { data: newWishlist, error: wErr } = await supabase
          .from("wishlist")
          .insert({
            family_id: familyId,
            status: "draft",
            total_stroops: 0,
          })
          .select("id, status")
          .single();
        if (wErr || !newWishlist) {
          throw new Error(wErr?.message ?? "Could not create wishlist.");
        }
        wid = newWishlist.id as string;
        setWishlistId(wid);
        setStatus(newWishlist.status as WishlistStatus);
      }

      // Check if this inventory id is already on the wishlist — if so,
      // bump its quantity instead of inserting a duplicate row. Cleaner
      // UI than a wall of single-quantity rows when the family clicks
      // Add five times on the same item.
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
            it.id === existing.id ? { ...it, quantity: updated.quantity as number } : it,
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
      // Refresh the page so the parent dashboard's totals/wishlists list
      // catches up. The optimistic local state above kept the cart snappy.
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
      // If quantity > 1, decrement. Otherwise delete the row entirely.
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
  }

  // ---- Render ----------------------------------------------------------

  if (status === "locked" && escrowTxHash) {
    // Locked-state summary card — read-only.
    return (
      <Card className="p-8 md:p-10">
        <div className="flex items-start gap-5">
          <IconWell tone="accent" size="md">
            <LockIcon className="h-6 w-6" />
          </IconWell>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <StatusPill status="locked" />
              <span className="text-xs text-ink-muted">
                Awaiting delivery from the store
              </span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
              Funds locked in escrow
            </h2>
            <p className="mt-2 text-ink-muted">
              {items.length} item{items.length === 1 ? "" : "s"} ·{" "}
              <span className="text-ink font-medium tabular-nums">
                {formatXlmWithUnit(totalStroops)}
              </span>
            </p>
            <a
              href={`${STELLAR_EXPLORER_BASE}/tx/${escrowTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-mono text-accent hover:text-accent-light transition-colors"
            >
              {truncateHash(escrowTxHash, 12, 8)}
              <ArrowUpRightIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-8 md:p-10">
      <div className="flex items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
            Build your wishlist
          </h2>
          <p className="text-ink-muted mt-2 text-sm md:text-base">
            Pick what you need from the store, then lock the funds in escrow.
          </p>
        </div>
        {status ? <StatusPill status={status} /> : null}
      </div>

      {/* Cart — only renders when there's something in it. */}
      {items.length > 0 ? (
        <div className="mb-10 p-6 rounded-2xl bg-surface shadow-neu-inset-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-muted font-medium mb-4">
            In your wishlist
          </p>
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-4 p-3 rounded-xl bg-surface shadow-neu-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-medium truncate">
                    {item.inventory_name}
                    <span className="text-ink-muted font-normal"> × {item.quantity}</span>
                  </p>
                  <p className="text-ink-muted text-xs tabular-nums">
                    {formatXlm(
                      BigInt(item.price_stroops_at_add) * BigInt(item.quantity),
                    )}{" "}
                    XLM
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item)}
                  disabled={!editable || busyItemId === item.id}
                  aria-label={`Remove ${item.inventory_name}`}
                  className={cn(
                    "shrink-0 inline-flex items-center justify-center h-9 px-3 rounded-xl text-xs font-medium",
                    "bg-surface text-ink-muted shadow-neu-sm",
                    "transition-all duration-300 ease-soft",
                    "hover:text-ink hover:shadow-neu hover:-translate-y-0.5",
                    "active:translate-y-0 active:shadow-neu-inset-sm",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
                  )}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center justify-between gap-4 pt-5 border-t border-ink/5">
            <p className="text-ink-muted text-sm">
              Total{" "}
              <span className="text-ink font-display font-bold text-lg tabular-nums ml-2">
                {formatXlmWithUnit(totalStroops)}
              </span>
            </p>
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={lockFunds}
              disabled={!editable || items.length === 0 || pending}
            >
              {pending ? "Locking…" : "Request approval / lock funds"}
              {pending ? null : <LockIcon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mb-6 rounded-2xl bg-surface shadow-neu-inset-sm px-4 py-3 text-sm text-red-500"
        >
          {error}
        </div>
      ) : null}

      {/* Inventory grid */}
      {inventory.length === 0 ? (
        <p className="text-ink-muted text-sm">
          The store hasn&apos;t added any inventory yet.
        </p>
      ) : (
        <div className="space-y-8">
          {Array.from(byCategory.entries()).map(([category, items]) => (
            <div key={category}>
              <p className="text-xs uppercase tracking-[0.18em] text-ink-muted font-medium mb-4">
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((inv) => {
                  const inCart = inCartByInventoryId.get(inv.id) ?? 0;
                  const outOfStock = inv.stock === 0;
                  const busy = busyItemId === inv.id;
                  return (
                    <li
                      key={inv.id}
                      className="p-5 rounded-2xl bg-surface shadow-neu-inset-sm"
                    >
                      <div className="flex items-start gap-3">
                        <IconWell size="sm" tone="default" depth="shallow">
                          <PackageIcon className="h-4 w-4" />
                        </IconWell>
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-base font-bold text-ink truncate">
                            {inv.name}
                          </p>
                          {inv.unit ? (
                            <p className="text-xs text-ink-muted">{inv.unit}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-ink font-medium tabular-nums">
                            {formatXlm(BigInt(inv.price_stroops))} XLM
                          </p>
                          <p className="text-xs text-ink-muted mt-0.5">
                            {outOfStock ? "Out of stock" : `${inv.stock} in stock`}
                            {inCart > 0 ? (
                              <span className="text-accent"> · {inCart} in cart</span>
                            ) : null}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addItem(inv)}
                          disabled={!editable || outOfStock || busy}
                          className={cn(
                            "inline-flex items-center justify-center h-9 px-4 rounded-xl text-xs font-medium",
                            "bg-surface text-accent shadow-neu",
                            "transition-all duration-300 ease-soft",
                            "hover:-translate-y-0.5 hover:shadow-neu-hover",
                            "active:translate-y-0 active:shadow-neu-inset-sm",
                            "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
                          )}
                        >
                          {busy ? "Adding…" : "Add"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
