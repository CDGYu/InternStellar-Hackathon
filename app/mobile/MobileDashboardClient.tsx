"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Lock,
  CheckCircle,
  TrendingUp,
  ArrowUpRight,
  Menu,
  Home,
  CreditCard,
  Package,
  User,
  ArrowRight,
  History,
  ShoppingBag
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { MobileSendFunds } from "./components/MobileSendFunds";
import { MobileBills } from "./components/MobileBills";
import { MobileWishlists } from "./components/MobileWishlists";
import { MobileActivity } from "./components/MobileActivity";
import { MobileShop } from "./components/MobileShop";
import { formatXlmWithUnit, formatXlm } from "@/lib/format-xlm";

type MobileDashboardClientProps = {
  ofwData: any;
  familyData: any;
  currentUserRole: "ofw" | "family";
  currentUserId: string;
};

const chartData = [
  { week: "W1", amount: 200 },
  { week: "W2", amount: 450 },
  { week: "W3", amount: 300 },
  { week: "W4", amount: 800 },
  { week: "W5", amount: 1425 },
];

export function MobileDashboardClient({ ofwData, familyData, currentUserRole, currentUserId }: MobileDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<
    "home" | "send" | "shop" | "bills" | "orders" | "activity"
  >("home");

  // Determine active dataset based on role, but use both if available (God Mode demo).
  const primaryName = currentUserRole === "ofw" 
    ? (ofwData?.ofw.display_name.split(" ")[0] || "OFW") 
    : (familyData?.family.display_name.split(" ")[0] || "Family");

  const totals = ofwData?.totals || familyData?.totals || { funded: 0n, inEscrow: 0n, released: 0n, receivedValue: 0n };
  
  // Use OFW allocation or fallback
  const spendingData = ofwData?.allocation?.map((a: any) => ({
    category: a.category.charAt(0).toUpperCase() + a.category.slice(1),
    amount: formatXlm(a.stroops),
    percentage: Math.round(a.share * 100)
  })) || [
    { category: "Groceries", amount: "0", percentage: 60 },
    { category: "Utilities", amount: "0", percentage: 30 },
    { category: "Emergency", amount: "0", percentage: 10 }
  ];

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
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Welcome */}
            <div>
              <p className="text-[11px] text-[#6b7280] uppercase tracking-widest mb-1.5 font-bold">WELCOME BACK</p>
              <h2 className="text-[2rem] font-extrabold mb-3 leading-tight tracking-tight">Salamat, {primaryName}.</h2>
              <p className="text-[#6b7280] text-[15px] leading-relaxed">
                Here's how <span className="text-[#5b7cff] font-semibold">{familyData?.family.display_name || "your family"}</span> is using your support — every stroop accounted for, on-chain.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard 
                icon={<BarChart3 className="w-4 h-4 text-white" strokeWidth={2.5} />} 
                title="Total" 
                value={formatXlmWithUnit(totals.funded || 0n)} 
                desc="Deposits" 
                color="from-blue-500 to-blue-600" 
              />
              <StatCard 
                icon={<Lock className="w-4 h-4 text-white" strokeWidth={2.5} />} 
                title="Escrow" 
                value={formatXlmWithUnit(totals.inEscrow || 0n)} 
                desc="Locked" 
                color="from-amber-500 to-orange-500" 
              />
              <StatCard 
                icon={<CheckCircle className="w-4 h-4 text-white" strokeWidth={2.5} />} 
                title="Released" 
                value={formatXlmWithUnit(totals.released || totals.receivedValue || 0n)} 
                desc="Delivered" 
                color="from-emerald-400 to-emerald-600" 
              />
            </div>

            {/* Send Funds CTA (Figma matching) */}
            <div className="p-6 bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] shadow-xl shadow-[#5b7cff]/20 rounded-3xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
              <div className="flex items-start gap-3 mb-5 relative z-10">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner">
                  <TrendingUp className="w-6 h-6 text-white" strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1.5">Send funds</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    Deposit into three on-chain buckets for specific needs.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab("send")}
                className="w-full mt-2 bg-white text-[#5b7cff] font-bold py-3.5 rounded-2xl hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg relative z-10"
              >
                Go to Send Funds
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Spending Breakdown */}
            <div className="p-6 bg-white shadow-sm border border-black/5 rounded-3xl">
              <h3 className="text-lg font-bold mb-1.5">Where support is going</h3>
              <p className="text-[13px] text-[#6b7280] mb-6">Spend by category across every wishlist.</p>

              {spendingData.map((item: any, i: number) => (
                <div key={item.category} className="mb-5 last:mb-0">
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-sm font-semibold">{item.category}</p>
                    <div className="text-right">
                      <p className="text-sm font-bold">{item.amount} XLM</p>
                      <p className="text-[11px] text-[#6b7280] font-medium">{item.percentage}%</p>
                    </div>
                  </div>
                  <div className="h-2.5 bg-[#f0f2f5] rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${Math.max(item.percentage, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Area Chart */}
            <div className="p-6 bg-white shadow-sm border border-black/5 rounded-3xl">
              <h3 className="text-lg font-bold mb-6">Funding trend</h3>
              <div className="h-44 -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#5b7cff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#5b7cff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                    <XAxis dataKey="week" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                      cursor={{ stroke: 'rgba(91,124,255,0.2)', strokeWidth: 2 }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#5b7cff" strokeWidth={3} fill="url(#colorAmount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === "send" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            {ofwData ? (
              <MobileSendFunds ofwId={ofwData.ofw.id} onBack={() => setActiveTab("home")} />
            ) : (
              <div className="text-center py-20 text-[#6b7280]">
                <p>Send Funds requires an OFW account.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "shop" && familyData && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <MobileShop
              familyId={familyData.family.id}
              inventory={familyData.inventory.map((i: any) => ({
                id: i.id,
                name: i.name,
                category: i.category,
                price_stroops: i.price_stroops.toString(),
                stock: i.stock,
                unit: i.unit,
              }))}
              initialWishlistId={familyData.activeDraft?.wishlist.id ?? null}
              initialStatus={familyData.activeDraft?.wishlist.status ?? null}
              initialItems={
                familyData.activeDraft?.items.map((it: any) => ({
                  id: it.id,
                  inventory_id: it.inventory_id,
                  inventory_name: it.inventory_name,
                  inventory_unit: it.inventory_unit,
                  quantity: it.quantity,
                  price_stroops_at_add: it.price_stroops_at_add.toString(),
                })) ?? []
              }
              initialEscrowTxHash={familyData.activeDraft?.wishlist.escrow_tx_hash ?? null}
            />
          </div>
        )}

        {activeTab === "bills" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <MobileBills
              ofwId={ofwData?.ofw.id || currentUserId}
              familyId={familyData?.family.id}
              bills={ofwData?.bills || familyData?.bills || []}
            />
          </div>
        )}

        {activeTab === "orders" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            {familyData ? (
              <MobileWishlists
                familyId={familyData.family.id}
                wishlists={familyData.wishlists}
                viewerRole={currentUserRole}
              />
            ) : (
              <div className="text-center py-20 text-[#6b7280]">
                <p>
                  {currentUserRole === "ofw"
                    ? "Your sponsored family hasn't been linked yet."
                    : "Orders & Deliveries requires a Family account."}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <MobileActivity
              rows={ofwData?.activity || familyData?.activity || []}
              stellarAddress={ofwData?.ofw.stellar_public_key}
            />
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <div className="absolute bottom-0 w-full bg-white border-t border-black/5 px-4 pb-safe pt-3 pb-6 flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-50">
        <TabItem icon={<Home />} label="Home" active={activeTab === "home"} onClick={() => setActiveTab("home")} />
        {currentUserRole === "family" ? (
          <TabItem icon={<ShoppingBag />} label="Shop" active={activeTab === "shop"} onClick={() => setActiveTab("shop")} />
        ) : (
          <TabItem icon={<TrendingUp />} label="Send" active={activeTab === "send"} onClick={() => setActiveTab("send")} />
        )}
        <TabItem icon={<CreditCard />} label="Bills" active={activeTab === "bills"} onClick={() => setActiveTab("bills")} />
        <TabItem icon={<Package />} label="Orders" active={activeTab === "orders"} onClick={() => setActiveTab("orders")} />
        <TabItem icon={<History />} label="Activity" active={activeTab === "activity"} onClick={() => setActiveTab("activity")} />
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, desc, color }: { icon: React.ReactNode, title: string, value: string, desc: string, color: string }) {
  return (
    <div className="p-3.5 bg-white border border-black/5 shadow-sm rounded-2xl flex flex-col relative overflow-hidden group">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br ${color} shadow-sm mb-3`}>
        {icon}
      </div>
      <p className="text-[10px] text-[#6b7280] uppercase mb-0.5 font-bold tracking-wide">{title}</p>
      <p className="text-[15px] font-extrabold mb-0.5 truncate">{value}</p>
      <p className="text-[10px] text-[#9ca3af] font-medium">{desc}</p>
    </div>
  );
}

function TabItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 min-w-[50px] transition-all duration-300 ${active ? "text-[#5b7cff]" : "text-[#9ca3af] hover:text-[#6b7280]"}`}
    >
      <div className={`transition-transform duration-300 ${active ? "scale-110 -translate-y-1" : "scale-100"}`}>
        {React.cloneElement(icon as React.ReactElement, { strokeWidth: active ? 2.5 : 2, className: "w-[22px] h-[22px]" })}
      </div>
      <span className={`text-[10px] ${active ? "font-bold" : "font-medium"}`}>{label}</span>
    </button>
  );
}
