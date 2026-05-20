"use client";

import { useCallback, useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { IconWell } from "@/components/ui/IconWell";
import { ArrowUpRightIcon, LockIcon } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { apiGet } from "@/lib/api/client";

/**
 * Family's bucket balances — read live from the Soroban contract via
 * GET /api/balances/[user_id] → `get_balances` on-chain call.
 *
 * Auto-fetches on mount and gives the user a manual Refresh button.
 * The contract is the source of truth here — these numbers can change
 * mid-session when the OFW deposits, when a lock spends from a bucket,
 * or when a release credits the store from one. We deliberately *don't*
 * subscribe to realtime for this: contract reads are expensive enough
 * that "refresh when you care" beats "refresh constantly."
 *
 * The route returns pre-formatted display strings ("3.45 XLM",
 * "<0.0001 XLM", "0.0000 XLM"). We render those directly rather than
 * re-formatting from the raw stroops — keeps the formatting logic in
 * one place (lib/api/balances).
 */
interface BalancesResponse {
  user_id: string;
  role: string;
  stellar_address: string;
  balances_stroops: {
    utilities: string;
    groceries: string;
    emergency: string;
  };
  display: {
    utilities: string;
    groceries: string;
    emergency: string;
  };
}

export function BalanceBreakdown({ userId }: { userId: string }) {
  const [data, setData] = useState<BalancesResponse | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await apiGet<BalancesResponse>(`/api/balances/${userId}`);
    if (result.ok) {
      setData(result.data);
      setRefreshedAt(new Date());
    } else {
      setError({ code: result.code, message: result.message });
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void fetchBalances();
  }, [fetchBalances]);

  // Friendlier copy for the two most-likely "demo not set up" failure modes.
  const friendlyError = (() => {
    if (!error) return null;
    if (error.code === "address_not_set") {
      return "Your Stellar address isn't set up yet. Once your profile has a stellar_public_key, the bucket balances will load here.";
    }
    if (error.code === "contract_not_configured") {
      return "The Soroban contract isn't configured on this environment — bucket balances are live-only.";
    }
    return error.message;
  })();

  return (
    <Card className="p-8 md:p-10">
      <div className="flex items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
            Your bucket balances
          </h2>
          <p className="text-ink-muted mt-2 text-sm md:text-base">
            What your sponsor has funded, by category. Read live from the
            on-chain contract.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchBalances()}
          disabled={loading}
          aria-label="Refresh balances"
          className={cn(
            "shrink-0 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-xs font-medium",
            "bg-surface text-ink shadow-neu",
            "transition-all duration-300 ease-soft",
            "hover:-translate-y-0.5 hover:shadow-neu-hover",
            "active:translate-y-0 active:shadow-neu-inset-sm",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
          )}
        >
          {loading ? "Refreshing…" : "Refresh"}
          {loading ? null : <ArrowUpRightIcon className="h-3.5 w-3.5" />}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl bg-surface shadow-neu-inset-sm px-5 py-4 text-sm"
        >
          <p className="text-amber-500 font-medium mb-1">Couldn&apos;t load balances</p>
          <p className="text-ink-muted">{friendlyError}</p>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <BucketCard
              label="Utilities"
              hint="Electricity, water, internet"
              display={data?.display.utilities}
              loading={loading && !data}
            />
            <BucketCard
              label="Groceries"
              hint="Daily food & essentials"
              display={data?.display.groceries}
              loading={loading && !data}
            />
            <BucketCard
              label="Emergency"
              hint="Medicine & contingency"
              display={data?.display.emergency}
              loading={loading && !data}
            />
          </ul>

          {refreshedAt && data ? (
            <p className="mt-5 text-xs text-ink-muted text-right">
              Last refreshed at{" "}
              {refreshedAt.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}{" "}
              · contract address{" "}
              <span className="font-mono">
                {data.stellar_address.slice(0, 6)}…{data.stellar_address.slice(-4)}
              </span>
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}

function BucketCard({
  label,
  hint,
  display,
  loading,
}: {
  label: string;
  hint: string;
  display: string | undefined;
  loading: boolean;
}) {
  return (
    <li className="p-5 rounded-2xl bg-surface shadow-neu-inset-sm">
      <div className="flex items-start gap-3 mb-3">
        <IconWell size="sm" tone="accent" depth="shallow">
          <LockIcon className="h-4 w-4" />
        </IconWell>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-medium">
            {label}
          </p>
          <p className="text-xs text-ink-muted truncate">{hint}</p>
        </div>
      </div>
      {loading || display === undefined ? (
        // Skeleton — same height as the loaded text so the card doesn't jump.
        <div className="h-9 w-32 rounded-lg bg-surface shadow-neu-inset-sm animate-pulse" />
      ) : (
        <p className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink tabular-nums">
          {display}
        </p>
      )}
    </li>
  );
}
