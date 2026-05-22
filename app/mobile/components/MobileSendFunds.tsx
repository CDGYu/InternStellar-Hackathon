"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CheckCircle, TrendingUp } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { formatXlm, formatXlmWithUnit, truncateHash } from "@/lib/format-xlm";
import { useExplorerBase } from "@/lib/stellar/explorer-context";

type MobileSendFundsProps = {
  ofwId: string;
  onBack: () => void;
};

const STROOPS_PER_XLM = 10_000_000n;

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

export function MobileSendFunds({ ofwId, onBack }: MobileSendFundsProps) {
  const STELLAR_EXPLORER_BASE = useExplorerBase();
  const router = useRouter();
  const [amountXlm, setAmountXlm] = useState("50");
  const [buckets, setBuckets] = useState({ util: 30, groc: 60, emerg: 10 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<any | null>(null);
  const [, startTransition] = useTransition();

  const sum = buckets.util + buckets.groc + buckets.emerg;
  const sumOk = sum === 100;
  const stroops = xlmToStroops(amountXlm);
  const amountOk = stroops !== null && stroops > 0n;
  const canSubmit = sumOk && amountOk && !submitting;

  function setBucket(key: "util" | "groc" | "emerg", value: number) {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    setBuckets((prev) => ({ ...prev, [key]: v }));
  }

  async function submit() {
    if (!canSubmit || stroops === null) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiPost<any>("/api/deposit", {
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
      startTransition(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <div className="space-y-6">
        <button onClick={onBack} className="flex items-center text-sm font-medium text-[#6b7280] mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>

        <div className="p-8 bg-white border border-black/5 shadow-sm rounded-3xl text-center">
          <div className="w-16 h-16 bg-[#10b981]/10 text-[#10b981] rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8" />
          </div>
          <p className="text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-2">Deposit Complete</p>
          <h2 className="text-3xl font-extrabold mb-2">{formatXlmWithUnit(BigInt(receipt.total_stroops))} sent</h2>
          <a
            href={`${STELLAR_EXPLORER_BASE}/tx/${receipt.tx_hash}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-[#5b7cff] font-mono text-sm hover:underline"
          >
            {truncateHash(receipt.tx_hash, 12, 8)} <ArrowUpRight className="w-3 h-3 ml-1" />
          </a>
        </div>

        <button 
          onClick={() => { setReceipt(null); setAmountXlm("50"); }}
          className="w-full bg-[#f0f2f5] text-[#1a1d2e] font-bold py-4 rounded-2xl"
        >
          Send Another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="flex items-center text-sm font-medium text-[#6b7280]">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </button>
      </div>

      <div>
        <h2 className="text-2xl font-extrabold mb-2">Send funds</h2>
        <p className="text-sm text-[#6b7280] leading-relaxed">
          Deposit into three on-chain buckets. Your family spends from each one independently.
        </p>
      </div>

      <div className="p-6 bg-white border border-black/5 shadow-sm rounded-3xl space-y-6">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[#6b7280] mb-2">Amount (XLM)</label>
          <input
            type="text"
            inputMode="decimal"
            value={amountXlm}
            onChange={(e) => setAmountXlm(e.target.value)}
            className="w-full text-3xl font-extrabold bg-transparent border-b-2 border-[#e5e9f0] focus:border-[#5b7cff] pb-2 outline-none transition-colors"
            placeholder="0"
          />
        </div>

        <div className="pt-4">
          <div className="flex justify-between items-end mb-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#6b7280]">Allocation Total</span>
            <span className={`text-xl font-extrabold ${sumOk ? "text-[#10b981]" : "text-[#ef4444]"}`}>{sum}%</span>
          </div>

          <div className="space-y-6">
            <SliderRow label="Groceries" value={buckets.groc} onChange={(v) => setBucket("groc", v)} />
            <SliderRow label="Utilities" value={buckets.util} onChange={(v) => setBucket("util", v)} />
            <SliderRow label="Emergency" value={buckets.emerg} onChange={(v) => setBucket("emerg", v)} />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm rounded-2xl font-medium border border-red-100">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={!canSubmit}
        className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
          canSubmit 
            ? "bg-[#5b7cff] text-white shadow-lg shadow-[#5b7cff]/25 active:scale-[0.98]" 
            : "bg-[#e5e9f0] text-[#9ca3af] cursor-not-allowed"
        }`}
      >
        {submitting ? "Sending..." : sumOk && amountOk ? `Send ${formatXlmWithUnit(stroops!)}` : "Set total to 100%"}
        {!submitting && canSubmit && <TrendingUp className="w-4 h-4" />}
      </button>
    </div>
  );
}

function SliderRow({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="font-semibold text-sm">{label}</span>
        <span className="font-bold text-sm">{value}%</span>
      </div>
      <input
        type="range"
        min={0} max={100} step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none bg-[#f0f2f5] accent-[#5b7cff]"
      />
    </div>
  );
}
