import { ArrowDownCircle, CheckCircle, Lock, TrendingUp } from "lucide-react";

import type { SettlementRow } from "@/lib/dashboard/ofw";
import { formatXlmWithUnit, truncateHash } from "@/lib/format-xlm";
import { STELLAR_EXPLORER_BASE } from "@/lib/stellar/explorer";
import { timeAgo } from "@/lib/time-ago";

type MobileActivityProps = {
  rows: SettlementRow[];
  stellarAddress?: string | null;
};

/**
 * On-chain settlement timeline. Renders the `activity` array from
 * `loadOfwDashboard` (or family's equivalent if Phase 3 wires it).
 * Each row is a deposit / lock / release event with the amount, the
 * tied wishlist (if any), a truncated tx hash linking to Stellar
 * Expert, and a relative timestamp.
 *
 * The component is role-agnostic — it just takes a row array.
 * `stellarAddress` is reserved for a future "from address" badge on
 * deposits; not used in Phase 2 but accepted so callers don't need
 * to change later.
 */
export function MobileActivity({ rows }: MobileActivityProps) {
  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-extrabold mb-2">Activity</h2>
          <p className="text-sm text-[#6b7280] leading-relaxed">
            Every on-chain event for your account, newest first.
          </p>
        </div>

        <div className="p-8 text-center bg-white border border-black/5 rounded-3xl">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-7 h-7 text-[#9ca3af]" />
          </div>
          <p className="text-sm font-semibold text-[#1a1d2e] mb-1">
            No on-chain activity yet
          </p>
          <p className="text-xs text-[#6b7280] leading-relaxed">
            Your deposits and escrow events will appear here once you
            send funds. Tap{" "}
            <span className="font-semibold text-[#5b7cff]">Send</span>{" "}
            to fund your first split.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold mb-2">Activity</h2>
        <p className="text-sm text-[#6b7280] leading-relaxed">
          Every on-chain event for your account, newest first.
        </p>
      </div>

      <ul className="space-y-3">
        {rows.map((row) => (
          <ActivityRow key={row.id} row={row} />
        ))}
      </ul>
    </div>
  );
}

function ActivityRow({ row }: { row: SettlementRow }) {
  const variant = VARIANTS[row.event_type];
  const wishlistLabel = row.wishlist_notes || "Untitled wishlist";

  return (
    <li className="p-4 bg-white border border-black/5 shadow-sm rounded-3xl flex items-start gap-3">
      <div
        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${variant.gradient} flex items-center justify-center shrink-0 shadow-sm`}
      >
        <variant.Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#1a1d2e]">
          {variant.verb} {formatXlmWithUnit(row.amount_stroops)}
        </p>
        <p className="text-[12px] text-[#6b7280] mt-0.5 truncate">
          {variant.preposition}{" "}
          <span className="italic">&ldquo;{wishlistLabel}&rdquo;</span>
        </p>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-[#9ca3af]">
          <a
            href={`${STELLAR_EXPLORER_BASE}/tx/${row.tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[#5b7cff] hover:underline"
          >
            {truncateHash(row.tx_hash)}
          </a>
          <span>·</span>
          <span>{timeAgo(row.created_at)}</span>
        </div>
      </div>
    </li>
  );
}

const VARIANTS = {
  deposit: {
    Icon: ArrowDownCircle,
    gradient: "from-blue-500 to-blue-600",
    verb: "Deposited",
    preposition: "into",
  },
  lock: {
    Icon: Lock,
    gradient: "from-amber-500 to-orange-500",
    verb: "Locked",
    preposition: "for",
  },
  release: {
    Icon: CheckCircle,
    gradient: "from-emerald-400 to-emerald-600",
    verb: "Released",
    preposition: "from",
  },
} as const;
