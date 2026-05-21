import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Lock, User } from "lucide-react";

import { signOutAction } from "@/app/auth/actions";
import { dashboardForRole } from "@/app/auth/role-routes";
import { loadUserProfile } from "@/lib/auth-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { MobileSettingsShell } from "../MobileSettingsShell";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  ofw: "OFW (sponsor)",
  family: "Family (recipient)",
  store: "Store (fulfillment)",
};

/**
 * Mobile equivalent of app/settings/account/page.tsx. Signed-out
 * variant shows a sign-in CTA. Signed-in variant shows profile +
 * sign-out form. Reuses signOutAction unchanged; on success
 * middleware rewrites the /login redirect to /mobile/login.
 */
export default async function MobileAccountPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <MobileSettingsShell
        title="Account Manager"
        description="You're signed out. Sign in to manage your account."
      >
        <Link
          href="/mobile/login"
          className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 flex items-center justify-center gap-2"
        >
          Sign in
          <ArrowRight className="w-4 h-4" />
        </Link>
      </MobileSettingsShell>
    );
  }

  const { profile } = await loadUserProfile(user.id);
  const webDashboard = dashboardForRole(profile?.role);
  const mobileDashboard = webDashboard === "/" ? "/mobile" : `/mobile${webDashboard}`;

  return (
    <MobileSettingsShell
      title="Account Manager"
      description="Your profile details and account actions."
    >
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#f5f7fa] mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] flex items-center justify-center shrink-0">
          <User className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-[#1a1d2e] truncate">
            {profile?.display_name ?? "Unnamed"}
          </p>
          <p className="text-xs text-[#6b7280] truncate">{user.email}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-3 mb-6">
        <Field label="Role" value={ROLE_LABELS[profile?.role ?? ""] ?? "Unknown"} />
        <Field label="Country" value={profile?.country ?? "Not set"} />
        <Field
          label="Account ID"
          value={<span className="font-mono text-[10px] break-all">{user.id}</span>}
        />
        <Field
          label="Email confirmed"
          value={user.email_confirmed_at ? "Yes" : "Pending"}
        />
      </dl>

      <div className="flex flex-col gap-3">
        <Link
          href={mobileDashboard}
          className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 flex items-center justify-center gap-2"
        >
          Go to your dashboard
          <ArrowRight className="w-4 h-4" />
        </Link>

        <div className="grid grid-cols-1 gap-2">
          {/* Change-password and connect-wallet are placeholders that route
              to the dashboard, matching web Account's intentional scope cut. */}
          <Link
            href={mobileDashboard}
            className="w-full bg-[#f5f7fa] text-[#1a1d2e] rounded-2xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            Change password
          </Link>
          <Link
            href={mobileDashboard}
            className="w-full bg-[#f5f7fa] text-[#1a1d2e] rounded-2xl py-3 text-sm font-semibold flex items-center justify-center"
          >
            Manage Stellar wallet
          </Link>
        </div>

        <form action={signOutAction} className="mt-2">
          <button
            type="submit"
            className="w-full text-center text-sm font-semibold text-red-600 py-3 hover:text-red-700"
          >
            Sign out
          </button>
        </form>
      </div>
    </MobileSettingsShell>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="p-3 rounded-2xl bg-[#f5f7fa]">
      <dt className="text-[10px] uppercase tracking-widest text-[#6b7280] font-bold">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[#1a1d2e]">{value}</dd>
    </div>
  );
}
