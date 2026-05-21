import { Mail } from "lucide-react";

import { MobileSettingsShell } from "../MobileSettingsShell";

export const dynamic = "force-dynamic";

/**
 * Mirrors app/settings/contact/page.tsx with mobile styling.
 */
export default function MobileContactPage() {
  return (
    <MobileSettingsShell
      title="Contact Us"
      description="Questions about the product, partnerships, or anything that doesn't fit a bug report? Drop us a line."
    >
      <div className="flex items-start gap-4 p-5 rounded-2xl bg-[#f5f7fa]">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] flex items-center justify-center shrink-0">
          <Mail className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-[#1a1d2e]">Email</p>
          <p className="text-xs text-[#6b7280] mt-1 leading-relaxed">
            We aim to reply within two business days. For urgent demo issues,
            mention &quot;demo&quot; in the subject line.
          </p>
          <p className="mt-3 font-mono text-xs text-[#5b7cff] break-all">
            Internstellar.hackathon@gmail.com
          </p>
        </div>
      </div>
    </MobileSettingsShell>
  );
}
