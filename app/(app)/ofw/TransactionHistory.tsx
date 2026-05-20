import { Card } from "@/components/ui/Card";
import { EventPill, type SettlementEvent } from "@/components/ui/StatusPill";
import { ArrowUpRightIcon } from "@/components/ui/icons";
import { formatXlm, truncateHash } from "@/lib/format-xlm";

/**
 * Statement-style view of every on-chain event tied to the OFW's
 * family wishlists. Replaces the small sidebar Activity feed for /ofw.
 *
 * One caveat surfaced inline: deposit events aren't currently written
 * to the off-chain `settlement` table (deposit isn't tied to a wishlist
 * row, and settlement.wishlist_id is NOT NULL — see deposit/route.ts
 * for the design note). So this panel shows the lock/release half of
 * the truth. For the deposit half we deep-link the OFW's Stellar
 * account on Stellar Expert.
 *
 * Server component — no interactivity; refreshing happens by reloading
 * the page (or via any of the action buttons that already trigger a
 * router.refresh()).
 */
export interface TxHistoryRow {
  id: string;
  event_type: SettlementEvent;
  tx_hash: string;
  amount_stroops: bigint;
  created_at: string;
  wishlist_notes: string | null;
}

const EVENT_DESCRIPTIONS: Record<SettlementEvent, string> = {
  deposit: "Funded the family's bucket allocation",
  lock: "Held funds against an approved wishlist",
  release: "Released to the store on delivery confirmation",
};

export function TransactionHistory({
  rows,
  ofwStellarAddress,
}: {
  rows: TxHistoryRow[];
  ofwStellarAddress: string | null;
}) {
  return (
    <Card className="p-8 md:p-10">
      <div className="flex items-end justify-between gap-6 mb-6">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
            Transaction history
          </h2>
          <p className="text-ink-muted mt-2 text-sm md:text-base">
            Every on-chain event tied to your family&apos;s wishlists.
          </p>
        </div>
        <span className="hidden md:inline-flex items-center bg-surface shadow-neu-inset-sm rounded-full px-3 py-1.5 text-xs font-medium text-ink-muted">
          {rows.length} event{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Footnote: deposits are on-chain only — point to Stellar Expert. */}
      {ofwStellarAddress ? (
        <a
          href={`https://stellar.expert/explorer/testnet/account/${ofwStellarAddress}`}
          target="_blank"
          rel="noreferrer"
          className="group block mb-8 p-4 rounded-2xl bg-surface shadow-neu-inset-sm hover:shadow-neu-sm transition-shadow"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-medium">
            Deposit history is on-chain
          </p>
          <p className="mt-1.5 text-sm text-ink">
            Your full Stellar testnet account, including the deposit half of
            every transaction below.{" "}
            <span className="text-accent group-hover:text-accent-light transition-colors inline-flex items-center gap-1 font-medium">
              View on Stellar Expert
              <ArrowUpRightIcon className="h-3 w-3" />
            </span>
          </p>
        </a>
      ) : (
        <div className="mb-8 p-4 rounded-2xl bg-surface shadow-neu-inset-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-medium">
            Deposit history is on-chain
          </p>
          <p className="mt-1.5 text-sm text-ink-muted">
            Set a Stellar public key on your profile to link the deposit
            half of this audit trail.
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-ink-muted text-sm">
          No transactions yet. Once a lock or release fires, it shows up here.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-surface shadow-neu-inset-sm">
                <EventPill event={row.event_type} className="shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-medium">
                    {EVENT_DESCRIPTIONS[row.event_type]}
                  </p>
                  {row.wishlist_notes ? (
                    <p className="text-xs text-ink-muted truncate mt-0.5">
                      {row.wishlist_notes}
                    </p>
                  ) : null}
                  <p className="text-xs text-ink-muted font-mono mt-1.5 truncate">
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${row.tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:text-accent-light transition-colors"
                    >
                      {truncateHash(row.tx_hash, 12, 8)}
                    </a>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={
                      row.event_type === "release"
                        ? "text-accent-teal font-display text-lg font-extrabold tabular-nums"
                        : row.event_type === "lock"
                        ? "text-ink font-display text-lg font-extrabold tabular-nums"
                        : "text-accent font-display text-lg font-extrabold tabular-nums"
                    }
                  >
                    {formatXlm(row.amount_stroops)} XLM
                  </p>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    {new Date(row.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
