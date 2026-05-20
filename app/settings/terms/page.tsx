import { SettingsPageShell } from "@/components/ui/SettingsPageShell";

export const dynamic = "force-dynamic";

export default function TermsOfServicePage() {
  return (
    <SettingsPageShell
      title="Terms of Service"
      description={
        <>
          Last updated: <span className="text-ink font-medium">2026-05-21</span>{" "}
          · Prototype draft — not a final legal document.
        </>
      }
      maxWidth="max-w-3xl"
    >
      <div className="space-y-8 text-ink-muted text-sm leading-relaxed">
        <Section title="Using the prototype">
          <p>
            InternStellar is a hackathon prototype of an on-chain remittance
            escrow platform. By creating an account you agree to use it for
            evaluation, demo, and feedback purposes only. Do not use it for
            actual remittance traffic — there is no production support,
            uptime guarantee, or recourse path.
          </p>
        </Section>

        <Section title="Stellar testnet">
          <p>
            All on-chain activity runs against the Stellar testnet. Testnet
            XLM has no monetary value, and the testnet ledger is reset
            periodically. Any "escrow" transactions you see are real
            on-chain transactions on testnet, but they do not represent
            actual money.
          </p>
        </Section>

        <Section title="Account responsibility">
          <p>
            You&apos;re responsible for keeping your sign-in credentials safe.
            If you suspect your account has been compromised, sign out from
            all sessions and contact us. We can&apos;t recover lost passwords
            beyond Supabase&apos;s built-in reset flow.
          </p>
        </Section>

        <Section title="Limitations of liability">
          <p>
            The prototype is provided "as is" without warranty of any kind.
            We&apos;re not liable for lost demo data, broken flows, or any
            decision you make based on what you see here. Treat every output
            as a draft until production hardening is done.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update these terms as the prototype evolves. Material
            changes will be surfaced on the Settings page with an updated
            date stamp. Continued use after a change means you accept the
            new version.
          </p>
        </Section>
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
