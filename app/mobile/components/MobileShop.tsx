"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, ArrowUpRight, Lock, Minus, Plus } from "lucide-react";

import { apiPost } from "@/lib/api/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatXlm, formatXlmWithUnit, truncateHash } from "@/lib/format-xlm";
import { useExplorerBase } from "@/lib/stellar/explorer-context";
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
  const STELLAR_EXPLORER_BASE = useExplorerBase();
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
                href={`${STELLAR_EXPLORER_BASE}/tx/${escrowTxHash}`}
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
