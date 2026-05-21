import DashboardLayout from "../../components/DashboardLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ShoppingBag, Lock, Package } from "lucide-react";
import type { User } from "../../App";

interface WishlistsProps {
  user: User;
  onLogout: () => void;
}

export default function Wishlists({ user, onLogout }: WishlistsProps) {
  return (
    <DashboardLayout user={user} onLogout={onLogout}>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl">Active wishlists</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            What your family has open right now. Edit items, lock funds, or confirm delivery — all from here.
          </p>
        </div>

        {/* Wishlist Card */}
        <Card className="p-5 bg-card border-border">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 bg-secondary rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">• Delivered · Updated 30 ago</p>
                <p className="mb-2">___ert29w__ret__...2</p>
                <p className="text-sm">1.425 XLM</p>
                <p className="text-xs text-muted-foreground">
                  0 items · Spec 5dc769e6f–7212
                </p>
              </div>
            </div>
            <Button className="bg-primary hover:bg-primary/90 text-white rounded-lg text-sm px-4 py-2">
              Confirm delivery
            </Button>
          </div>
        </Card>

        {/* Empty State for Other Wishlists */}
        <div className="text-center py-10">
          <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No other active wishlists yet.
            <br />
            Your family can create more in their dashboard.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
