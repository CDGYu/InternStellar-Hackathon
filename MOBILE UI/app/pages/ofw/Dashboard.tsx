import DashboardLayout from "../../components/DashboardLayout";
import { Card } from "../../components/ui/card";
import { BarChart3, Lock, CheckCircle, TrendingUp, ArrowUpRight } from "lucide-react";
import type { User } from "../../App";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const spendingData = [
  { category: "Grocery", amount: 1125, percentage: 79 },
  { category: "Medicine", amount: 53, percentage: 21 },
];

const chartData = [
  { week: "W1", amount: 200, id: "week-1" },
  { week: "W2", amount: 450, id: "week-2" },
  { week: "W3", amount: 300, id: "week-3" },
  { week: "W4", amount: 800, id: "week-4" },
  { week: "W5", amount: 1425, id: "week-5" },
];

export default function Dashboard({ user, onLogout }: DashboardProps) {
  return (
    <DashboardLayout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="mb-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-medium">WELCOME BACK</p>
          <h1 className="text-4xl font-bold text-foreground mb-3">Salamat, Intern.</h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Here's how <span className="text-primary font-medium">Lola Cora</span> in Philippines is using your support — every stroops accounted for, on-chain.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 bg-card border-0 shadow-lg shadow-black/5 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <BarChart3 className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground uppercase mb-1 font-medium tracking-wide">Total Funded</p>
            <p className="text-2xl font-bold text-foreground mb-0.5">0 XLM</p>
            <p className="text-xs text-muted-foreground">Lifetime deposits</p>
          </Card>

          <Card className="p-4 bg-card border-0 shadow-lg shadow-black/5 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Lock className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground uppercase mb-1 font-medium tracking-wide">In Escrow</p>
            <p className="text-2xl font-bold text-foreground mb-0.5">1.425 XLM</p>
            <p className="text-xs text-muted-foreground">Locked funds</p>
          </Card>

          <Card className="p-4 bg-card border-0 shadow-lg shadow-black/5 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <CheckCircle className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground uppercase mb-1 font-medium tracking-wide">Released</p>
            <p className="text-2xl font-bold text-foreground mb-0.5">0 XLM</p>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </Card>
        </div>

        {/* Send Funds Card */}
        <Card className="p-6 bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] border-0 shadow-xl shadow-primary/20 rounded-3xl text-white">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">Send funds</h3>
              <p className="text-white/80 text-sm leading-relaxed">
                Deposit into three on-chain buckets. Your family spends from each one independently.
              </p>
            </div>
          </div>

          <div className="space-y-3 bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/70">Utilities</span>
              <span className="font-bold">30%</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/70">Groceries</span>
              <span className="font-bold">60%</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/70">Emergency</span>
              <span className="font-bold">10%</span>
            </div>
          </div>

          <button className="w-full mt-4 bg-white text-primary font-semibold py-3.5 rounded-2xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 shadow-lg">
            Go to Send Funds
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </Card>

        {/* Spending Breakdown */}
        <Card className="p-6 bg-card border-0 shadow-lg shadow-black/5 rounded-3xl">
          <h3 className="text-xl font-bold text-foreground mb-2">Where your support is going</h3>
          <p className="text-sm text-muted-foreground mb-6">Spend by category, across every wishlist your family has built.</p>

          {spendingData.map((item) => (
            <div key={item.category} className="mb-5 last:mb-0">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium text-foreground">{item.category}</p>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{item.amount} XLM</p>
                  <p className="text-xs text-muted-foreground">{item.percentage}%</p>
                </div>
              </div>
              <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] rounded-full"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </Card>

        {/* Chart */}
        <Card className="p-6 bg-card border-0 shadow-lg shadow-black/5 rounded-3xl">
          <h3 className="text-xl font-bold text-foreground mb-5">Funding trend</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} key="ofw-funding-chart">
                <defs>
                  <linearGradient id="ofwFundingGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5b7cff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#5b7cff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis
                  dataKey="week"
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#5b7cff"
                  strokeWidth={3}
                  fill="url(#ofwFundingGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
