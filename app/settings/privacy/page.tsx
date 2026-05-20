import { SettingsPageShell } from "@/components/ui/SettingsPageShell";

export const dynamic = "force-dynamic";

export default function PrivacyPolicyPage() {
  return (
    <SettingsPageShell
      title="Privacy Policy"
      description={
        <>
          Last updated: <span className="text-ink font-medium">2026-05-21</span>{" "}
          · Prototype draft — not a final legal document.
        </>
      }
      maxWidth="max-w-3xl"
    >
      <div className="space-y-8 text-ink-muted text-sm leading-relaxed">
        <Section title="What we collect">
          <p>
            When you create an account, we collect your email address and the
            display name + role you choose during signup. We never see or
            store your password — Supabase handles that.
          </p>
          <p>
            When you build a wishlist, we store the items you pick, the
            quantities, and the prices at the time you added them. Every
            on-chain escrow event (deposit, lock, release) is recorded as an
            append-only audit row tied to your wishlist.
          </p>
        </Section>

        <Section title="What we don't collect">
          <p>
            No tracking cookies, no third-party analytics, no ad pixels. The
            only cookies we set are the Supabase auth session and your
            light/dark theme preference.
          </p>
        </Section>

        <Section title="Where it lives">
          <p>
            Personal and order data lives in a Supabase project we control.
            On-chain transaction hashes also live on the Stellar testnet
            ledger, which is public by design — anyone can look up an escrow
            transaction by its hash.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            For the prototype, account and order data is kept indefinitely so
            we can revisit demo flows. In production, we&apos;d delete
            inactive accounts after 12 months unless required to retain by
            applicable financial regulations.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can request access, correction, or deletion of your personal
            data at any time via{" "}
            <a
              href="/settings/contact"
              className="text-accent hover:text-accent-light transition-colors"
            >
              Contact Us
            </a>
            . On-chain records are immutable by design and cannot be deleted
            after the fact.
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
