"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, CheckCircle, Clock } from "lucide-react";
import { apiPost } from "@/lib/api/client";
import { formatXlmWithUnit } from "@/lib/format-xlm";

type MobileWishlistsProps = {
  familyId: string;
  wishlists: any[];
};

export function MobileWishlists({ familyId, wishlists }: MobileWishlistsProps) {
  const router = useRouter();
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const inFlight = wishlists.filter((w) => w.status !== "released");
  const released = wishlists.filter((w) => w.status === "released");

  async function confirmDelivery(wishlistId: string) {
    setError(null);
    setSubmittingId(wishlistId);
    try {
      const result = await apiPost<any>("/api/escrow/release", {
        family_id: familyId,
        wishlist_id: wishlistId,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold mb-2">Orders</h2>
        <p className="text-sm text-[#6b7280] leading-relaxed">
          Confirm delivery to release locked funds to the store.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm rounded-2xl font-medium border border-red-100">
          {error}
        </div>
      )}

      {inFlight.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#6b7280] ml-2">In Flight</h3>
          {inFlight.map((w) => (
            <div key={w.id} className="p-5 bg-white border border-black/5 shadow-sm rounded-3xl">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                  {w.status === "delivered" ? <Package className="w-5 h-5 text-[#5b7cff]" /> : <Clock className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm truncate">{w.notes || "Untitled order"}</h4>
                  <p className="text-[12px] text-[#6b7280] mt-0.5">
                    <span className="font-bold text-[#1a1d2e]">{formatXlmWithUnit(BigInt(w.total_stroops || "0"))}</span>
                    <span className="mx-2">•</span>
                    {w.item_count || w.items?.length || 0} items
                  </p>
                  <span className="inline-block px-2 py-0.5 mt-2 text-[10px] uppercase font-bold tracking-wider rounded bg-gray-100 text-gray-600">
                    {w.status}
                  </span>
                </div>
              </div>

              {w.status === "delivered" && (
                <button
                  onClick={() => confirmDelivery(w.id)}
                  disabled={submittingId === w.id}
                  className="w-full bg-[#10b981] text-white py-3 rounded-2xl font-bold flex justify-center items-center gap-2 shadow-lg shadow-[#10b981]/25 active:scale-[0.98] transition-all"
                >
                  {submittingId === w.id ? "Confirming..." : "Confirm Delivery"}
                  {submittingId !== w.id && <CheckCircle className="w-4 h-4" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {released.length > 0 && (
        <div className="space-y-4 mt-8 opacity-75">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#6b7280] ml-2">Completed</h3>
          {released.map((w) => (
            <div key={w.id} className="p-4 bg-white border border-black/5 shadow-sm rounded-3xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#10b981]/10 text-[#10b981] flex items-center justify-center shrink-0">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-xs truncate">{w.notes || "Untitled order"}</h4>
                <p className="text-[11px] text-[#6b7280]">
                  {formatXlmWithUnit(BigInt(w.total_stroops || "0"))}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {wishlists.length === 0 && (
        <div className="p-8 text-center bg-white border border-black/5 rounded-3xl">
          <p className="text-sm text-[#6b7280]">No orders found.</p>
        </div>
      )}
    </div>
  );
}
