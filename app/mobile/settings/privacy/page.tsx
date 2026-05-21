import Link from "next/link";
import type { ReactNode } from "react";

import { MobileSettingsShell } from "../MobileSettingsShell";

export const dynamic = "force-dynamic";

export default function MobilePrivacyPage() {
  return (
    <MobileSettingsShell
      title="Privacy Policy"
      description={
        <>
          Last updated:{" "}
          <span className="text-[#1a1d2e] font-medium">2026-05-21</span>{" "}
          · Prototype draft — not a final legal document.
        </>
      }
    >
      <div className="space-y-6 text-xs text-[#6b7280] leading-relaxed">
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
            <Link
              href="/mobile/settings/contact"
              className="text-[#5b7cff] hover:underline"
            >
              Contact Us
            </Link>
            . On-chain records are immutable by design and cannot be deleted
            after the fact.
          </p>
        </Section>
      </div>
    </MobileSettingsShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-bold text-[#1a1d2e] mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
