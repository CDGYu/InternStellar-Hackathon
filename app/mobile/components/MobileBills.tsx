"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ChevronDown, CreditCard, AlertCircle, Plus } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { formatXlmWithUnit, formatXlm } from "@/lib/format-xlm";
import { timeAgo } from "@/lib/time-ago";

import { MobileAddBillForm } from "./MobileAddBillForm";

type MobileBillsProps = {
  ofwId: string;
  familyId?: string;
  bills: any[];
  role: "ofw" | "family";
  billers: { id: string; name: string; category: string }[];
};

export function MobileBills({
  ofwId,
  familyId,
  bills,
  role,
  billers,
}: MobileBillsProps) {
  const [addOpen, setAddOpen] = useState(false);
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payingAll, setPayingAll] = useState(false);
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

  // Pay every unpaid bill sequentially. Sequential (not parallel) because
  // /api/bills/pay has an in-flight idempotency guard keyed on (ofw, bill)
  // and the underlying Stellar payment submission isn't built to handle
  // concurrent ops from the same signer. If any single payment fails, stop
  // there and surface the error — partial-success is honest.
  async function handlePayAll() {
    if (unpaid.length === 0 || payingAll) return;
    setError(null);
    setPayingAll(true);
    try {
      for (const bill of unpaid) {
        setBusyId(bill.id);
        const result = await apiPost<any>("/api/bills/pay", {
          ofw_id: ofwId,
          bill_id: bill.id,
        });
        if (!result.ok) {
          setError(
            `Stopped at ${bill.biller_name || bill.biller?.name || "a bill"}: ${
              result.message || "payment failed"
            }`,
          );
          return;
        }
      }
      startTransition(() => router.refresh());
    } finally {
      setBusyId(null);
      setPayingAll(false);
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

      {role === "family" && familyId && (
        <div className="bg-white border border-black/5 shadow-sm rounded-3xl overflow-hidden">
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 p-4 text-left"
            aria-expanded={addOpen}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-[#1a1d2e]">
              <Plus className="w-4 h-4 text-[#5b7cff]" />
              Add Bill
            </span>
            <ChevronDown
              className={
                addOpen
                  ? "w-4 h-4 text-[#9ca3af] rotate-180 transition-transform"
                  : "w-4 h-4 text-[#9ca3af] transition-transform"
              }
            />
          </button>
          {addOpen && (
            <div className="px-4 pb-4">
              <MobileAddBillForm
                familyId={familyId}
                billers={billers}
                onAdded={() => setAddOpen(false)}
              />
            </div>
          )}
        </div>
      )}

      {unpaid.length > 0 && (
        <div className="p-6 bg-[#1a1d2e] rounded-3xl text-white shadow-xl">
          <p className="text-[11px] uppercase tracking-widest text-white/60 font-bold mb-1">Total Due</p>
          <h3 className="text-3xl font-extrabold mb-5">{formatXlm(totalDueStroops)} <span className="text-xl font-medium">XLM</span></h3>
          <button
            type="button"
            onClick={handlePayAll}
            disabled={payingAll}
            className="w-full bg-white text-[#1a1d2e] py-3.5 rounded-2xl font-bold flex justify-center items-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {payingAll
              ? `Paying ${unpaid.length} bill${unpaid.length === 1 ? "" : "s"}…`
              : `Pay All Due (${unpaid.length})`}
            {!payingAll && <CheckCircle className="w-4 h-4" />}
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm rounded-2xl font-medium border border-red-100 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {unpaid.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#6b7280] ml-2 mb-2">
            Due / Overdue ({unpaid.length})
          </h3>
          <div className="space-y-3">
            {effective
              .filter((b) => b.effective_status !== "paid")
              .map((b) => (
                <div
                  key={b.id}
                  className="p-5 bg-white border border-black/5 shadow-sm rounded-3xl flex items-center gap-4"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      b.effective_status === "overdue"
                        ? "bg-[#ef4444]/10 text-[#ef4444]"
                        : "bg-[#5b7cff]/10 text-[#5b7cff]"
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm truncate">
                      {b.biller_name || b.biller?.name}
                    </h4>
                    <p className="text-[11px] text-[#6b7280] font-mono mt-0.5">
                      {b.account_number}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-bold text-[13px]">
                        {formatXlmWithUnit(BigInt(b.amount_stroops))}
                      </span>
                      <span className="text-[10px] text-[#9ca3af]">•</span>
                      <span
                        className={`text-[11px] font-medium ${
                          b.effective_status === "overdue"
                            ? "text-[#ef4444]"
                            : "text-[#9ca3af]"
                        }`}
                      >
                        {b.effective_status === "overdue" ? "Overdue" : "Due"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePayOne(b.id)}
                    disabled={busyId === b.id}
                    className="shrink-0 bg-[#5b7cff]/10 text-[#5b7cff] hover:bg-[#5b7cff]/20 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                  >
                    {busyId === b.id ? "..." : "Pay"}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {effective.filter((b) => b.effective_status === "paid").length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#6b7280] ml-2 mb-2">
            Recent payments
          </h3>
          <div className="space-y-3">
            {effective
              .filter((b) => b.effective_status === "paid")
              .slice(0, 10)
              .map((b) => {
                const paidTs = b.paid_at || b.updated_at;
                return (
                  <div
                    key={b.id}
                    className="p-4 bg-white border border-black/5 shadow-sm rounded-3xl flex items-center gap-3 opacity-90"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#10b981]/10 text-[#10b981] flex items-center justify-center shrink-0">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs truncate">
                        {b.biller_name || b.biller?.name}
                      </h4>
                      <p className="text-[10px] text-[#9ca3af] font-mono">
                        {b.account_number}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-bold text-[11px]">
                          {formatXlmWithUnit(BigInt(b.amount_stroops))}
                        </span>
                        {paidTs && (
                          <>
                            <span className="text-[9px] text-[#9ca3af]">•</span>
                            <span className="text-[10px] text-[#9ca3af]">
                              {timeAgo(paidTs)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            {effective.filter((b) => b.effective_status === "paid").length >
              10 && (
              <p className="text-[10px] text-center text-[#9ca3af] mt-2">
                +{" "}
                {effective.filter((b) => b.effective_status === "paid").length -
                  10}{" "}
                older payments
              </p>
            )}
          </div>
        </div>
      )}

      {bills.length === 0 && (
        <div className="p-8 text-center bg-white border border-black/5 rounded-3xl">
          <p className="text-sm text-[#6b7280]">No bills configured.</p>
        </div>
      )}
    </div>
  );
}
