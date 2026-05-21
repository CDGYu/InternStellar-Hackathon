import { redirect } from "next/navigation";

import { loadUserProfile } from "@/lib/auth-role";
import { loadFamilyDashboard } from "@/lib/dashboard/family";
import { loadOfwDashboard } from "@/lib/dashboard/ofw";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { MobileDashboardClient } from "../MobileDashboardClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Mobile Family dashboard. Mirrors the web /family route. signInAction
 * redirects a family caller to /family on success → middleware rewrites
 * to /mobile/family for mobile UAs.
 */
export default async function MobileFamilyPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await loadUserProfile(user.id);
  if (profile?.role !== "family") {
    redirect("/");
  }

  const admin = getSupabaseAdmin();
  const { data: familyProfile } = await admin
    .from("profiles")
    .select("sponsor_ofw_id")
    .eq("id", user.id)
    .single();

  const ofwId = familyProfile?.sponsor_ofw_id ?? null;
  const familyData = await loadFamilyDashboard({ familyId: user.id });
  const ofwData = ofwId
    ? await loadOfwDashboard({ ofwId, familyId: user.id })
    : null;

  return (
    <MobileDashboardClient
      ofwData={ofwData}
      familyData={familyData}
      currentUserRole="family"
      currentUserId={user.id}
    />
  );
}
