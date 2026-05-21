import { Bug } from "lucide-react";

import { MobileSettingsShell } from "../MobileSettingsShell";

import { MobileBugReportForm } from "./MobileBugReportForm";

export const dynamic = "force-dynamic";

export default function MobileReportBugPage() {
  return (
    <MobileSettingsShell
      title="Report a Bug"
      description="Spotted something broken? Here's how to get it fixed fastest."
    >
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#f5f7fa] mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] flex items-center justify-center shrink-0">
          <Bug className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-[#1a1d2e]">Reports go to</p>
          <p className="text-xs text-[#6b7280] mt-1">
            Best for sensitive issues or screenshots.
          </p>
          <p className="mt-2 font-mono text-xs text-[#5b7cff] break-all">
            Internstellar.hackathon@gmail.com
          </p>
        </div>
      </div>

      <MobileBugReportForm />
    </MobileSettingsShell>
  );
}
