import { ButtonLink } from "@/components/ui/ButtonLink";
import { IconWell } from "@/components/ui/IconWell";
import { SettingsPageShell } from "@/components/ui/SettingsPageShell";
import { ArrowUpRightIcon, BugIcon, DocumentIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default function ReportBugPage() {
  return (
    <SettingsPageShell
      title="Report a Bug"
      description="Spotted something broken? Here's how to get it fixed fastest."
    >
      <ol className="flex flex-col gap-4 mb-8">
        <Step n={1}>
          Open the page where the bug happens and note <strong>what you did</strong>,{" "}
          <strong>what you expected</strong>, and <strong>what actually happened</strong>.
        </Step>
        <Step n={2}>
          Open your browser&apos;s dev tools (F12 / Cmd-Opt-I) → Console tab.
          Copy any red error messages.
        </Step>
        <Step n={3}>
          Send it to us via email or open a GitHub issue — links below.
        </Step>
      </ol>

      <div className="flex items-start gap-5 p-6 rounded-2xl bg-surface shadow-neu-inset-sm mb-4">
        <IconWell tone="accent" size="md">
          <BugIcon className="h-6 w-6" />
        </IconWell>
        <div className="flex-1 min-w-0">
          <p className="text-ink font-display text-lg font-bold">Email</p>
          <p className="text-ink-muted text-sm mt-1">
            Best for sensitive issues or screenshots.
          </p>
          <p className="mt-3 font-mono text-sm text-accent">
            bugs@internstellar.demo
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ButtonLink
          href="mailto:bugs@internstellar.demo?subject=Bug%20report&body=What%20happened%3A%0A%0AWhat%20I%20expected%3A%0A%0ASteps%20to%20reproduce%3A%0A1.%20%0A2.%20%0A3.%20%0A%0AConsole%20output%3A%0A"
          variant="primary"
          size="lg"
          className="w-full"
        >
          Email bug report
          <ArrowUpRightIcon className="h-4 w-4" />
        </ButtonLink>
        <ButtonLink
          href="https://github.com/anthropics/internstellar-hackathon/issues/new"
          variant="secondary"
          size="lg"
          className="w-full"
          target="_blank"
          rel="noreferrer"
        >
          <DocumentIcon className="h-4 w-4" />
          GitHub issue
        </ButtonLink>
      </div>
    </SettingsPageShell>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-4 p-4 rounded-2xl bg-surface shadow-neu-inset-sm">
      <span className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-surface shadow-neu text-accent font-display font-bold text-sm">
        {n}
      </span>
      <p className="text-ink text-sm leading-relaxed">{children}</p>
    </li>
  );
}
