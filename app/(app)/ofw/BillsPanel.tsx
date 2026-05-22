"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconWell } from "@/components/ui/IconWell";
import {
  ArrowUpRightIcon,
  CheckCircleIcon,
  CoinsIcon,
} from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { apiPost } from "@/lib/api/client";
import { formatXlm, formatXlmWithUnit, truncateHash } from "@/lib/format-xlm";
import { useExplorerBase } from "@/lib/stellar/explorer-context";

/**
 * Bills panel — OFW pays household utilities (Meralco, Maynilad, …)
 * with one click. Each Pay button fires POST /api/bills/pay → plain
 * Stellar testnet transfer to the biller's wallet → bill_payment row.
 *
 * "Pay all due" iterates the due list serially (one tx at a time —
 * Horizon doesn't love parallel submissions from the same source
 * account because of the sequence number) and stops on the first
 * failure with a clear message.
 *
 * Production note (also surfaced in the panel footer): to actually
 * land PHP at the biller's bank, you need a Stellar Anchor partnership
 * for the XLM↔PHP off-ramp. The panel deliberately calls this out so
 * the demo's framing is honest.
 */

export interface BillPanelRow {
  id: string;
  biller: {
    id: string;
    name: string;
    category: string;
    stellar_address: string | null;
  };
  account_number: string;
  /** Stringified bigint. */
  amount_stroops: string;
  /** ISO date YYYY-MM-DD. */
  due_date: string;
  status: "due" | "paid" | "overdue";
  autopay_enabled: boolean;
}

export function BillsPanel({
  ofwId,
  bills,
}: {
  ofwId: string;
  bills: BillPanelRow[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    paid: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Compute effective status: status='due' + due_date < today → overdue
  // for display purposes. The DB row stays 'due' until something flips
  // it (eventually a cron job; for demo it stays 'due').
  const today = new Date().toISOString().slice(0, 10);
  type EffectiveStatus = "due" | "paid" | "overdue";
  const effective = bills.map((b) => {
    const effective_status: EffectiveStatus =
      b.status === "paid"
        ? "paid"
        : b.due_date < today
        ? "overdue"
        : "due";
    return { ...b, effective_status };
  });

  const unpaid = effective.filter((b) => b.effective_status !== "paid");
  const paid = effective.filter((b) => b.effective_status === "paid");

  const totalDueStroops = unpaid.reduce<bigint>(
    (sum, b) => sum + BigInt(b.amount_stroops),
    0n,
  );

  async function payOne(billId: string): Promise<{ ok: boolean; message?: string }> {
    const result = await apiPost<{ tx_hash: string }>("/api/bills/pay", {
      ofw_id: ofwId,
      bill_id: billId,
    });
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    return { ok: true };
  }

  async function handlePayOne(billId: string) {
    setError(null);
    setBusyId(billId);
    try {
      const r = await payOne(billId);
      if (!r.ok) {
        setError(r.message ?? "Payment failed.");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusyId(null);
    }
  }

  async function handlePayAll() {
    setError(null);
    const queue = unpaid.map((b) => b.id);
    if (queue.length === 0) return;
    setBatchProgress({ paid: 0, total: queue.length });
    try {
      for (let i = 0; i < queue.length; i++) {
        const billId = queue[i];
        setBusyId(billId);
        const r = await payOne(billId);
        if (!r.ok) {
          setError(
            `Paid ${i} of ${queue.length}, then failed on bill ${i + 1}: ${r.message}`,
          );
          return;
        }
        setBatchProgress({ paid: i + 1, total: queue.length });
      }
      // All paid — refresh so the page picks up the new DB state.
      startTransition(() => router.refresh());
    } finally {
      setBusyId(null);
      setBatchProgress(null);
    }
  }

  return (
    <Card className="p-8 md:p-10">
      <div className="flex items-end justify-between gap-6 mb-8">
        <div className="flex items-start gap-5 min-w-0">
          <IconWell tone="accent" size="md">
            <CoinsIcon className="h-6 w-6" />
          </IconWell>
          <div className="min-w-0">
            <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
              Bills
            </h2>
            <p className="text-ink-muted mt-2 text-sm md:text-base">
              Pay your family&apos;s utilities straight from your wallet. Each
              click submits a real Stellar testnet transfer to the biller.
            </p>
          </div>
        </div>
        {unpaid.length > 0 ? (
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handlePayAll}
            disabled={busyId !== null || batchProgress !== null}
            className="shrink-0"
          >
            {batchProgress
              ? `Paying ${batchProgress.paid + 1}/${batchProgress.total}…`
              : `Pay all due · ${formatXlm(totalDueStroops)} XLM`}
            {batchProgress ? null : <CheckCircleIcon className="h-4 w-4" />}
          </Button>
        ) : null}
      </div>

      {bills.length === 0 ? (
        <div className="p-6 rounded-2xl bg-surface shadow-neu-inset-sm text-center">
          <p className="text-sm text-ink-muted">
            No bills configured yet. Run{" "}
            <code className="font-mono text-ink">npm run setup-billers</code> to
            seed Meralco + Maynilad for the demo family.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {effective.map((b) => (
            <BillRowCard
              key={b.id}
              bill={b}
              busy={busyId === b.id}
              onPay={() => handlePayOne(b.id)}
            />
          ))}
        </ul>
      )}

      {error ? (
        <div
          role="alert"
          className="mt-6 rounded-2xl bg-surface shadow-neu-inset-sm px-4 py-3 text-sm text-red-500"
        >
          {error}
        </div>
      ) : null}

      <p className="mt-8 text-xs text-ink-muted">
        <span className="font-medium text-ink">Production note:</span>{" "}
        XLM lands at the biller&apos;s testnet wallet — to settle as PHP at
        the real Meralco / Maynilad account, the platform needs a Stellar
        Anchor partnership for the XLM↔PHP off-ramp (slide 10 ask).
      </p>

      {paid.length > 0 ? (
        <details className="mt-6 group">
          <summary className="cursor-pointer text-xs uppercase tracking-[0.16em] text-ink-muted font-medium hover:text-ink transition-colors">
            {paid.length} paid · view receipts
          </summary>
          <ul className="mt-4 flex flex-col gap-2">
            {paid.map((b) => (
              <li
                key={b.id}
                className="text-xs text-ink-muted px-3 py-2 rounded-xl bg-surface shadow-neu-inset-sm flex items-center gap-3"
              >
                <CheckCircleIcon className="h-4 w-4 text-accent-teal shrink-0" />
                <span className="flex-1 truncate">
                  {b.biller.name} · {b.account_number}
                </span>
                <span className="text-ink font-medium tabular-nums">
                  {formatXlm(BigInt(b.amount_stroops))} XLM
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

/* -------------------------------------------------------------------- */
/* One bill row                                                          */
/* -------------------------------------------------------------------- */

function BillRowCard({
  bill,
  busy,
  onPay,
}: {
  bill: BillPanelRow & { effective_status: "due" | "paid" | "overdue" };
  busy: boolean;
  onPay: () => void;
}) {
  const STELLAR_EXPLORER_BASE = useExplorerBase();
  const isPaid = bill.effective_status === "paid";
  const isOverdue = bill.effective_status === "overdue";

  // Friendly date — "Due in 5 days" / "Overdue by 2 days" / "Paid 3d ago".
  const dueLabel = formatDueLabel(bill.due_date, bill.effective_status);

  return (
    <li className="flex items-start gap-5 p-5 rounded-2xl bg-surface shadow-neu-inset-sm">
      <IconWell
        size="sm"
        tone={isPaid ? "teal" : isOverdue ? "default" : "accent"}
        depth="shallow"
      >
        {isPaid ? (
          <CheckCircleIcon className="h-5 w-5" />
        ) : (
          <CoinsIcon className="h-5 w-5" />
        )}
      </IconWell>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <p className="font-display text-base font-bold text-ink">
            {bill.biller.name}
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em] font-medium",
              "bg-surface shadow-neu-inset-sm",
              isPaid
                ? "text-accent-teal"
                : isOverdue
                ? "text-red-500"
                : "text-ink-muted",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isPaid ? "bg-accent-teal" : isOverdue ? "bg-red-400" : "bg-amber-400",
              )}
              aria-hidden
            />
            {bill.effective_status}
          </span>
          <span className="text-xs text-ink-muted">{bill.biller.category}</span>
        </div>
        <p className="text-ink-muted text-sm">
          Account{" "}
          <span className="font-mono text-ink">{bill.account_number}</span>
        </p>
        <p className="text-ink-muted text-sm mt-1">
          <span className="text-ink font-display font-bold tabular-nums">
            {formatXlmWithUnit(BigInt(bill.amount_stroops))}
          </span>
          <span className="mx-2">·</span>
          <span className={isOverdue ? "text-red-500" : ""}>{dueLabel}</span>
        </p>
        {bill.biller.stellar_address ? (
          <p className="text-[11px] text-ink-muted font-mono mt-1.5">
            →{" "}
            <a
              href={`${STELLAR_EXPLORER_BASE}/account/${bill.biller.stellar_address}`}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-accent-light transition-colors"
            >
              {truncateHash(bill.biller.stellar_address, 10, 6)}
            </a>
          </p>
        ) : null}
      </div>

      {isPaid ? (
        <span className="shrink-0 self-center text-xs text-ink-muted">Settled</span>
      ) : (
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onPay}
          disabled={busy}
          className="shrink-0 self-center"
        >
          {busy ? "Paying…" : "Pay"}
          {busy ? null : <ArrowUpRightIcon className="h-4 w-4" />}
        </Button>
      )}
    </li>
  );
}

function formatDueLabel(
  dueIsoDate: string,
  status: "due" | "paid" | "overdue",
): string {
  const due = new Date(dueIsoDate + "T00:00:00Z");
  const today = new Date();
  // Strip times so we compare whole days.
  const t = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const days = Math.round((due.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));

  if (status === "paid") return "Paid";
  if (days === 0) return "Due today";
  if (days > 0) return `Due in ${days} day${days === 1 ? "" : "s"}`;
  const overdue = Math.abs(days);
  return `Overdue by ${overdue} day${overdue === 1 ? "" : "s"}`;
}
