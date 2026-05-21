import { useNavigate, useLocation } from "react-router";
import { Button } from "./ui/button";
import { Home, Send, Receipt, ShoppingBag, Activity, LogOut, Package, ClipboardList, MapPin } from "lucide-react";
import type { User } from "../App";

interface DashboardLayoutProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function DashboardLayout({ user, onLogout, children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    onLogout();
    navigate("/");
  };

  const getNavItems = () => {
    switch (user.role) {
      case "ofw":
        return [
          { path: "/ofw", icon: Home, label: "Intern" },
          { path: "/ofw/send", icon: Send, label: "Send" },
          { path: "/ofw/bills", icon: Receipt, label: "Bills" },
          { path: "/ofw/wishlists", icon: ShoppingBag, label: "Lists" },
          { path: "/ofw/transactions", icon: Activity, label: "Activity" },
        ];
      case "family":
        return [
          { path: "/family", icon: Home, label: "Home" },
          { path: "/family/shop", icon: ShoppingBag, label: "Shop" },
          { path: "/family/bills", icon: Receipt, label: "Bills" },
          { path: "/family/orders", icon: Package, label: "Orders" },
          { path: "/family/activity", icon: Activity, label: "Activity" },
        ];
      case "store":
        return [
          { path: "/store", icon: Home, label: "Desk" },
          { path: "/store/create-order", icon: ClipboardList, label: "Create" },
          { path: "/store/orders", icon: Package, label: "Queue" },
          { path: "/store/inventory", icon: ShoppingBag, label: "Stock" },
          { path: "/store/activity", icon: Activity, label: "Activity" },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50 px-5 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Logo & User */}
          <div>
            <h2 className="text-sm font-semibold text-foreground">InternStellar</h2>
            <p className="text-xs text-muted-foreground">Family remittance</p>
          </div>

          {/* User Info & Logout */}
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                <MapPin className="w-3 h-3" />
                {user.location}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive hover:bg-secondary/50 rounded-xl"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-5">
        {children}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border/50 px-5 py-4 shadow-2xl shadow-black/5">
        <div className="max-w-4xl mx-auto flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1.5 py-2 px-3 rounded-2xl transition-all ${
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={2.5} />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
