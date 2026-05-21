"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowUpRightIcon } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { apiPost } from "@/lib/api/client";

/**
 * Family-side "Add a bill" form.
 *
 * Picks from the seeded biller list (Meralco / Maynilad / …). We deliberately
 * don't allow creating a brand-new biller from here — testnet payouts require
 * a Friendbot-funded stellar_address, and that setup belongs in
 * `npm run setup-billers`, not a user-facing form.
 *
 * Amount entry is in XLM (what users think in); converted to stroops at the
 * wire boundary, matching the pattern in SendFundsForm.
 */

const STROOPS_PER_XLM = 10_000_000n;

/** "12.5" → 125_000_000n. Rejects bad input by returning null. */
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

export interface BillerChoice {
  id: string;
  name: string;
  category: string;
}

export function AddBillForm({
  familyId,
  billers,
}: {
  familyId: string;
  billers: BillerChoice[];
}) {
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
      const result = await apiPost<{ biller_name: string }>("/api/bills/add", {
        family_id: familyId,
        biller_id: billerId,
        account_number: accountNumber.trim(),
        amount_stroops: stroops.toString(),
        due_date: dueDate,
      });
      if (!result.ok) {
        setError(result.message ?? "Could not add this bill.");
        return;
      }
      setSuccessName(result.data.biller_name);
      // Reset the volatile fields; keep biller selection sticky.
      setAccountNumber("");
      setAmountXlm("");
      setDueDate(defaultDueDate());
      startTransition(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  }

  if (billers.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-surface shadow-neu-inset-sm text-center">
        <p className="text-sm text-ink-muted">
          No billers configured yet. Run{" "}
          <code className="font-mono text-ink">npm run setup-billers</code> to
          seed Meralco + Maynilad.
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
      className="flex flex-col gap-5"
    >
      <div>
        <label
          htmlFor="add-bill-biller"
          className="block text-xs uppercase tracking-[0.16em] text-ink-muted font-medium mb-2.5"
        >
          Biller
        </label>
        <select
          id="add-bill-biller"
          value={billerId}
          onChange={(e) => setBillerId(e.target.value)}
          className={cn(
            "w-full bg-surface text-ink rounded-2xl px-5 py-3.5",
            "shadow-neu-inset placeholder:text-ink-placeholder",
            "transition-shadow duration-300 ease-soft",
            "focus:outline-none focus:shadow-neu-inset-deep",
            "appearance-none",
          )}
        >
          {billers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} · {b.category}
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Account number"
        value={accountNumber}
        onChange={(e) => setAccountNumber(e.target.value)}
        placeholder="e.g. 1234-5678"
        autoComplete="off"
        required
      />

      <Input
        label="Amount (XLM)"
        value={amountXlm}
        onChange={(e) => setAmountXlm(e.target.value)}
        placeholder="e.g. 30"
        inputMode="decimal"
        required
        error={
          amountXlm && !amountOk
            ? "Enter a positive amount with up to 7 decimal places."
            : null
        }
        hint={amountOk ? `${stroops!.toString()} stroops` : "1 XLM = 10,000,000 stroops"}
      />

      <Input
        label="Due date"
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        required
      />

      {error ? (
        <div
          role="alert"
          className="rounded-2xl bg-surface shadow-neu-inset-sm px-4 py-3 text-sm text-red-500"
        >
          {error}
        </div>
      ) : null}

      {successName ? (
        <div
          role="status"
          className="rounded-2xl bg-surface shadow-neu-inset-sm px-4 py-3 text-sm text-accent-teal"
        >
          Added a {successName} bill. The OFW will see it on /ofw.
        </div>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={!canSubmit}
        className="w-full sm:w-auto self-start"
      >
        {submitting ? "Adding…" : "Add bill"}
        {submitting ? null : <ArrowUpRightIcon className="h-4 w-4" />}
      </Button>
    </form>
  );
}

/** Default the date picker to a week out — most household bills are mid-month. */
function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}
