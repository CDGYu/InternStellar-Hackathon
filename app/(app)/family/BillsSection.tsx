import { Card } from "@/components/ui/Card";
import { IconWell } from "@/components/ui/IconWell";
import { CheckCircleIcon, CoinsIcon } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { formatXlmWithUnit } from "@/lib/format-xlm";

import { AddBillForm } from "./AddBillForm";

/**
 * Family-side "Bills" section.
 *
 * Two halves:
 *   1. Add a bill — picks a biller, sets account number, amount, due date.
 *      POSTs to /api/bills/add. The family is the only role that can add
 *      bills (matches the demo's "family knows their bills, OFW funds them"
 *      framing — see app/api/bills/add/route.ts).
 *   2. Current bills — read-only list of what's outstanding so the family
 *      can see what the OFW will see on /ofw. The OFW dashboard owns the
 *      actual "Pay" buttons.
 *
 * Bigints are stringified at the prop boundary because client-side React
 * can't serialize them. This mirrors the OFW dashboard's BillsPanel wiring.
 */

export interface FamilyBillView {
  id: string;
  biller_name: string;
  biller_category: string;
  account_number: string;
  /** Stringified bigint. */
  amount_stroops: string;
  due_date: string;
  status: "due" | "paid" | "overdue";
}

export interface FamilyBillerOption {
  id: string;
  name: string;
  category: string;
}

export function BillsSection({
  familyId,
  billers,
  bills,
}: {
  familyId: string;
  billers: FamilyBillerOption[];
  bills: FamilyBillView[];
}) {
  // Same effective-status rule as OFW BillsPanel: a 'due' row past its
  // due_date is rendered as 'overdue', without mutating the DB row.
  const today = new Date().toISOString().slice(0, 10);
  type EffectiveStatus = "due" | "paid" | "overdue";
  const effective = bills.map((b) => {
    const effective_status: EffectiveStatus =
      b.status === "paid" ? "paid" : b.due_date < today ? "overdue" : "due";
    return { ...b, effective_status };
  });

  const unpaid = effective.filter((b) => b.effective_status !== "paid");
  const paid = effective.filter((b) => b.effective_status === "paid");

  return (
    <Card className="p-8 md:p-10">
      <div className="flex items-start gap-5 mb-8">
        <IconWell tone="accent" size="md">
          <CoinsIcon className="h-6 w-6" />
        </IconWell>
        <div className="min-w-0">
          <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
            Bills
          </h2>
          <p className="text-ink-muted mt-2 text-sm md:text-base">
            Add a household bill so your OFW can settle it from their dashboard
            — Meralco, Maynilad, and any other seeded biller.
          </p>
        </div>
      </div>

      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h3 className="text-xs uppercase tracking-[0.16em] text-ink-muted font-medium mb-4">
            Add a bill
          </h3>
          <AddBillForm familyId={familyId} billers={billers} />
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-[0.16em] text-ink-muted font-medium mb-4">
            Current bills ({unpaid.length} unpaid)
          </h3>

          {unpaid.length === 0 ? (
            <div className="p-6 rounded-2xl bg-surface shadow-neu-inset-sm text-center">
              <p className="text-sm text-ink-muted">
                Nothing outstanding right now.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {unpaid.map((b) => (
                <BillRow key={b.id} bill={b} />
              ))}
            </ul>
          )}

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
                      {b.biller_name} · {b.account_number}
                    </span>
                    <span className="text-ink font-medium tabular-nums">
                      {formatXlmWithUnit(BigInt(b.amount_stroops))}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function BillRow({
  bill,
}: {
  bill: FamilyBillView & { effective_status: "due" | "paid" | "overdue" };
}) {
  const isOverdue = bill.effective_status === "overdue";
  return (
    <li className="flex items-start gap-4 p-4 rounded-2xl bg-surface shadow-neu-inset-sm">
      <IconWell size="sm" tone={isOverdue ? "default" : "accent"} depth="shallow">
        <CoinsIcon className="h-5 w-5" />
      </IconWell>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <p className="font-display text-base font-bold text-ink">
            {bill.biller_name}
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em] font-medium",
              "bg-surface shadow-neu-inset-sm",
              isOverdue ? "text-red-500" : "text-ink-muted",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isOverdue ? "bg-red-400" : "bg-amber-400",
              )}
              aria-hidden
            />
            {bill.effective_status}
          </span>
          <span className="text-xs text-ink-muted">{bill.biller_category}</span>
        </div>
        <p className="text-ink-muted text-sm">
          Account <span className="font-mono text-ink">{bill.account_number}</span>
        </p>
        <p className="text-ink-muted text-sm mt-1">
          <span className="text-ink font-display font-bold tabular-nums">
            {formatXlmWithUnit(BigInt(bill.amount_stroops))}
          </span>
          <span className="mx-2">·</span>
          <span className={isOverdue ? "text-red-500" : ""}>
            Due {bill.due_date}
          </span>
        </p>
      </div>
    </li>
  );
}
