"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconWell } from "@/components/ui/IconWell";
import { Input } from "@/components/ui/Input";
import {
  ArrowUpRightIcon,
  CheckCircleIcon,
  CoinsIcon,
} from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { apiPost } from "@/lib/api/client";
import { formatXlm, formatXlmWithUnit, truncateHash } from "@/lib/format-xlm";

/**
 * OFW "Send Funds" form.
 *
 * Three controls:
 *   - Amount (XLM). Converted to stroops before POST.
 *   - Three sliders: Utilities / Groceries / Emergency. Must sum to 100
 *     before the submit button enables. We deliberately *don't*
 *     auto-rebalance sliders — making the OFW deliberately choose each
 *     percentage matches the "co-budgeter, not remitter" framing in
 *     the pitch deck.
 *
 * POSTs to /api/deposit which calls `deposit_and_split` on Soroban and
 * returns the three sub-balances. On success we show a receipt card
 * with the tx hash + bucket amounts, plus a "Send another" reset.
 */

type DepositResponse = {
  tx_hash: string;
  shares: {
    util_stroops: string;
    groc_stroops: string;
    emerg_stroops: string;
  };
  total_stroops: string;
  percentages: { util: number; groc: number; emerg: number };
  message?: string;
};

interface BucketState {
  util: number;
  groc: number;
  emerg: number;
}

const DEFAULT_BUCKETS: BucketState = { util: 30, groc: 60, emerg: 10 };
const STROOPS_PER_XLM = 10_000_000n;

/** XLM string → stroops bigint. Handles up to 7 decimal places (precision floor of stroops). */
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

export function SendFundsForm({ ofwId }: { ofwId: string }) {
  const router = useRouter();
  const [amountXlm, setAmountXlm] = useState("50");
  const [buckets, setBuckets] = useState<BucketState>(DEFAULT_BUCKETS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<DepositResponse | null>(null);
  const [, startTransition] = useTransition();

  const sum = buckets.util + buckets.groc + buckets.emerg;
  const sumOk = sum === 100;
  const stroops = xlmToStroops(amountXlm);
  const amountOk = stroops !== null && stroops > 0n;
  const canSubmit = sumOk && amountOk && !submitting;

  function setBucket(key: keyof BucketState, value: number) {
    // Clamp 0-100. Whole numbers only — fractional percentages would
    // make the server validator (which checks Number.isInteger) reject
    // an otherwise valid submission.
    const v = Math.max(0, Math.min(100, Math.round(value)));
    setBuckets((prev) => ({ ...prev, [key]: v }));
  }

  async function submit() {
    if (!canSubmit || stroops === null) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiPost<DepositResponse>("/api/deposit", {
        ofw_id: ofwId,
        total_stroops: stroops.toString(),
        pct_util: buckets.util,
        pct_groc: buckets.groc,
        pct_emerg: buckets.emerg,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setReceipt(result.data);
      // Refresh so the OFW dashboard's totals + activity pick up the
      // deposit if the API route ever starts writing settlement rows
      // for deposits (currently it doesn't — see deposit/route.ts).
      startTransition(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setReceipt(null);
    setError(null);
    setAmountXlm("50");
    setBuckets(DEFAULT_BUCKETS);
  }

  // ---- Receipt view (after a successful send) ------------------------
  if (receipt) {
    return (
      <Card className="p-8 md:p-10">
        <div className="flex items-start gap-5 mb-8">
          <IconWell tone="teal" size="md">
            <CheckCircleIcon className="h-6 w-6" />
          </IconWell>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-ink-muted font-medium">
              Deposit complete
            </p>
            <h2 className="mt-2 font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
              {formatXlmWithUnit(BigInt(receipt.total_stroops))} sent
            </h2>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${receipt.tx_hash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm font-mono text-accent hover:text-accent-light transition-colors"
            >
              {truncateHash(receipt.tx_hash, 12, 8)}
              <ArrowUpRightIcon className="h-4 w-4" />
            </a>
          </div>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <BucketReadout
            label="Utilities"
            pct={receipt.percentages.util}
            stroops={receipt.shares.util_stroops}
          />
          <BucketReadout
            label="Groceries"
            pct={receipt.percentages.groc}
            stroops={receipt.shares.groc_stroops}
          />
          <BucketReadout
            label="Emergency"
            pct={receipt.percentages.emerg}
            stroops={receipt.shares.emerg_stroops}
          />
        </ul>

        <Button type="button" variant="secondary" size="lg" onClick={reset} className="w-full">
          Send another
        </Button>
      </Card>
    );
  }

  // ---- Compose form (default view) -----------------------------------
  return (
    <Card className="p-8 md:p-10">
      <div className="flex items-start gap-5 mb-8">
        <IconWell tone="accent" size="md">
          <CoinsIcon className="h-6 w-6" />
        </IconWell>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
            Send funds
          </h2>
          <p className="text-ink-muted mt-2 text-sm md:text-base">
            Deposit into three on-chain buckets. Your family spends from each one
            independently — money knows what it&apos;s for.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Input
          label="Amount (XLM)"
          name="amount"
          type="text"
          inputMode="decimal"
          value={amountXlm}
          onChange={(e) => setAmountXlm(e.target.value)}
          placeholder="50"
          hint={
            stroops === null && amountXlm.trim()
              ? "Enter a whole number or up to 7 decimal places"
              : stroops !== null
              ? `≈ ${stroops.toString()} stroops`
              : undefined
          }
        />
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-medium mb-2.5">
            Allocation total
          </p>
          <div
            className={cn(
              "h-[3.25rem] flex items-center justify-between px-5 rounded-2xl bg-surface shadow-neu-inset-sm",
              sumOk ? "text-accent-teal" : "text-amber-500",
            )}
          >
            <span className="font-display text-xl font-bold tabular-nums">
              {sum}%
            </span>
            <span className="text-xs font-medium">
              {sumOk ? "Ready to send" : `Adjust by ${sum > 100 ? "-" : "+"}${Math.abs(sum - 100)}%`}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-5 mb-8">
        <SliderRow
          label="Utilities"
          hint="Electricity, water, internet"
          value={buckets.util}
          onChange={(v) => setBucket("util", v)}
        />
        <SliderRow
          label="Groceries"
          hint="Rice, sardines, milk, daily food"
          value={buckets.groc}
          onChange={(v) => setBucket("groc", v)}
        />
        <SliderRow
          label="Emergency"
          hint="Medicine, hospital, contingency"
          value={buckets.emerg}
          onChange={(v) => setBucket("emerg", v)}
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-6 rounded-2xl bg-surface shadow-neu-inset-sm px-4 py-3 text-sm text-red-500"
        >
          {error}
        </div>
      ) : null}

      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={submit}
        disabled={!canSubmit}
        className="w-full"
      >
        {submitting
          ? "Sending…"
          : sumOk && amountOk
          ? `Send ${formatXlmWithUnit(stroops!)}`
          : "Set amount + allocation to 100%"}
        {!submitting && canSubmit ? <ArrowUpRightIcon className="h-4 w-4" /> : null}
      </Button>
    </Card>
  );
}

/* -------------------------------------------------------------------- */

function SliderRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <div>
          <p className="font-display text-base font-bold text-ink">{label}</p>
          <p className="text-xs text-ink-muted">{hint}</p>
        </div>
        <span className="text-ink font-display font-extrabold text-lg tabular-nums">
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label} percentage`}
        // Neumorphic range styling: the track is an inset well; the
        // thumb is a small extruded pill. Cross-browser approach uses
        // appearance:none + per-engine pseudo-elements via inline style
        // tag. For brevity we use Tailwind's default range styling with
        // an inset background; works in modern Chromium/Firefox/Safari.
        className="w-full h-3 rounded-full bg-surface shadow-neu-inset-sm appearance-none cursor-pointer accent-accent"
      />
    </div>
  );
}

function BucketReadout({
  label,
  pct,
  stroops,
}: {
  label: string;
  pct: number;
  stroops: string;
}) {
  return (
    <li className="p-5 rounded-2xl bg-surface shadow-neu-inset-sm">
      <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-medium">
        {label}
      </p>
      <p className="mt-2 font-display text-xl font-extrabold tracking-tight text-ink tabular-nums">
        {formatXlm(BigInt(stroops))} XLM
      </p>
      <p className="mt-1 text-xs text-ink-muted">{pct}% of total</p>
    </li>
  );
}
