"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CheckCircle,
  ChevronDown,
  Clock,
  Lock,
  Package,
  Plus,
} from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatXlmWithUnit, truncateHash } from "@/lib/format-xlm";
import { useExplorerBase } from "@/lib/stellar/explorer-context";
import { timeAgo } from "@/lib/time-ago";

import { MobileStoreCreateOrderForm } from "./MobileStoreCreateOrderForm";

type StoreOrder = {
  id: string;
  family_id: string;
  family_name: string;
  status: string;
  /** Stringified bigint. */
  total_stroops: string;
  notes: string | null;
  escrow_tx_hash: string | null;
  release_tx_hash: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
};

type StoreReceipt = {
  order: StoreOrder;
};

type InventoryOption = {
  id: string;
  name: string;
  price_stroops: string;
  stock: number;
  unit: string | null;
};

type FamilyOption = {
  id: string;
  display_name: string;
  country: string | null;
};

type MobileStoreOrdersProps = {
  storeId: string;
  orders: StoreOrder[];
  receipts: StoreReceipt[];
  inventory: InventoryOption[];
  families: FamilyOption[];
};

export function MobileStoreOrders({
  storeId,
  orders,
  receipts,
  inventory,
  families,
}: MobileStoreOrdersProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const pending = orders.filter((o) => o.status === "pending_approval");
  const locked = orders.filter((o) => o.status === "locked");
  const delivered = orders.filter((o) => o.status === "delivered");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold mb-2">Orders</h2>
        <p className="text-sm text-[#6b7280] leading-relaxed">
          Create orders, approve incoming wishlists, mark deliveries.
        </p>
      </div>

      {/* Collapsible Create Order */}
      <div className="bg-white border border-black/5 shadow-sm rounded-3xl overflow-hidden">
        <button
          type="button"
          onClick={() => setIsCreateOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 p-4 text-left"
          aria-expanded={isCreateOpen}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-[#1a1d2e]">
            <Plus className="w-4 h-4 text-[#5b7cff]" />
            Create Order
          </span>
          <ChevronDown
            className={
              isCreateOpen
                ? "w-4 h-4 text-[#9ca3af] rotate-180 transition-transform"
                : "w-4 h-4 text-[#9ca3af] transition-transform"
            }
          />
        </button>
        {isCreateOpen && (
          <div className="px-4 pb-4">
            <MobileStoreCreateOrderForm
              storeId={storeId}
              families={families}
              inventory={inventory}
              onCreated={() => setIsCreateOpen(false)}
            />
          </div>
        )}
      </div>

      <OrderSection
        title="Pending approval"
        empty="No pending orders."
        orders={pending}
        renderRow={(o) => <OrderCard key={o.id} order={o} variant="pending" />}
      />

      <OrderSection
        title="Locked, awaiting delivery"
        empty="No locked orders."
        orders={locked}
        renderRow={(o) => (
          <LockedOrderCard key={o.id} order={o} />
        )}
      />

      <OrderSection
        title="Delivered, awaiting family confirm"
        empty="No deliveries waiting."
        orders={delivered}
        renderRow={(o) => <OrderCard key={o.id} order={o} variant="delivered" />}
      />

      <OrderSection
        title="Settled"
        empty="No settled orders yet."
        orders={receipts.map((r) => r.order)}
        renderRow={(o) => <OrderCard key={o.id} order={o} variant="released" />}
      />
    </div>
  );
}

function OrderSection({
  title,
  empty,
  orders,
  renderRow,
}: {
  title: string;
  empty: string;
  orders: StoreOrder[];
  renderRow: (o: StoreOrder) => React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#6b7280] ml-2 mb-2">
        {title} {orders.length > 0 ? `(${orders.length})` : ""}
      </h3>
      {orders.length === 0 ? (
        <p className="text-xs text-[#9ca3af] ml-2">{empty}</p>
      ) : (
        <ul className="space-y-3">{orders.map(renderRow)}</ul>
      )}
    </section>
  );
}

function OrderCard({
  order,
  variant,
}: {
  order: StoreOrder;
  variant: "pending" | "delivered" | "released";
}) {
  const STELLAR_EXPLORER_BASE = useExplorerBase();
  const variantConfig = VARIANTS[variant];
  return (
    <li className="p-4 bg-white border border-black/5 shadow-sm rounded-3xl flex items-start gap-3">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${variantConfig.iconBg}`}
      >
        <variantConfig.Icon className={`w-5 h-5 ${variantConfig.iconColor}`} strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#1a1d2e] truncate">
          {order.family_name}&apos;s order
        </p>
        <p className="text-[12px] text-[#6b7280] mt-0.5">
          <span className="font-bold text-[#1a1d2e]">
            {formatXlmWithUnit(BigInt(order.total_stroops))}
          </span>
          {" · "}
          {order.item_count} item{order.item_count === 1 ? "" : "s"}
        </p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${variantConfig.pillClass}`}
          >
            {order.status.replace(/_/g, " ")}
          </span>
          {variant === "released" && order.release_tx_hash ? (
            <a
              href={`${STELLAR_EXPLORER_BASE}/tx/${order.release_tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono text-[#5b7cff] hover:underline"
            >
              {truncateHash(order.release_tx_hash)}
            </a>
          ) : null}
          <span className="text-[11px] text-[#9ca3af]">{timeAgo(order.updated_at)}</span>
        </div>
      </div>
    </li>
  );
}

function LockedOrderCard({ order }: { order: StoreOrder }) {
  const STELLAR_EXPLORER_BASE = useExplorerBase();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function markDelivered() {
    setError(null);
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: uErr } = await supabase
        .from("wishlist")
        .update({
          status: "delivered",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      if (uErr) {
        setError(uErr.message);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="p-4 bg-white border border-black/5 shadow-sm rounded-3xl">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5 text-amber-600" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#1a1d2e] truncate">
            {order.family_name}&apos;s order
          </p>
          <p className="text-[12px] text-[#6b7280] mt-0.5">
            <span className="font-bold text-[#1a1d2e]">
              {formatXlmWithUnit(BigInt(order.total_stroops))}
            </span>
            {" · "}
            {order.item_count} item{order.item_count === 1 ? "" : "s"}
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
              locked
            </span>
            {order.escrow_tx_hash ? (
              <a
                href={`${STELLAR_EXPLORER_BASE}/tx/${order.escrow_tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono text-[#5b7cff] hover:underline"
              >
                {truncateHash(order.escrow_tx_hash)}
              </a>
            ) : null}
            <span className="text-[11px] text-[#9ca3af]">{timeAgo(order.updated_at)}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={markDelivered}
        disabled={submitting}
        className="w-full mt-4 bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-3 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {submitting ? "Marking…" : "Mark as delivered"}
        {!submitting && <CheckCircle className="w-4 h-4" />}
      </button>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </li>
  );
}

const VARIANTS = {
  pending: {
    Icon: Clock,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    pillClass: "bg-slate-100 text-slate-700",
  },
  delivered: {
    Icon: Package,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    pillClass: "bg-blue-100 text-blue-700",
  },
  released: {
    Icon: CheckCircle,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    pillClass: "bg-emerald-100 text-emerald-700",
  },
} as const;
