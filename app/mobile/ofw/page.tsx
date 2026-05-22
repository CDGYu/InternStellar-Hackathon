import { redirect } from "next/navigation";

import { loadUserProfile } from "@/lib/auth-role";
import { loadOfwDashboard } from "@/lib/dashboard/ofw";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { MobileDashboardClient } from "../MobileDashboardClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Mobile OFW dashboard. Mirrors the web /ofw route. signInAction
 * redirects an OFW caller to /ofw on success — middleware rewrites
 * that to /mobile/ofw for mobile UAs, which lands here.
 */
export default async function MobileOfwPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await loadUserProfile(user.id);
  if (profile?.role !== "ofw") {
    redirect("/");
  }

  const admin = getSupabaseAdmin();
  const { data: linkedFamily } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "family")
    .eq("sponsor_ofw_id", user.id)
    .maybeSingle();

  const familyId = linkedFamily?.id ?? null;
  const ofwData = await loadOfwDashboard({ ofwId: user.id, familyId });
  const familyData = familyId
    ? await (await import("@/lib/dashboard/family")).loadFamilyDashboard({ familyId })
    : null;

  return (
    <MobileDashboardClient
      ofwData={ofwData}
      familyData={familyData}
      currentUserRole="ofw"
      currentUserId={user.id}
      needsFamilyLink={familyId === null}
    />
  );
}
