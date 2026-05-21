import DashboardLayout from "../../components/DashboardLayout";
import { Card } from "../../components/ui/card";
import { Package, CheckCircle } from "lucide-react";
import type { User } from "../../App";

interface OrdersProps {
  user: User;
  onLogout: () => void;
}

const inFlightOrders = [
  {
    id: 1,
    status: "Draft",
    updated: "Updated just now",
    name: "Untitled wishlist",
    amount: "0 XLM",
    items: "0 items",
  },
  {
    id: 2,
    status: "Delivered",
    updated: "Updated 30 ago",
    name: "___ert29w__ret__...2",
    amount: "1.425 XLM",
    items: "0 items",
    spec: "Spec 5dc769e6f–7212",
    action: "Confirm delivery",
  },
];

export default function Orders({ user, onLogout }: OrdersProps) {
  return (
    <DashboardLayout user={user} onLogout={onLogout}>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Package className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl">In flight</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Your active orders. Confirm delivery when an order arrives.
          </p>
        </div>

        {/* Orders List */}
        <div className="space-y-2.5">
          {inFlightOrders.map((order) => (
            <Card key={order.id} className="p-4 bg-card border-border">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 bg-secondary rounded-lg flex items-center justify-center">
                    <Package className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      • {order.status} · {order.updated}
                    </p>
                    <p className="mb-2">{order.name}</p>
                    <p className="text-sm">{order.amount}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.items}
                      {order.spec && ` · ${order.spec}`}
                    </p>
                  </div>
                </div>
                {order.action && (
                  <button className="text-sm text-primary hover:underline bg-primary/10 px-4 py-2 rounded-lg">
                    {order.action}
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* On-chain Activity Preview */}
        <Card className="p-5 bg-card border-border">
          <h3 className="text-base mb-3">On-chain activity</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Latest deposits, locks, and releases.
          </p>

          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm mb-1">• Lock</p>
              <p className="text-sm mb-2">1.425 XLM</p>
              <p className="text-xs text-muted-foreground">
                Txn 5dc769e6f...137313 · 2m ago
              </p>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
