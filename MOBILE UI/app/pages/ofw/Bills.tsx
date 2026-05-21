import DashboardLayout from "../../components/DashboardLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Receipt, CheckCircle } from "lucide-react";
import type { User } from "../../App";

interface BillsProps {
  user: User;
  onLogout: () => void;
}

const bills = [
  {
    id: 1,
    company: "Meralco",
    type: "Electricity",
    account: "6567-8981-2345",
    amount: "30 XLM",
    status: "Paid",
    note: "iaahdxb9dk_aijma9",
  },
  {
    id: 2,
    company: "Maynilad",
    type: "Water",
    account: "1234-5678",
    amount: "13 XLM",
    status: "Due in 7 days",
    note: "iaahdxb9dk_niknor",
  },
  {
    id: 3,
    company: "Maynilad",
    type: "Water",
    account: "1234-5678",
    amount: "13 XLM",
    status: "Paid",
    note: "iaahdxb9dk_niknor",
  },
];

export default function Bills({ user, onLogout }: BillsProps) {
  return (
    <DashboardLayout user={user} onLogout={onLogout}>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Receipt className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl">Bills</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Pay your family's utilities straight from your wallet. Each click submits a real Stellar testnet transfer to the biller.
          </p>
        </div>

        {/* Pay All Button */}
        <Button className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl py-5">
          Pay all due · 10 XLM
          <CheckCircle className="w-4 h-4 ml-2" />
        </Button>

        {/* Bills List */}
        <div className="space-y-2.5">
          {bills.map((bill) => (
            <Card key={bill.id} className="p-4 bg-card border-border">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 bg-secondary rounded-lg flex items-center justify-center">
                    <Receipt className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="mb-1">{bill.company}</p>
                    <p className="text-xs text-muted-foreground uppercase mb-1">
                      {bill.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Account: {bill.account}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {bill.note}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="mb-2">{bill.amount}</p>
                  {bill.status === "Paid" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-500 bg-green-500/10 px-3 py-1 rounded-full">
                      <CheckCircle className="w-3 h-3" />
                      {bill.status}
                    </span>
                  ) : (
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-lg text-xs">
                      Pay
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Receipt Info */}
        <Card className="p-5 bg-card border-border">
          <p className="text-xs text-muted-foreground">
            <strong>Production note:</strong> At 0.3 secs/tx on the biller's testnet account, the platform needs a Stellar Anchor partnership or an off-chain half — for the ₱1/sec/bill OFWs will see in pilot, Meralco and any other seeded biller can settle on Soroban batch at day's end.
          </p>
        </Card>

        {/* View Receipts */}
        <div className="text-center">
          <button className="text-sm text-primary hover:underline">
            • 3 PAID · VIEW RECEIPTS
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
