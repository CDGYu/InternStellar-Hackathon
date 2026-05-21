import { redirect } from "next/navigation";

import { loadUserProfile } from "@/lib/auth-role";
import { loadOfwDashboard } from "@/lib/dashboard/ofw";
import { loadFamilyDashboard } from "@/lib/dashboard/family";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { MobileDashboardClient } from "./MobileDashboardClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function MobilePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await loadUserProfile(user.id);
  const admin = getSupabaseAdmin();

  let ofwId: string | null = null;
  let familyId: string | null = null;

  if (profile?.role === "ofw") {
    ofwId = user.id;
    const { data: linkedFamily } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "family")
      .eq("sponsor_ofw_id", user.id)
      .maybeSingle();
    familyId = linkedFamily?.id ?? null;
  } else if (profile?.role === "family") {
    familyId = user.id;
    const { data: familyProfile } = await admin
      .from("profiles")
      .select("sponsor_ofw_id")
      .eq("id", user.id)
      .single();
    ofwId = familyProfile?.sponsor_ofw_id ?? null;
  } else {
    // If store or other role, just redirect
    redirect("/");
  }

  // Load both dashboards if they exist
  let ofwData = null;
  let familyData = null;

  if (ofwId) {
    ofwData = await loadOfwDashboard({ ofwId, familyId });
  }
  if (familyId) {
    familyData = await loadFamilyDashboard({ familyId });
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      {/* Phone constraint wrapper */}
      <div className="w-full max-w-[428px] h-[926px] max-h-screen bg-[#f5f7fa] sm:rounded-[3rem] overflow-hidden shadow-2xl relative flex flex-col sm:border-[8px] border-black">
        <MobileDashboardClient 
          ofwData={ofwData} 
          familyData={familyData} 
          currentUserRole={profile?.role as "ofw" | "family"} 
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
