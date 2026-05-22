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
