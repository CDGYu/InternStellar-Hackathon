import { Mail, User } from "lucide-react";

import { AccountBindingForm } from "@/app/(app)/account/AccountBindingForm";
import {
  bindFamilyAction,
  bindSponsorAction,
  bindStoreAction,
} from "@/app/(app)/account/binding-actions";
import { loadUserProfile } from "@/lib/auth-role";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { MobileSettingsShell } from "../MobileSettingsShell";

export const dynamic = "force-dynamic";

export default async function MobileConnectionsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <MobileSettingsShell
        title="Connections"
        description="You're signed out. Sign in to manage your account connections."
      >
        <a
          href="/mobile/login"
          className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 flex items-center justify-center gap-2"
        >
          Sign in
        </a>
      </MobileSettingsShell>
    );
  }

  const { profile } = await loadUserProfile(user.id);

  if (!profile) {
    return (
      <MobileSettingsShell
        title="Connections"
        description="Could not load your profile. Try refreshing."
      >
        <p className="text-sm text-[#6b7280]">Profile not found.</p>
      </MobileSettingsShell>
    );
  }

  const admin = getSupabaseAdmin();

  // ── OFW role ──────────────────────────────────────────────────
  if (profile.role === "ofw") {
    const { data: familyRow } = await admin
      .from("profiles")
      .select("id, display_name")
      .eq("sponsor_ofw_id", user.id)
      .maybeSingle();

    const linkedFamilyName = familyRow?.display_name ?? null;

    return (
      <MobileSettingsShell
        title="Connections"
        description="Manage the family account you support."
      >
        <div className="flex flex-col gap-5">
          <MobileConnectionCard
            icon={<User className="w-5 h-5 text-white" />}
            title="Sponsored family"
            value={linkedFamilyName ?? "No family linked"}
            linked={!!linkedFamilyName}
          />

          <div>
            <p className="text-sm font-semibold text-[#1a1d2e] mb-3">
              {linkedFamilyName ? "Change linked family" : "Link a family account"}
            </p>
            <AccountBindingForm
              action={bindFamilyAction}
              label="Family email"
              placeholder="cora.family@example.com"
            />
          </div>
        </div>
      </MobileSettingsShell>
    );
  }

  // ── family role ───────────────────────────────────────────────
  if (profile.role === "family") {
    const { data: familyProfile } = await admin
      .from("profiles")
      .select("sponsor_ofw_id, store_id")
      .eq("id", user.id)
      .maybeSingle();

    const sponsorOfwId = familyProfile?.sponsor_ofw_id ?? null;
    const storeId = familyProfile?.store_id ?? null;

    let sponsorName: string | null = null;
    if (sponsorOfwId) {
      const { data } = await admin
        .from("profiles")
        .select("display_name")
        .eq("id", sponsorOfwId)
        .maybeSingle();
      sponsorName = data?.display_name ?? null;
    }

    let storeName: string | null = null;
    if (storeId) {
      const { data } = await admin
        .from("profiles")
        .select("display_name")
        .eq("id", storeId)
        .maybeSingle();
      storeName = data?.display_name ?? null;
    }

    return (
      <MobileSettingsShell
        title="Connections"
        description="Manage your linked OFW sponsor and store."
      >
        <div className="flex flex-col gap-5">
          {/* OFW sponsor */}
          <MobileConnectionCard
            icon={<User className="w-5 h-5 text-white" />}
            title="Sponsor OFW"
            value={sponsorName ?? "Not linked"}
            linked={!!sponsorName}
          />
          <div>
            <p className="text-sm font-semibold text-[#1a1d2e] mb-3">
              {sponsorName ? "Change sponsor OFW" : "Link your OFW sponsor"}
            </p>
            <AccountBindingForm
              action={bindSponsorAction}
              label="OFW email"
              placeholder="maria.ofw@example.com"
            />
          </div>

          <hr className="border-[#e5e7eb]" />

          {/* Store */}
          <MobileConnectionCard
            icon={<User className="w-5 h-5 text-white" />}
            title="Store"
            value={storeName ?? "Not linked"}
            linked={!!storeName}
          />
          <div>
            <p className="text-sm font-semibold text-[#1a1d2e] mb-3">
              {storeName ? "Change store" : "Link a store"}
            </p>
            <AccountBindingForm
              action={bindStoreAction}
              label="Store email"
              placeholder="nena.store@example.com"
            />
          </div>
        </div>
      </MobileSettingsShell>
    );
  }

  // ── store role ────────────────────────────────────────────────
  return (
    <MobileSettingsShell
      title="Connections"
      description="Share your store email so families can connect to you."
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#f5f7fa]">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] flex items-center justify-center shrink-0">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mb-0.5">
              Your store email
            </p>
            <p className="text-sm font-semibold text-[#1a1d2e] break-all">
              {user.email}
            </p>
          </div>
        </div>
        <p className="text-sm text-[#6b7280] leading-relaxed">
          Share this email with the family accounts that shop at your store.
          They will enter it on their Connections page to link to you.
        </p>
      </div>
    </MobileSettingsShell>
  );
}

function MobileConnectionCard({
  icon,
  title,
  value,
  linked,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  linked: boolean;
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#f5f7fa]">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          linked
            ? "bg-gradient-to-br from-[#5b7cff] to-[#7c9aff]"
            : "bg-[#e5e7eb]"
        }`}
      >
        {linked ? (
          icon
        ) : (
          <User className="w-5 h-5 text-[#9ca3af]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-[#6b7280] font-bold mb-0.5">
          {title}
        </p>
        <p
          className={`text-sm ${
            linked ? "font-semibold text-[#1a1d2e]" : "italic text-[#9ca3af]"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
