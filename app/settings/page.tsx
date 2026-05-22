import Link from "next/link";
import type { ReactNode } from "react";

import { dashboardForRole } from "@/app/auth/role-routes";
import { BackToHomeButton } from "@/components/ui/BackToHomeButton";
import { Card } from "@/components/ui/Card";
import { IconWell } from "@/components/ui/IconWell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  BugIcon,
  ChevronRightIcon,
  DocumentIcon,
  GearIcon,
  HelpIcon,
  LockIcon,
  MailIcon,
  MoonIcon,
  ShieldIcon,
  SparkleIcon,
  UserIcon,
} from "@/components/ui/icons";
import { loadUserProfile } from "@/lib/auth-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

/**
 * Settings hub — list of 8 items, plus an inline dark-mode toggle.
 *
 * Each list row is an inset well that contains either a link to a
 * sub-page (most) or the dark-mode toggle (one). The "menu items
 * engraved into a panel" look is intentional — it mirrors the rest of
 * the neumorphic surface vocabulary.
 *
 * Back button routes to the user's role-specific dashboard (the natural
 * "one level up" from settings). Signed-out users fall back to / since
 * they have no dashboard.
 */
export default async function SettingsPage() {
  const theme = await getTheme();

  // Resolve the back href: dashboardForRole(role) for signed-in users,
  // "/" for signed-out. dashboardForRole already returns "/" on unknown
  // roles, so this collapses to one expression.
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let backHref = "/";
  let backLabel = "Back to home";
  if (user) {
    const { profile } = await loadUserProfile(user.id);
    backHref = dashboardForRole(profile?.role);
    if (backHref !== "/") {
      backLabel = "Back to dashboard";
    }
  }

  return (
    <main className="relative min-h-screen flex items-start justify-center px-4 py-16">
      <BackToHomeButton href={backHref} label={backLabel} />

      <Card className="w-full max-w-2xl p-8 md:p-12">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-11 w-11 rounded-2xl bg-surface shadow-neu flex items-center justify-center text-accent">
            <SparkleIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-base font-extrabold tracking-tight text-ink">
              InternStellar
            </p>
            <p className="text-xs text-ink-muted -mt-0.5">Settings</p>
          </div>
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-ink">
          Settings
        </h1>
        <p className="mt-2 text-ink-muted">
          Account preferences, help, and the fine print.
        </p>

        <ul className="mt-8 flex flex-col gap-3">
          <SettingsLinkRow
            icon={<UserIcon className="h-5 w-5" />}
            label="Account Manager"
            hint="Your profile, role, and sign-out"
            href="/settings/account"
          />
          <SettingsLinkRow
            icon={<GearIcon className="h-5 w-5" />}
            label="Connections"
            hint="Link your OFW sponsor, family, or store"
            href="/settings/connections"
          />

          <DarkModeRow theme={theme} />

          <SettingsLinkRow
            icon={<MailIcon className="h-5 w-5" />}
            label="Contact Us"
            hint="Get in touch with the team"
            href="/settings/contact"
          />
          <SettingsLinkRow
            icon={<BugIcon className="h-5 w-5" />}
            label="Report a Bug"
            hint="Tell us what broke"
            href="/settings/report-bug"
          />
          <SettingsLinkRow
            icon={<HelpIcon className="h-5 w-5" />}
            label="Help & FAQ"
            hint="Common questions and answers"
            href="/settings/help"
          />
          <SettingsLinkRow
            icon={<ShieldIcon className="h-5 w-5" />}
            label="Privacy Policy"
            hint="What we collect and why"
            href="/settings/privacy"
          />
          <SettingsLinkRow
            icon={<DocumentIcon className="h-5 w-5" />}
            label="Terms of Service"
            hint="Your agreement with InternStellar"
            href="/settings/terms"
          />
          <SettingsLinkRow
            icon={<LockIcon className="h-5 w-5" />}
            label="Data Privacy"
            hint="Your rights to your data"
            href="/settings/data-privacy"
          />
        </ul>
      </Card>
    </main>
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
    <li>
      <Link
        href={href}
        className="group flex items-center gap-4 p-4 rounded-2xl bg-surface shadow-neu-inset-sm hover:shadow-neu-inset transition-all duration-300 ease-soft"
      >
        <IconWell size="sm" tone="default" depth="shallow">
          {icon}
        </IconWell>
        <div className="flex-1 min-w-0">
          <p className="text-ink font-medium">{label}</p>
          <p className="text-ink-muted text-sm truncate">{hint}</p>
        </div>
        <ChevronRightIcon className="h-5 w-5 text-ink-muted shrink-0 group-hover:text-ink transition-colors" />
      </Link>
    </li>
  );
}

function DarkModeRow({ theme }: { theme: "light" | "dark" }) {
  return (
    <li>
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface shadow-neu-inset-sm">
        <IconWell size="sm" tone="default" depth="shallow">
          <MoonIcon className="h-5 w-5" />
        </IconWell>
        <div className="flex-1 min-w-0">
          <p className="text-ink font-medium">Dark Mode</p>
          <p className="text-ink-muted text-sm truncate">
            Currently {theme === "dark" ? "on" : "off"} — affects every page
          </p>
        </div>
        <ThemeToggle theme={theme} />
      </div>
    </li>
  );
}
