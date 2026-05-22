// app/(app)/account/binding-actions.ts
"use server";

import { revalidatePath } from "next/cache";

import {
  bindFamilyToOfw,
  bindSponsorOfw,
  bindStore,
  BIND_REASON_MESSAGE,
} from "@/lib/account/binding";
import { loadUserProfile } from "@/lib/auth-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface BindActionResult {
  ok: boolean;
  error?: string;
}

async function callerWithRole(expected: "ofw" | "family") {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." as const };
  const { profile } = await loadUserProfile(user.id);
  if (!profile || profile.role !== expected) {
    return { error: `Only a ${expected} account can do this.` as const };
  }
  return { userId: user.id };
}

export async function bindFamilyAction(_p: BindActionResult | null, fd: FormData): Promise<BindActionResult> {
  const email = (fd.get("email") as string | null)?.trim();
  if (!email) return { ok: false, error: "Enter the family's email." };
  const caller = await callerWithRole("ofw");
  if ("error" in caller) return { ok: false, error: caller.error };
  const r = await bindFamilyToOfw(caller.userId, email);
  if (!r.ok) return { ok: false, error: BIND_REASON_MESSAGE[r.reason] };
  revalidatePath("/ofw"); revalidatePath("/mobile/ofw");
  return { ok: true };
}

export async function bindSponsorAction(_p: BindActionResult | null, fd: FormData): Promise<BindActionResult> {
  const email = (fd.get("email") as string | null)?.trim();
  if (!email) return { ok: false, error: "Enter your OFW's email." };
  const caller = await callerWithRole("family");
  if ("error" in caller) return { ok: false, error: caller.error };
  const r = await bindSponsorOfw(caller.userId, email);
  if (!r.ok) return { ok: false, error: BIND_REASON_MESSAGE[r.reason] };
  revalidatePath("/family"); revalidatePath("/mobile/family");
  return { ok: true };
}

export async function bindStoreAction(_p: BindActionResult | null, fd: FormData): Promise<BindActionResult> {
  const email = (fd.get("email") as string | null)?.trim();
  if (!email) return { ok: false, error: "Enter the store's email." };
  const caller = await callerWithRole("family");
  if ("error" in caller) return { ok: false, error: caller.error };
  const r = await bindStore(caller.userId, email);
  if (!r.ok) return { ok: false, error: BIND_REASON_MESSAGE[r.reason] };
  revalidatePath("/family"); revalidatePath("/mobile/family");
  return { ok: true };
}
