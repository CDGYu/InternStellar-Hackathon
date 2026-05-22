import { SettingsPageShell } from "@/components/ui/SettingsPageShell";
import { IconWell } from "@/components/ui/IconWell";
import { MailIcon, UserIcon } from "@/components/ui/icons";
import { AccountBindingForm } from "@/app/(app)/account/AccountBindingForm";
import {
  bindFamilyAction,
  bindSponsorAction,
  bindStoreAction,
} from "@/app/(app)/account/binding-actions";
import { loadUserProfile } from "@/lib/auth-role";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <SettingsPageShell
        title="Connections"
        description="You're signed out. Sign in to manage your account connections."
      >
        <p className="text-ink-muted text-sm">
          Please{" "}
          <a href="/login" className="text-accent underline">
            sign in
          </a>{" "}
          to view your connections.
        </p>
      </SettingsPageShell>
    );
  }

  const { profile } = await loadUserProfile(user.id);

  if (!profile) {
    return (
      <SettingsPageShell
        title="Connections"
        description="Could not load your profile. Try refreshing."
      >
        <p className="text-ink-muted text-sm">Profile not found.</p>
      </SettingsPageShell>
    );
  }

  const admin = getSupabaseAdmin();

  // ── OFW role ──────────────────────────────────────────────────
  if (profile.role === "ofw") {
    // Find the family whose sponsor_ofw_id points to this user
    const { data: familyRow } = await admin
      .from("profiles")
      .select("id, display_name")
      .eq("sponsor_ofw_id", user.id)
      .maybeSingle();

    const linkedFamilyName = familyRow?.display_name ?? null;

    return (
      <SettingsPageShell
        title="Connections"
        description="Manage the family account you support."
      >
        <section className="flex flex-col gap-6">
          <ConnectionCard
            icon={<UserIcon className="h-5 w-5" />}
            title="Sponsored family"
            value={linkedFamilyName ?? "No family linked"}
            linked={!!linkedFamilyName}
          />

          <div>
            <p className="text-ink font-medium mb-3">
              {linkedFamilyName ? "Change linked family" : "Link a family account"}
            </p>
            <AccountBindingForm
              action={bindFamilyAction}
              label="Family email"
              placeholder="cora.family@example.com"
            />
          </div>
        </section>
      </SettingsPageShell>
    );
  }

  // ── family role ───────────────────────────────────────────────
  if (profile.role === "family") {
    // Fetch this family's own profile to get sponsor_ofw_id + store_id
    const { data: familyProfile } = await admin
      .from("profiles")
      .select("sponsor_ofw_id, store_id")
      .eq("id", user.id)
      .maybeSingle();

    const sponsorOfwId = familyProfile?.sponsor_ofw_id ?? null;
    const storeId = familyProfile?.store_id ?? null;

    // Resolve display names for each linked id
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
      <SettingsPageShell
        title="Connections"
        description="Manage your linked OFW sponsor and store."
      >
        <section className="flex flex-col gap-6">
          {/* OFW sponsor */}
          <ConnectionCard
            icon={<UserIcon className="h-5 w-5" />}
            title="Sponsor OFW"
            value={sponsorName ?? "Not linked"}
            linked={!!sponsorName}
          />
          <div>
            <p className="text-ink font-medium mb-3">
              {sponsorName ? "Change sponsor OFW" : "Link your OFW sponsor"}
            </p>
            <AccountBindingForm
              action={bindSponsorAction}
              label="OFW email"
              placeholder="maria.ofw@example.com"
            />
          </div>

          <hr className="border-ink-muted/20" />

          {/* Store */}
          <ConnectionCard
            icon={<UserIcon className="h-5 w-5" />}
            title="Store"
            value={storeName ?? "Not linked"}
            linked={!!storeName}
          />
          <div>
            <p className="text-ink font-medium mb-3">
              {storeName ? "Change store" : "Link a store"}
            </p>
            <AccountBindingForm
              action={bindStoreAction}
              label="Store email"
              placeholder="nena.store@example.com"
            />
          </div>
        </section>
      </SettingsPageShell>
    );
  }

  // ── store role ────────────────────────────────────────────────
  // Store has no outbound binding — show email to share with families
  return (
    <SettingsPageShell
      title="Connections"
      description="Share your store email so families can connect to you."
    >
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-4 p-5 rounded-2xl bg-surface shadow-neu-inset-sm">
          <IconWell tone="accent" size="md">
            <MailIcon className="h-6 w-6" />
          </IconWell>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-widest text-ink-muted font-medium mb-1">
              Your store email
            </p>
            <p className="text-ink font-medium break-all">{user.email}</p>
          </div>
        </div>
        <p className="text-ink-muted text-sm leading-relaxed">
          Share this email with the family accounts that shop at your store.
          They will enter it on their Connections page to link to you.
        </p>
      </section>
    </SettingsPageShell>
  );
}

// ─────────────────────────────────────────────────────────────────
// Small presentational component — no need for a separate file
// ─────────────────────────────────────────────────────────────────
function ConnectionCard({
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
    <div className="flex items-center gap-4 p-5 rounded-2xl bg-surface shadow-neu-inset-sm">
      <IconWell tone={linked ? "accent" : "default"} size="md">
        {icon}
      </IconWell>
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-widest text-ink-muted font-medium mb-1">
          {title}
        </p>
        <p className={`text-sm ${linked ? "text-ink font-medium" : "text-ink-muted italic"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
