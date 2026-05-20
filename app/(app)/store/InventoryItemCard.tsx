"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { storeUpdateInventory } from "@/app/(app)/store/actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { formatXlm, parseXlmToStroops } from "@/lib/format-xlm";

/**
 * One inventory line on the Store dashboard. Three modes:
 *
 *   view    → read-only price + stock, "Edit" button reveals inputs.
 *   edit    → inputs for price/stock, "Cancel" reverts, "Review changes"
 *             advances to the confirmation step.
 *   confirm → shows the diff (old → new) for whichever fields changed,
 *             "Confirm" writes both atomically, "Back" returns to edit.
 *
 * Atomic write means a single server-action call updates both fields in
 * one row — no partial state if e.g. the user changed both and the call
 * fails midway.
 */
export interface InventoryItemCardProps {
  id: string;
  name: string;
  /** Stringified bigint for the server→client boundary. */
  priceStroops: string;
  stock: number;
  unit: string | null;
}

type Mode = "view" | "edit" | "confirm";

export function InventoryItemCard(props: InventoryItemCardProps) {
  const { id, name, priceStroops, stock, unit } = props;

  const initialPriceXlm = formatXlm(BigInt(priceStroops));

  const [mode, setMode] = useState<Mode>("view");
  const [priceValue, setPriceValue] = useState(initialPriceXlm);
  const [stockValue, setStockValue] = useState(String(stock));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function startEdit() {
    setError(null);
    setPriceValue(initialPriceXlm);
    setStockValue(String(stock));
    setMode("edit");
  }

  function cancel() {
    setError(null);
    setPriceValue(initialPriceXlm);
    setStockValue(String(stock));
    setMode("view");
  }

  // Parse-on-demand so the diff view and the save call see the same values.
  function parseChanges(): {
    priceStroopsNext: string | null;
    stockNext: number | null;
    error: string | null;
  } {
    let priceStroopsNext: string | null = null;
    let stockNext: number | null = null;

    if (priceValue.trim() !== initialPriceXlm) {
      const parsed = parseXlmToStroops(priceValue);
      if (parsed === null) {
        return {
          priceStroopsNext: null,
          stockNext: null,
          error: "Price must be a positive number with up to 7 decimals.",
        };
      }
      if (parsed.toString() !== priceStroops) {
        priceStroopsNext = parsed.toString();
      }
    }

    if (stockValue.trim() !== String(stock)) {
      const parsed = Number.parseInt(stockValue, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return {
          priceStroopsNext: null,
          stockNext: null,
          error: "Stock must be a non-negative integer.",
        };
      }
      if (parsed !== stock) {
        stockNext = parsed;
      }
    }

    return { priceStroopsNext, stockNext, error: null };
  }

  function reviewChanges() {
    const { error: parseErr } = parseChanges();
    if (parseErr) {
      setError(parseErr);
      return;
    }
    setError(null);
    setMode("confirm");
  }

  async function confirmSave() {
    const { priceStroopsNext, stockNext, error: parseErr } = parseChanges();
    if (parseErr) {
      setError(parseErr);
      return;
    }
    if (priceStroopsNext === null && stockNext === null) {
      setMode("view");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const r = await storeUpdateInventory({
        inventoryId: id,
        ...(priceStroopsNext !== null ? { priceStroops: priceStroopsNext } : {}),
        ...(stockNext !== null ? { stock: stockNext } : {}),
      });
      if (!r.ok) {
        setError(r.error ?? "Update failed.");
        return;
      }
      setMode("view");
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  const tier =
    stock === 0 ? "out" : stock <= 5 ? "low" : ("ok" as "out" | "low" | "ok");
  const dot =
    tier === "out" ? "bg-red-400" : tier === "low" ? "bg-amber-400" : "bg-accent-teal";
  const stockLabel = tier === "out" ? "Out of stock" : `${stock} left`;

  return (
    <li className="p-5 rounded-2xl bg-surface shadow-neu-inset-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-ink truncate">{name}</p>
          {unit ? <p className="text-xs text-ink-muted mt-0.5">{unit}</p> : null}
        </div>
        {mode === "view" ? (
          <button
            type="button"
            onClick={startEdit}
            className={cn(
              "shrink-0 inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-medium",
              "bg-surface text-ink shadow-neu-sm",
              "transition-all duration-300 ease-soft",
              "hover:-translate-y-0.5 hover:shadow-neu",
              "active:translate-y-0 active:shadow-neu-inset-sm",
            )}
          >
            Edit
          </button>
        ) : null}
      </div>

      {mode === "view" ? (
        <ViewBody
          priceLabel={`${initialPriceXlm} XLM`}
          stockLabel={stockLabel}
          dot={dot}
        />
      ) : mode === "edit" ? (
        <EditBody
          name={name}
          priceValue={priceValue}
          stockValue={stockValue}
          saving={saving}
          onPriceChange={setPriceValue}
          onStockChange={setStockValue}
          onCancel={cancel}
          onReview={reviewChanges}
        />
      ) : (
        <ConfirmBody
          initialPriceXlm={initialPriceXlm}
          initialStock={stock}
          priceValue={priceValue}
          stockValue={stockValue}
          saving={saving}
          onBack={() => {
            setError(null);
            setMode("edit");
          }}
          onConfirm={confirmSave}
        />
      )}

      {error ? (
        <p role="alert" className="mt-3 text-xs text-red-500">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/* -------------------------------------------------------------------- */
/* View                                                                  */
/* -------------------------------------------------------------------- */

function ViewBody({
  priceLabel,
  stockLabel,
  dot,
}: {
  priceLabel: string;
  stockLabel: string;
  dot: string;
}) {
  return (
    <div className="mt-4 flex items-end justify-between gap-3">
      <span className="text-sm text-ink-muted">
        <span className="text-ink font-medium tabular-nums">{priceLabel}</span>
      </span>
      <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-surface shadow-neu-inset-sm text-ink">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
        {stockLabel}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* Edit                                                                  */
/* -------------------------------------------------------------------- */

function EditBody({
  name,
  priceValue,
  stockValue,
  saving,
  onPriceChange,
  onStockChange,
  onCancel,
  onReview,
}: {
  name: string;
  priceValue: string;
  stockValue: string;
  saving: boolean;
  onPriceChange: (next: string) => void;
  onStockChange: (next: string) => void;
  onCancel: () => void;
  onReview: () => void;
}) {
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-[0.14em] text-ink-muted font-medium mb-1.5">
            Price (XLM)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={priceValue}
            disabled={saving}
            onChange={(e) => onPriceChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onReview();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
            aria-label={`Price for ${name}`}
            className={cn(
              "w-full px-2.5 py-1.5 rounded-lg text-sm text-ink font-medium tabular-nums",
              "bg-surface shadow-neu-inset-sm",
              "focus:outline-none focus:ring-2 focus:ring-accent/40",
              "disabled:opacity-50",
            )}
          />
        </label>

        <label className="block">
          <span className="block text-[10px] uppercase tracking-[0.14em] text-ink-muted font-medium mb-1.5">
            Stock
          </span>
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={stockValue}
            disabled={saving}
            onChange={(e) => onStockChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onReview();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
            aria-label={`Stock for ${name}`}
            className={cn(
              "w-full px-2.5 py-1.5 rounded-lg text-sm text-ink font-medium tabular-nums",
              "bg-surface shadow-neu-inset-sm",
              "focus:outline-none focus:ring-2 focus:ring-accent/40",
              "disabled:opacity-50",
            )}
          />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onReview}
          disabled={saving}
        >
          Review changes
        </Button>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------- */
/* Confirm                                                               */
/* -------------------------------------------------------------------- */

function ConfirmBody({
  initialPriceXlm,
  initialStock,
  priceValue,
  stockValue,
  saving,
  onBack,
  onConfirm,
}: {
  initialPriceXlm: string;
  initialStock: number;
  priceValue: string;
  stockValue: string;
  saving: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const priceChanged = priceValue.trim() !== initialPriceXlm;
  const stockChanged = stockValue.trim() !== String(initialStock);
  const noChanges = !priceChanged && !stockChanged;

  return (
    <div className="mt-4 rounded-xl bg-surface shadow-neu-sm p-4">
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-muted font-medium mb-3">
        Confirm changes
      </p>

      {noChanges ? (
        <p className="text-sm text-ink-muted">
          No changes to save. Go back and edit, or cancel.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {priceChanged ? (
            <li className="flex items-baseline justify-between gap-3">
              <span className="text-ink-muted">Price</span>
              <span className="tabular-nums">
                <span className="text-ink-muted line-through">
                  {initialPriceXlm} XLM
                </span>
                <span className="mx-2 text-ink-muted">→</span>
                <span className="text-ink font-medium">{priceValue.trim()} XLM</span>
              </span>
            </li>
          ) : null}
          {stockChanged ? (
            <li className="flex items-baseline justify-between gap-3">
              <span className="text-ink-muted">Stock</span>
              <span className="tabular-nums">
                <span className="text-ink-muted line-through">{initialStock}</span>
                <span className="mx-2 text-ink-muted">→</span>
                <span className="text-ink font-medium">{stockValue.trim()}</span>
              </span>
            </li>
          ) : null}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onBack}
          disabled={saving}
        >
          Back
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onConfirm}
          disabled={saving || noChanges}
        >
          {saving ? "Saving…" : "Confirm"}
        </Button>
      </div>
    </div>
  );
}
