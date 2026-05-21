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
