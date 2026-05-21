import DashboardLayout from "../../components/DashboardLayout";
import { Card } from "../../components/ui/card";
import { Activity, Lock, ArrowUpRight } from "lucide-react";
import type { User } from "../../App";

interface TransactionsProps {
  user: User;
  onLogout: () => void;
}

const transactions = [
  {
    id: 1,
    type: "Lock",
    description: "Held funds against an approved wishlist",
    hash: "5dc769e6f...137313",
    amount: "1.425 XLM",
    time: "2m & 0.5s PM",
  },
];

export default function Transactions({ user, onLogout }: TransactionsProps) {
  return (
    <DashboardLayout user={user} onLogout={onLogout}>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl">Transaction history</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Every on-chain event feed to your family's wishlists.
          </p>
        </div>

        {/* Stellar Explorer Link */}
        <Card className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm mb-1">
                <strong>Deposit history is on-chain</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Your full Stellar testnet account, including the deposit half of every transaction below.
              </p>
            </div>
            <a
              href="#"
              className="text-primary hover:underline text-sm flex items-center gap-1"
            >
              View on Stellar Expert
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </Card>

        {/* Transactions List */}
        <div className="space-y-2.5">
          {transactions.map((tx) => (
            <Card key={tx.id} className="p-4 bg-card border-border">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Lock className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm mb-1">• {tx.type}</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      {tx.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Txn {tx.hash}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="mb-1">{tx.amount}</p>
                  <p className="text-xs text-muted-foreground">{tx.time}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">End of transaction history</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
