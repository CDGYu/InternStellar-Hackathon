import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { MobileSettingsShell } from "../MobileSettingsShell";

export const dynamic = "force-dynamic";

export default function MobileDataPrivacyPage() {
  return (
    <MobileSettingsShell
      title="Data Privacy"
      description="Your rights to your personal data, in plain language."
    >
      <div className="space-y-6 text-xs text-[#6b7280] leading-relaxed">
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
            <Link
              href="/mobile/settings/account"
              className="text-[#5b7cff] hover:underline"
            >
              Account Manager
            </Link>{" "}
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
          <p className="text-[#1a1d2e]">
            On-chain transactions on the Stellar ledger are immutable by
            design. We can&apos;t remove them, but they&apos;re only linked
            to your account through the off-chain settlement table — once
            that&apos;s redacted, the chain entries are anonymous.
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
            tracked together. Mention &quot;data privacy&quot; in the
            subject line and include the email address tied to your
            InternStellar account.
          </p>
        </Section>
      </div>

      <a
        href="mailto:Internstellar.hackathon@gmail.com?subject=Data%20privacy%20request"
        className="w-full mt-6 bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 flex items-center justify-center gap-2"
      >
        Send a data-privacy request
        <ArrowRight className="w-4 h-4" />
      </a>
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
