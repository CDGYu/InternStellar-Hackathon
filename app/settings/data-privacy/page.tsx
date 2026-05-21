import { ButtonLink } from "@/components/ui/ButtonLink";
import { SettingsPageShell } from "@/components/ui/SettingsPageShell";
import { ArrowUpRightIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default function DataPrivacyPage() {
  return (
    <SettingsPageShell
      title="Data Privacy"
      description="Your rights to your personal data, in plain language."
      maxWidth="max-w-3xl"
    >
      <div className="space-y-8 text-ink-muted text-sm leading-relaxed">
        <Section title="Access">
          <p>
            You can request a copy of everything we hold about you — your
            profile row, every wishlist you&apos;ve created, every settlement
            row tied to those wishlists. We&apos;ll send it as JSON within 30
            days.
          </p>
        </Section>

        <Section title="Correction">
          <p>
            If anything in your profile is wrong (display name, country,
            role), you can update it yourself from the{" "}
            <a
              href="/settings/account"
              className="text-accent hover:text-accent-light transition-colors"
            >
              Account Manager
            </a>{" "}
            once those edit affordances ship. For now, contact us and
            we&apos;ll update it manually.
          </p>
        </Section>

        <Section title="Deletion">
          <p>
            You can request deletion of your account at any time. We&apos;ll
            remove your profile, wishlists, and wishlist items within 30
            days. The append-only settlement audit log is retained for our
            records but redacted of your identifying details.
          </p>
          <p className="text-ink">
            On-chain transactions on the Stellar ledger are immutable by
            design. We can&apos;t remove them, but they&apos;re only linked
            to your account through the off-chain settlement table — once
            that's redacted, the chain entries are anonymous.
          </p>
        </Section>

        <Section title="Portability">
          <p>
            The exported JSON we provide for access requests is structured
            so you can import it into another wallet or escrow tool. Every
            on-chain event includes its tx hash so you can verify the
            history independently.
          </p>
        </Section>

        <Section title="Who to ask">
          <p>
            All data-privacy requests go to a single inbox so they get
            tracked together. Mention "data privacy" in the subject line
            and include the email address tied to your InternStellar
            account.
          </p>
        </Section>
      </div>

      <div className="mt-10">
        <ButtonLink
          href="mailto:Internstellar.hackathon@gmail.com?subject=Data%20privacy%20request"
          variant="primary"
          size="lg"
          className="w-full"
        >
          Send a data-privacy request
          <ArrowUpRightIcon className="h-4 w-4" />
        </ButtonLink>
      </div>
    </SettingsPageShell>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-lg font-bold text-ink mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
