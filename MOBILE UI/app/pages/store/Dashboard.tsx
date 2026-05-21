import DashboardLayout from "../../components/DashboardLayout";
import { Card } from "../../components/ui/card";
import { ClipboardList, Lock, DollarSign, ArrowUpRight } from "lucide-react";
import type { User } from "../../App";

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  return (
    <DashboardLayout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="mb-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-medium">WELCOME BACK</p>
          <h1 className="text-4xl font-bold text-foreground mb-3">Aling's desk.</h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            No new orders need your attention right now. Locked orders are waiting on delivery confirmation.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 bg-card border-0 shadow-lg shadow-black/5 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <ClipboardList className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground uppercase mb-1 font-medium tracking-wide">Pending</p>
            <p className="text-2xl font-bold text-foreground mb-0.5">0</p>
            <p className="text-xs text-muted-foreground">All caught up</p>
          </Card>

          <Card className="p-4 bg-card border-0 shadow-lg shadow-black/5 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Lock className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground uppercase mb-1 font-medium tracking-wide">In Flight</p>
            <p className="text-2xl font-bold text-foreground mb-0.5">1.425 XLM</p>
            <p className="text-xs text-muted-foreground">Locked</p>
          </Card>

          <Card className="p-4 bg-card border-0 shadow-lg shadow-black/5 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <DollarSign className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground uppercase mb-1 font-medium tracking-wide">Revenue</p>
            <p className="text-2xl font-bold text-foreground mb-0.5">0 XLM</p>
            <p className="text-xs text-muted-foreground">Released</p>
          </Card>
        </div>

        {/* Create Order CTA */}
        <Card className="p-6 bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] border-0 shadow-xl shadow-primary/20 rounded-3xl text-white">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">Create order</h3>
              <p className="text-white/80 text-sm leading-relaxed mb-4">
                Build a walk-in order on a family's behalf. It lands in the queue as <strong>pending approval</strong> and follows the same lock / deliver / release flow.
              </p>
              <button className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:gap-3 transition-all">
                Go to create order
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-5 bg-card border-0 shadow-lg shadow-black/5 rounded-2xl">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">FOR FAMILY</p>
            <p className="text-lg font-bold text-foreground">Lola Cora - Philippines</p>
          </Card>

          <Card className="p-5 bg-card border-0 shadow-lg shadow-black/5 rounded-2xl">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">ITEMS (0 SELECTED)</p>
            <p className="text-lg font-bold text-foreground">GROCERY</p>
          </Card>
        </div>

        {/* On-chain Activity */}
        <Card className="p-6 bg-card border-0 shadow-lg shadow-black/5 rounded-3xl">
          <h3 className="text-xl font-bold text-foreground mb-2">On-chain activity</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Latest deposits, locks, and releases.
          </p>

          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Lock className="w-6 h-6 text-primary" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground mb-1">• Lock</p>
              <p className="text-base font-bold text-foreground mb-2">1.425 XLM</p>
              <p className="text-xs text-muted-foreground">
                Txn 5dc769e6f...137313
              </p>
            </div>
            <p className="text-xs text-muted-foreground">2m ago</p>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
