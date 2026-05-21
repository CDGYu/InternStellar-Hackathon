import DashboardLayout from "../../components/DashboardLayout";
import { Card } from "../../components/ui/card";
import { Activity as ActivityIcon, Lock } from "lucide-react";
import type { User } from "../../App";

interface ActivityProps {
  user: User;
  onLogout: () => void;
}

export default function Activity({ user, onLogout }: ActivityProps) {
  return (
    <DashboardLayout user={user} onLogout={onLogout}>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <ActivityIcon className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl">On-chain activity</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Latest deposits, locks, and releases.
          </p>
        </div>

        {/* Activity Item */}
        <Card className="p-4 bg-card border-border">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
              <Lock className="w-4 h-4 text-primary" />
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

        {/* Empty State */}
        <div className="text-center py-10">
          <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ActivityIcon className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            End of activity feed
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
