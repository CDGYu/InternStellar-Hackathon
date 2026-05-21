"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, CreditCard, AlertCircle } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { formatXlmWithUnit, formatXlm } from "@/lib/format-xlm";

type MobileBillsProps = {
  ofwId: string;
  familyId?: string;
  bills: any[];
};

export function MobileBills({ ofwId, bills }: MobileBillsProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const effective = bills.map((b) => ({
    ...b,
    effective_status: b.status === "paid" ? "paid" : b.due_date < today ? "overdue" : "due"
  }));

  const unpaid = effective.filter((b) => b.effective_status !== "paid");
  const totalDueStroops = unpaid.reduce((sum, b) => sum + BigInt(b.amount_stroops), 0n);

  async function handlePayOne(billId: string) {
    setError(null);
    setBusyId(billId);
    try {
      const result = await apiPost<any>("/api/bills/pay", { ofw_id: ofwId, bill_id: billId });
      if (!result.ok) {
        setError(result.message || "Payment failed");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold mb-2">Bills</h2>
        <p className="text-sm text-[#6b7280] leading-relaxed">
          Pay family utilities straight from your wallet on the Stellar testnet.
        </p>
      </div>

      {unpaid.length > 0 && (
        <div className="p-6 bg-[#1a1d2e] rounded-3xl text-white shadow-xl">
          <p className="text-[11px] uppercase tracking-widest text-white/60 font-bold mb-1">Total Due</p>
          <h3 className="text-3xl font-extrabold mb-5">{formatXlm(totalDueStroops)} <span className="text-xl font-medium">XLM</span></h3>
          <button className="w-full bg-white text-[#1a1d2e] py-3.5 rounded-2xl font-bold flex justify-center items-center gap-2 active:scale-[0.98] transition-transform">
            Pay All Due <CheckCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm rounded-2xl font-medium border border-red-100 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-3">
        {effective.map(b => (
          <div key={b.id} className="p-5 bg-white border border-black/5 shadow-sm rounded-3xl flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              b.effective_status === "paid" ? "bg-[#10b981]/10 text-[#10b981]" : 
              b.effective_status === "overdue" ? "bg-[#ef4444]/10 text-[#ef4444]" : 
              "bg-[#5b7cff]/10 text-[#5b7cff]"
            }`}>
              {b.effective_status === "paid" ? <CheckCircle className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm truncate">{b.biller_name || b.biller?.name}</h4>
              <p className="text-[11px] text-[#6b7280] font-mono mt-0.5">{b.account_number}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-bold text-[13px]">{formatXlmWithUnit(BigInt(b.amount_stroops))}</span>
                <span className="text-[10px] text-[#9ca3af]">•</span>
                <span className={`text-[11px] font-medium ${
                  b.effective_status === "overdue" ? "text-[#ef4444]" : "text-[#9ca3af]"
                }`}>
                  {b.effective_status === "paid" ? "Paid" : b.effective_status === "overdue" ? "Overdue" : "Due"}
                </span>
              </div>
            </div>

            {b.effective_status !== "paid" && (
              <button
                onClick={() => handlePayOne(b.id)}
                disabled={busyId === b.id}
                className="shrink-0 bg-[#5b7cff]/10 text-[#5b7cff] hover:bg-[#5b7cff]/20 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
              >
                {busyId === b.id ? "..." : "Pay"}
              </button>
            )}
          </div>
        ))}

        {bills.length === 0 && (
          <div className="p-8 text-center bg-white border border-black/5 rounded-3xl">
            <p className="text-sm text-[#6b7280]">No bills configured.</p>
          </div>
        )}
      </div>
    </div>
  );
}
