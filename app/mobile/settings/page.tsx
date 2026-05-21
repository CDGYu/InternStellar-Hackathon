import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Bug,
  ChevronRight,
  FileText,
  HelpCircle,
  Lock,
  Mail,
  Shield,
  User,
} from "lucide-react";

import { dashboardForRole } from "@/app/auth/role-routes";
import { loadUserProfile } from "@/lib/auth-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTheme } from "@/lib/theme";

import { DarkModeRow } from "./DarkModeRow";

export const dynamic = "force-dynamic";

/**
 * Settings hub — mobile equivalent of /settings. 7 link rows + 1
 * inline dark-mode toggle row. Back button routes to the user's
 * dashboard (or /mobile for signed-out users).
 *
 * Order matches the web hub deliberately so the spec's "single source
 * of truth for the user-facing row order" comment in app/settings/
 * page.tsx still holds across both surfaces.
 */
export default async function MobileSettingsPage() {
  const theme = getTheme();

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let backHref = "/mobile";
  let backLabel = "Back to home";
  if (user) {
    const { profile } = await loadUserProfile(user.id);
    const webDashboard = dashboardForRole(profile?.role);
    if (webDashboard !== "/") {
      backHref = `/mobile${webDashboard}`;
      backLabel = "Back to dashboard";
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#1a1d2e] font-sans px-5 py-6 flex flex-col">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="inline-flex items-center gap-2 text-sm text-[#6b7280] mb-6 -ml-1 self-start"
      >
        <ArrowLeft className="w-4 h-4" />
        {backLabel}
      </Link>

      <div className="flex-1 max-w-md mx-auto w-full">
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-black/5 mb-4">
          <div className="mb-6">
            <h2 className="text-lg font-extrabold tracking-tight">InternStellar</h2>
            <p className="text-[11px] text-[#6b7280] -mt-0.5">Settings</p>
          </div>

          <h1 className="text-2xl font-extrabold mb-1.5">Settings</h1>
          <p className="text-sm text-[#6b7280]">
            Account preferences, help, and the fine print.
          </p>
        </div>

        <ul className="flex flex-col gap-2">
          <li>
            <SettingsLinkRow
              icon={<User className="w-5 h-5" />}
              label="Account Manager"
              hint="Your profile, role, and sign-out"
              href="/mobile/settings/account"
            />
          </li>
          <li>
            <DarkModeRow theme={theme} />
          </li>
          <li>
            <SettingsLinkRow
              icon={<Mail className="w-5 h-5" />}
              label="Contact Us"
              hint="Get in touch with the team"
              href="/mobile/settings/contact"
            />
          </li>
          <li>
            <SettingsLinkRow
              icon={<Bug className="w-5 h-5" />}
              label="Report a Bug"
              hint="Tell us what broke"
              href="/mobile/settings/report-bug"
            />
          </li>
          <li>
            <SettingsLinkRow
              icon={<HelpCircle className="w-5 h-5" />}
              label="Help & FAQ"
              hint="Common questions and answers"
              href="/mobile/settings/help"
            />
          </li>
          <li>
            <SettingsLinkRow
              icon={<Shield className="w-5 h-5" />}
              label="Privacy Policy"
              hint="What we collect and why"
              href="/mobile/settings/privacy"
            />
          </li>
          <li>
            <SettingsLinkRow
              icon={<FileText className="w-5 h-5" />}
              label="Terms of Service"
              hint="Your agreement with InternStellar"
              href="/mobile/settings/terms"
            />
          </li>
          <li>
            <SettingsLinkRow
              icon={<Lock className="w-5 h-5" />}
              label="Data Privacy"
              hint="Your rights to your data"
              href="/mobile/settings/data-privacy"
            />
          </li>
        </ul>
      </div>
    </div>
  );
}

function SettingsLinkRow({
  icon,
  label,
  hint,
  href,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-black/5 shadow-sm hover:bg-slate-50 transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-[#1a1d2e]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1a1d2e]">{label}</p>
        <p className="text-[11px] text-[#6b7280] mt-0.5 truncate">{hint}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-[#9ca3af] shrink-0" />
    </Link>
  );
}
