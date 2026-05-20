import { Card } from "@/components/ui/Card";
import { IconWell } from "@/components/ui/IconWell";
import {
  ArrowUpRightIcon,
  CheckCircleIcon,
  LockIcon,
  PackageIcon,
} from "@/components/ui/icons";
import type { StoreReceipt } from "@/lib/dashboard/store";
import { formatXlm, formatXlmWithUnit, truncateHash } from "@/lib/format-xlm";
import { timeAgo } from "@/lib/time-ago";

/**
 * One settled order — items, total, lock + release tx hashes.
 *
 * Server component (no interactivity needed). Rendered in the
 * Receipts panel below the active order queue on /store.
 */
export function ReceiptCard({ receipt }: { receipt: StoreReceipt }) {
  const { order, items } = receipt;
  // Receipt total is recomputed from line items rather than trusting
  // wishlist.total_stroops — same defensive pattern as the family
  // dashboard. The release tx amount is the authoritative on-chain
  // figure (shown separately in the chain-evidence row below).
  const subtotal = items.reduce<bigint>(
    (sum, it) => sum + it.price_stroops_at_add * BigInt(it.quantity),
    0n,
  );

  return (
    <Card className="p-6 md:p-8" tone="extruded" size="md">
      {/* Header: family + time + paid pill */}
      <div className="flex items-start gap-4 mb-6">
        <IconWell size="sm" tone="teal" depth="shallow">
          <CheckCircleIcon className="h-5 w-5" />
        </IconWell>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-medium">
            Receipt · {timeAgo(order.updated_at)}
          </p>
          <p className="mt-1 font-display text-lg font-bold text-ink truncate">
            {order.family_name}
          </p>
          {order.notes ? (
            <p className="text-xs text-ink-muted truncate">{order.notes}</p>
          ) : null}
        </div>
        <span className="shrink-0 inline-flex items-center gap-2 bg-surface shadow-neu-inset-sm rounded-full px-3 py-1.5 text-xs font-medium text-accent-teal">
          <span className="h-2 w-2 rounded-full bg-accent-teal" aria-hidden />
          Paid
        </span>
      </div>

      {/* Line items */}
      <ul className="flex flex-col gap-2 mb-5">
        {items.length === 0 ? (
          <li className="text-sm text-ink-muted">No line items on file.</li>
        ) : (
          items.map((it, idx) => {
            const lineTotal = it.price_stroops_at_add * BigInt(it.quantity);
            return (
              <li
                key={idx}
                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface shadow-neu-inset-sm"
              >
                <PackageIcon className="h-4 w-4 text-ink-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-ink text-sm truncate">
                    {it.inventory_name}
                    {it.inventory_unit ? (
                      <span className="text-ink-muted"> · {it.inventory_unit}</span>
                    ) : null}
                  </p>
                </div>
                <span className="text-xs text-ink-muted tabular-nums">
                  × {it.quantity}
                </span>
                <span className="text-sm font-medium text-ink tabular-nums w-24 text-right">
                  {formatXlm(lineTotal)} XLM
                </span>
              </li>
            );
          })
        )}
      </ul>

      {/* Subtotal */}
      <div className="flex items-center justify-between px-3 mb-6">
        <span className="text-sm text-ink-muted">Total</span>
        <span className="font-display text-xl font-extrabold text-ink tabular-nums">
          {formatXlmWithUnit(subtotal)}
        </span>
      </div>

      {/* On-chain evidence row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-5 border-t border-ink/5">
        <ChainRef
          label="Locked"
          icon={<LockIcon className="h-4 w-4" />}
          txHash={order.escrow_tx_hash}
        />
        <ChainRef
          label="Released"
          icon={<CheckCircleIcon className="h-4 w-4" />}
          txHash={order.release_tx_hash}
        />
      </div>
    </Card>
  );
}

function ChainRef({
  label,
  icon,
  txHash,
}: {
  label: string;
  icon: React.ReactNode;
  txHash: string | null;
}) {
  if (!txHash) {
    return (
      <div className="p-3 rounded-xl bg-surface shadow-neu-inset-sm">
        <p className="text-[10px] uppercase tracking-[0.14em] text-ink-muted font-medium flex items-center gap-2">
          {icon}
          {label}
        </p>
        <p className="mt-1.5 text-xs text-ink-muted">No tx recorded</p>
      </div>
    );
  }
  return (
    <a
      href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
      target="_blank"
      rel="noreferrer"
      className="group p-3 rounded-xl bg-surface shadow-neu-inset-sm hover:shadow-neu-sm transition-shadow"
    >
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-muted font-medium flex items-center gap-2">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 text-xs font-mono text-accent truncate group-hover:text-accent-light transition-colors flex items-center gap-1.5">
        {truncateHash(txHash, 10, 6)}
        <ArrowUpRightIcon className="h-3 w-3" />
      </p>
    </a>
  );
}
