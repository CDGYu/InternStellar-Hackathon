import { IconWell } from "@/components/ui/IconWell";
import { SettingsPageShell } from "@/components/ui/SettingsPageShell";
import { BugIcon } from "@/components/ui/icons";

import { BugReportForm } from "./BugReportForm";

export const dynamic = "force-dynamic";

export default function ReportBugPage() {
  return (
    <SettingsPageShell
      title="Report a Bug"
      description="Spotted something broken? Here's how to get it fixed fastest."
    >
      <div className="flex items-start gap-5 p-6 rounded-2xl bg-surface shadow-neu-inset-sm mb-6">
        <IconWell tone="accent" size="md">
          <BugIcon className="h-6 w-6" />
        </IconWell>
        <div className="flex-1 min-w-0">
          <p className="text-ink font-display text-lg font-bold">Reports go to</p>
          <p className="text-ink-muted text-sm mt-1">
            Best for sensitive issues or screenshots.
          </p>
          <p className="mt-3 font-mono text-sm text-accent">
            Internstellar.hackathon@gmail.com
          </p>
        </div>
      </div>

      <BugReportForm />
    </SettingsPageShell>
  );
}
