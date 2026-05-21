import DashboardLayout from "../../components/DashboardLayout";
import { Card } from "../../components/ui/card";
import { ShoppingBag, Lock, Wallet, Package, ArrowUpRight } from "lucide-react";
import type { User } from "../../App";

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const buckets = [
  { name: "Utilities", description: "Electricity, water, internet", balance: "0 XLM", icon: "⚡", color: "from-amber-500 to-orange-500" },
  { name: "Groceries", description: "Daily food & essentials", balance: "0 XLM", icon: "🛒", color: "from-green-500 to-emerald-600" },
  { name: "Emergency", description: "Medicine & contingency", balance: "0 XLM", icon: "🏥", color: "from-red-500 to-pink-600" },
];

export default function Dashboard({ user, onLogout }: DashboardProps) {
  return (
    <DashboardLayout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="mb-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-medium">WELCOME BACK</p>
          <h1 className="text-4xl font-bold text-foreground mb-3">Salamat, {user.name.split(" ")[0]}.</h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Here's what you have in your buckets and what orders need your attention right now.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 bg-card border-0 shadow-lg shadow-black/5 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <ShoppingBag className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground uppercase mb-1 font-medium tracking-wide">Active Lists</p>
            <p className="text-2xl font-bold text-foreground mb-0.5">1</p>
            <p className="text-xs text-muted-foreground">In progress</p>
          </Card>

          <Card className="p-4 bg-card border-0 shadow-lg shadow-black/5 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Lock className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground uppercase mb-1 font-medium tracking-wide">In Escrow</p>
            <p className="text-2xl font-bold text-foreground mb-0.5">1.425 XLM</p>
            <p className="text-xs text-muted-foreground">Locked</p>
          </Card>

          <Card className="p-4 bg-card border-0 shadow-lg shadow-black/5 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <Wallet className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground uppercase mb-1 font-medium tracking-wide">Received</p>
            <p className="text-2xl font-bold text-foreground mb-0.5">0 XLM</p>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </Card>
        </div>

        {/* Bucket Balances */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground">Your bucket balances</h2>
            <button className="text-sm text-primary hover:underline font-medium">Rebalance...</button>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            What your sponsor has funded, by category. Read live from the on-chain contract.
          </p>

          <div className="grid gap-3">
            {buckets.map((bucket) => (
              <Card key={bucket.name} className="p-5 bg-card border-0 shadow-lg shadow-black/5 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 bg-gradient-to-br ${bucket.color} rounded-2xl flex items-center justify-center text-xl shadow-lg`}>
                      {bucket.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">{bucket.name}</p>
                      <p className="text-xs text-muted-foreground">{bucket.description}</p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-foreground">{bucket.balance}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Build Wishlist CTA */}
        <Card className="p-6 bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] border-0 shadow-xl shadow-primary/20 rounded-3xl text-white">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">Build your wishlist</h3>
              <p className="text-white/80 text-sm leading-relaxed mb-4">
                Pick what you need from the store, then lock the funds in escrow.
              </p>
              <button className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:gap-3 transition-all">
                Go to shop
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Card>

        {/* Active Wishlist */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">Active wishlists</h2>
          <Card className="p-5 bg-card border-0 shadow-lg shadow-black/5 rounded-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-primary" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">• Delivered · Updated 30 ago</p>
                  <p className="font-semibold text-foreground mb-2">___ert29w__ret__...2</p>
                  <p className="text-sm font-bold text-foreground">1.425 XLM</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    0 items · Spec 5dc769e6f–7212
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
