"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowRight, CheckCircle } from "lucide-react";

import { apiPost } from "@/lib/api/client";

/**
 * Mobile twin of app/(app)/family/AddBillForm.tsx. Family-only form
 * for adding a household bill (Meralco / Maynilad / …). Posts to the
 * existing /api/bills/add route — no new server logic.
 *
 * Amount entry is in XLM; converted to stroops at the wire boundary.
 * Bigint validation logic mirrors the web's xlmToStroops.
 */

const STROOPS_PER_XLM = 10_000_000n;

/** "12.5" → 125_000_000n. Returns null on invalid input. */
function xlmToStroops(xlm: string): bigint | null {
  const trimmed = xlm.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > 7) return null;
  const fracPadded = frac.padEnd(7, "0");
  try {
    return BigInt(whole) * STROOPS_PER_XLM + BigInt(fracPadded);
  } catch {
    return null;
  }
}

/** Default the date picker to a week out — most household bills are mid-month. */
function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export interface BillerChoice {
  id: string;
  name: string;
  category: string;
}

type Props = {
  familyId: string;
  billers: BillerChoice[];
  onAdded: () => void;
};

export function MobileAddBillForm({ familyId, billers, onAdded }: Props) {
  const router = useRouter();
  const [billerId, setBillerId] = useState<string>(billers[0]?.id ?? "");
  const [accountNumber, setAccountNumber] = useState("");
  const [amountXlm, setAmountXlm] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stroops = useMemo(() => xlmToStroops(amountXlm), [amountXlm]);
  const billerOk = billerId !== "";
  const accountOk = accountNumber.trim().length > 0;
  const amountOk = stroops !== null && stroops > 0n;
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(dueDate);
  const canSubmit = billerOk && accountOk && amountOk && dateOk && !submitting;

  async function submit() {
    if (!canSubmit || stroops === null) return;
    setError(null);
    setSuccessName(null);
    setSubmitting(true);
    try {
      const result = await apiPost<{ biller_name: string }>(
        "/api/bills/add",
        {
          family_id: familyId,
          biller_id: billerId,
          account_number: accountNumber.trim(),
          amount_stroops: stroops.toString(),
          due_date: dueDate,
        },
      );
      if (!result.ok) {
        setError(result.message ?? "Could not add this bill.");
        return;
      }
      setSuccessName(result.data.biller_name);
      // Reset volatile fields; keep biller selection sticky.
      setAccountNumber("");
      setAmountXlm("");
      setDueDate(defaultDueDate());
      startTransition(() => router.refresh());
      // Brief delay so the user sees the success banner before the
      // parent collapses the form.
      window.setTimeout(onAdded, 1200);
    } finally {
      setSubmitting(false);
    }
  }

  if (billers.length === 0) {
    return (
      <div className="p-4 bg-[#f5f7fa] rounded-3xl">
        <p className="text-xs text-[#6b7280] text-center">
          No billers configured. Run{" "}
          <span className="font-mono text-[#1a1d2e]">npm run setup-billers</span>{" "}
          to seed them.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="p-4 bg-[#f5f7fa] rounded-3xl space-y-4"
    >
      <div>
        <label
          htmlFor="add-bill-biller"
          className="block text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mb-1"
        >
          Biller
        </label>
        <select
          id="add-bill-biller"
          value={billerId}
          onChange={(e) => setBillerId(e.target.value)}
          className="w-full bg-white border-0 rounded-2xl h-11 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        >
          {billers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} · {b.category}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="add-bill-account"
          className="block text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mb-1"
        >
          Account number
        </label>
        <input
          id="add-bill-account"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder="e.g. 1234-5678"
          autoComplete="off"
          required
          className="w-full bg-white border-0 rounded-2xl h-11 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
      </div>

      <div>
        <label
          htmlFor="add-bill-amount"
          className="block text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mb-1"
        >
          Amount (XLM)
        </label>
        <input
          id="add-bill-amount"
          value={amountXlm}
          onChange={(e) => setAmountXlm(e.target.value)}
          placeholder="e.g. 30"
          inputMode="decimal"
          required
          className="w-full bg-white border-0 rounded-2xl h-11 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
        <p className="text-[10px] text-[#9ca3af] mt-1.5 px-1">
          {amountXlm && !amountOk
            ? "Enter a positive amount with up to 7 decimal places."
            : amountOk
              ? `${stroops!.toString()} stroops`
              : "1 XLM = 10,000,000 stroops"}
        </p>
      </div>

      <div>
        <label
          htmlFor="add-bill-due"
          className="block text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mb-1"
        >
          Due date
        </label>
        <input
          id="add-bill-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
          className="w-full bg-white border-0 rounded-2xl h-11 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 text-xs rounded-2xl border border-red-100">
          {error}
        </div>
      )}

      {successName && (
        <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-2xl border border-emerald-100 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Added a {successName} bill.
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-3 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {submitting ? "Adding…" : "Add bill"}
        {!submitting && <ArrowRight className="w-4 h-4" />}
      </button>
    </form>
  );
}
