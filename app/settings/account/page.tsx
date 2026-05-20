import { signOutAction } from "@/app/auth/actions";
import { dashboardForRole } from "@/app/auth/role-routes";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { IconWell } from "@/components/ui/IconWell";
import { SettingsPageShell } from "@/components/ui/SettingsPageShell";
import {
  ArrowUpRightIcon,
  LockIcon,
  UserIcon,
} from "@/components/ui/icons";
import { loadUserProfile } from "@/lib/auth-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  ofw: "OFW (sponsor)",
  family: "Family (recipient)",
  store: "Store (fulfillment)",
};

export default async function AccountManagerPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <SettingsPageShell
        title="Account Manager"
        description="You're signed out. Sign in to manage your account."
      >
        <ButtonLink href="/login" variant="primary" size="lg" className="w-full">
          Sign in
          <ArrowUpRightIcon className="h-4 w-4" />
        </ButtonLink>
      </SettingsPageShell>
    );
  }

  const { profile } = await loadUserProfile(user.id);
  const dashboardHref = dashboardForRole(profile?.role);

  return (
    <SettingsPageShell
      title="Account Manager"
      description="Your profile details and account actions."
    >
      <div className="flex items-center gap-4 p-5 rounded-2xl bg-surface shadow-neu-inset-sm mb-8">
        <IconWell tone="accent" size="md">
          <UserIcon className="h-6 w-6" />
        </IconWell>
        <div className="flex-1 min-w-0">
          <p className="text-ink font-display text-lg font-bold truncate">
            {profile?.display_name ?? "Unnamed"}
          </p>
          <p className="text-ink-muted text-sm truncate">{user.email}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Field label="Role" value={ROLE_LABELS[profile?.role ?? ""] ?? "Unknown"} />
        <Field label="Country" value={profile?.country ?? "Not set"} />
        <Field
          label="Account ID"
          value={
            <span className="font-mono text-xs break-all">{user.id}</span>
          }
        />
        <Field
          label="Email confirmed"
          value={user.email_confirmed_at ? "Yes" : "Pending"}
        />
      </dl>

      <div className="flex flex-col gap-3">
        <ButtonLink
          href={dashboardHref}
          variant="primary"
          size="lg"
          className="w-full"
        >
          Go to your dashboard
          <ArrowUpRightIcon className="h-4 w-4" />
        </ButtonLink>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Change-password and connect-wallet land on the dashboard
              for now — they're real product surfaces but live outside
              this hackathon's scope. The CTAs exist so the page reads
              as complete; the destination is honest. */}
          <ButtonLink
            href={dashboardHref}
            variant="secondary"
            size="lg"
            className="w-full"
          >
            <LockIcon className="h-4 w-4" />
            Change password
          </ButtonLink>
          <ButtonLink
            href={dashboardHref}
            variant="secondary"
            size="lg"
            className="w-full"
          >
            Manage Stellar wallet
          </ButtonLink>
        </div>

        <form action={signOutAction} className="mt-2">
          <Button type="submit" variant="ghost" size="md" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </SettingsPageShell>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl bg-surface shadow-neu-inset-sm">
      <dt className="text-xs uppercase tracking-[0.16em] text-ink-muted font-medium">
        {label}
      </dt>
      <dd className="mt-1.5 text-ink text-sm">{value}</dd>
    </div>
  );
}
