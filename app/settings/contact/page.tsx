import { IconWell } from "@/components/ui/IconWell";
import { SettingsPageShell } from "@/components/ui/SettingsPageShell";
import { MailIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <SettingsPageShell
      title="Contact Us"
      description="Questions about the product, partnerships, or anything that doesn't fit a bug report? Drop us a line."
    >
      <div className="flex items-start gap-5 p-6 rounded-2xl bg-surface shadow-neu-inset-sm">
        <IconWell tone="accent" size="md">
          <MailIcon className="h-6 w-6" />
        </IconWell>
        <div className="flex-1 min-w-0">
          <p className="text-ink font-display text-lg font-bold">Email</p>
          <p className="text-ink-muted text-sm mt-1">
            We aim to reply within two business days. For urgent demo issues,
            mention "demo" in the subject line.
          </p>
          <p className="mt-3 font-mono text-sm text-accent">
            Internstellar.hackathon@gmail.com
          </p>
        </div>
      </div>
    </SettingsPageShell>
  );
}
