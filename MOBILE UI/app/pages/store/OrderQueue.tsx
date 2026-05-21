import DashboardLayout from "../../components/DashboardLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Package, CheckCircle } from "lucide-react";
import type { User } from "../../App";

interface OrderQueueProps {
  user: User;
  onLogout: () => void;
}

const orders = [
  {
    id: 1,
    status: "Pending approval",
    updated: "Updated just now",
    family: "Lola Cora",
    items: "Walk-in",
    amount: "0.65 XLM",
    itemCount: "2 items",
    action: "Waiting for confirmation",
  },
  {
    id: 2,
    status: "Delivered",
    updated: "Updated 30 ago",
    family: "Lola Cora",
    items: "___ert29w__ret__...2",
    amount: "1.425 XLM",
    itemCount: "0 items",
    spec: "Spec 5dc769e6f–7212",
    action: "Confirm delivery",
  },
  {
    id: 3,
    status: "Draft",
    updated: "Updated 30 ago",
    family: "Lola Cora",
    items: "0 XLM",
    amount: "0 XLM",
    itemCount: "0 items",
  },
];

export default function OrderQueue({ user, onLogout }: OrderQueueProps) {
  return (
    <DashboardLayout user={user} onLogout={onLogout}>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Package className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl">Order queue</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Pending approvals first, then locked orders awaiting delivery.
          </p>
        </div>

        {/* Queue Count */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">3 entries</p>
        </div>

        {/* Orders List */}
        <div className="space-y-2.5">
          {orders.map((order) => (
            <Card key={order.id} className="p-4 bg-card border-border">
              <div className="flex items-start justify-between mb-2.5">
                <div className="flex items-start gap-2.5 flex-1">
                  <div className="w-9 h-9 bg-secondary rounded-lg flex items-center justify-center">
                    <Package className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-sm">{order.status}</span>
                      {order.status === "Pending approval" && (
                        <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full">
                          ⚠ Waiting for confirmation
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{order.updated}</p>
                    <p className="mb-1">From {order.family}</p>
                    <p className="text-sm">{order.amount}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.itemCount}
                      {order.spec && ` · ${order.spec}`}
                    </p>
                  </div>
                </div>
                {order.action && order.status === "Delivered" && (
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white rounded-lg"
                  >
                    {order.action}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* On-chain Activity */}
        <Card className="p-5 bg-card border-border">
          <h3 className="text-base mb-3">On-chain activity</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Latest deposits, locks, and releases.
          </p>

          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm mb-1">• Lock</p>
              <p className="text-sm mb-2">1.425 XLM</p>
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
