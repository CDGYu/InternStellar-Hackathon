"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Boxes,
  CheckCircle,
  History,
  Home,
  Lock,
  Menu,
  Package,
} from "lucide-react";

import { MobileActivity } from "@/app/mobile/components/MobileActivity";
import { formatXlmWithUnit } from "@/lib/format-xlm";

import { MobileStoreInventory } from "./components/MobileStoreInventory";
import { MobileStoreOrders } from "./components/MobileStoreOrders";

type StoreDashboardSerialized = {
  store: {
    id: string;
    display_name: string;
    country: string | null;
  };
  totals: {
    pendingCount: number;
    inEscrow: string;        // stringified bigint
    revenue: string;         // stringified bigint
    outOfStockCount: number;
  };
  orders: Array<{
    id: string;
    family_id: string;
    family_name: string;
    status: string;
    total_stroops: string;
    notes: string | null;
    escrow_tx_hash: string | null;
    release_tx_hash: string | null;
    item_count: number;
    created_at: string;
    updated_at: string;
  }>;
  receipts: Array<{
    order: {
      id: string;
      family_id: string;
      family_name: string;
      status: string;
      total_stroops: string;
      notes: string | null;
      escrow_tx_hash: string | null;
      release_tx_hash: string | null;
      item_count: number;
      created_at: string;
      updated_at: string;
    };
  }>;
  inventory: Array<{
    id: string;
    name: string;
    category: string;
    price_stroops: string;
    stock: number;
    unit: string | null;
  }>;
  /** Already-shaped settlement rows; bigints stringified. */
  activity: Array<{
    id: string;
    wishlist_id: string;
    event_type: "deposit" | "lock" | "release";
    tx_hash: string;
    amount_stroops: string;
    created_at: string;
    wishlist_notes: string | null;
    wishlist_status: string | null;
  }>;
  families: Array<{
    id: string;
    display_name: string;
    country: string | null;
  }>;
};

type Props = {
  storeData: StoreDashboardSerialized;
};

export function MobileStoreDashboardClient({ storeData }: Props) {
  const [activeTab, setActiveTab] = useState<
    "home" | "orders" | "inventory" | "activity"
  >("home");

  // The MobileActivity component expects bigint amount_stroops. Coerce.
  const activityRows = storeData.activity.map((a) => ({
    id: a.id,
    wishlist_id: a.wishlist_id,
    event_type: a.event_type,
    tx_hash: a.tx_hash,
    amount_stroops: BigInt(a.amount_stroops),
    created_at: a.created_at,
    wishlist_notes: a.wishlist_notes,
    wishlist_status: a.wishlist_status as any,
  }));

  return (
    <div className="relative flex flex-col h-screen max-w-md mx-auto bg-[#f5f7fa] text-[#1a1d2e] overflow-hidden font-sans">
      {/* Top Header */}
      <div className="px-6 py-5 flex items-center justify-between bg-white shrink-0 shadow-sm z-10">
        <h1 className="text-lg font-extrabold tracking-tight">InternStellar</h1>
        <Link
          href="/mobile/settings"
          aria-label="Open settings"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </Link>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-24 scroll-smooth">
        {activeTab === "home" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <p className="text-[11px] text-[#6b7280] uppercase tracking-widest mb-1.5 font-bold">
                WELCOME BACK
              </p>
              <h2 className="text-[2rem] font-extrabold mb-3 leading-tight tracking-tight">
                {firstName(storeData.store.display_name)}&apos;s desk.
              </h2>
              <p className="text-[#6b7280] text-[15px] leading-relaxed">
                {storeData.totals.pendingCount > 0 ? (
                  <>
                    <span className="text-[#1a1d2e] font-semibold">
                      {storeData.totals.pendingCount} order
                      {storeData.totals.pendingCount === 1 ? "" : "s"}
                    </span>{" "}
                    waiting on your approval.
                  </>
                ) : (
                  <>All caught up — no pending orders.</>
                )}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StoreStatCard
                icon={<Package className="w-4 h-4 text-white" strokeWidth={2.5} />}
                title="Pending"
                value={String(storeData.totals.pendingCount)}
                desc="To review"
                color="from-blue-500 to-blue-600"
              />
              <StoreStatCard
                icon={<Lock className="w-4 h-4 text-white" strokeWidth={2.5} />}
                title="Escrow"
                value={formatXlmWithUnit(BigInt(storeData.totals.inEscrow))}
                desc="Locked"
                color="from-amber-500 to-orange-500"
              />
              <StoreStatCard
                icon={<CheckCircle className="w-4 h-4 text-white" strokeWidth={2.5} />}
                title="Revenue"
                value={formatXlmWithUnit(BigInt(storeData.totals.revenue))}
                desc="Released"
                color="from-emerald-400 to-emerald-600"
              />
            </div>

            {storeData.totals.outOfStockCount > 0 && (
              <div className="p-5 bg-amber-50 border border-amber-100 rounded-3xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-900">
                    {storeData.totals.outOfStockCount} item
                    {storeData.totals.outOfStockCount === 1 ? "" : "s"} out of stock
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Tap{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("inventory")}
                      className="font-bold underline"
                    >
                      Inventory
                    </button>{" "}
                    to restock.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "orders" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <MobileStoreOrders
              storeId={storeData.store.id}
              orders={storeData.orders}
              receipts={storeData.receipts}
              inventory={storeData.inventory}
              families={storeData.families}
            />
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <MobileStoreInventory inventory={storeData.inventory} />
          </div>
        )}

        {activeTab === "activity" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <MobileActivity rows={activityRows} />
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <div className="absolute bottom-0 w-full bg-white border-t border-black/5 px-4 pb-safe pt-3 pb-6 flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-50">
        <TabItem
          icon={<Home />}
          label="Home"
          active={activeTab === "home"}
          onClick={() => setActiveTab("home")}
        />
        <TabItem
          icon={<Package />}
          label="Orders"
          active={activeTab === "orders"}
          onClick={() => setActiveTab("orders")}
        />
        <TabItem
          icon={<Boxes />}
          label="Inventory"
          active={activeTab === "inventory"}
          onClick={() => setActiveTab("inventory")}
        />
        <TabItem
          icon={<History />}
          label="Activity"
          active={activeTab === "activity"}
          onClick={() => setActiveTab("activity")}
        />
      </div>
    </div>
  );
}

function firstName(displayName: string): string {
  return displayName.split(" ")[0] ?? displayName;
}

function StoreStatCard({
  icon,
  title,
  value,
  desc,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  desc: string;
  color: string;
}) {
  return (
    <div className="p-3.5 bg-white border border-black/5 shadow-sm rounded-2xl flex flex-col">
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br ${color} shadow-sm mb-3`}
      >
        {icon}
      </div>
      <p className="text-[10px] text-[#6b7280] uppercase mb-0.5 font-bold tracking-wide">
        {title}
      </p>
      <p className="text-[15px] font-extrabold mb-0.5 truncate">{value}</p>
      <p className="text-[10px] text-[#9ca3af] font-medium">{desc}</p>
    </div>
  );
}

function TabItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 min-w-[50px] transition-all duration-300 ${active ? "text-[#5b7cff]" : "text-[#9ca3af] hover:text-[#6b7280]"}`}
    >
      <div
        className={`transition-transform duration-300 ${active ? "scale-110 -translate-y-1" : "scale-100"}`}
      >
        {React.cloneElement(icon as React.ReactElement, {
          strokeWidth: active ? 2.5 : 2,
          className: "w-[22px] h-[22px]",
        })}
      </div>
      <span className={`text-[10px] ${active ? "font-bold" : "font-medium"}`}>
        {label}
      </span>
    </button>
  );
}
