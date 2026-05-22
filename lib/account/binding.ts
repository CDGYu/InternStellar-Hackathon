// lib/account/binding.ts
import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type BindReason =
  | "not_found"
  | "wrong_role"
  | "already_bound"
  | "self_link"
  | "db_error";

export type Role = "ofw" | "family" | "store";

export interface TargetProfile {
  id: string;
  role: Role;
  sponsor_ofw_id: string | null;
}

export type BindResult =
  | { ok: true; targetId: string }
  | { ok: false; reason: BindReason };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Pure decision function — no IO. Given the looked-up target row and the
 * expected role, decide whether the bind is allowed. `conflictField` names
 * the column on the target that must be empty for the bind to proceed
 * (e.g. "sponsor_ofw_id" when an OFW claims a family).
 */
export function classifyBindResult(args: {
  target: TargetProfile | null;
  expectedRole: Role;
  actingId: string;
  conflictField?: keyof TargetProfile;
}): BindResult {
  const { target, expectedRole, actingId, conflictField } = args;
  if (!target) return { ok: false, reason: "not_found" };
  if (target.role !== expectedRole) return { ok: false, reason: "wrong_role" };
  if (target.id === actingId) return { ok: false, reason: "self_link" };
  if (conflictField) {
    const current = target[conflictField];
    if (current && current !== actingId) return { ok: false, reason: "already_bound" };
  }
  return { ok: true, targetId: target.id };
}

/** Human copy for each reason — safe to show inline. */
export const BIND_REASON_MESSAGE: Record<BindReason, string> = {
  not_found: "No account found with that email.",
  wrong_role: "That account exists but isn't the right type for this link.",
  already_bound: "That account is already linked to a different account. Ask them to unlink first.",
  self_link: "You can't link an account to itself.",
  db_error: "Something went wrong saving the link. Try again.",
};

/** Look up a profile id by the user's email via auth.users → profiles. */
async function findProfileByEmail(email: string): Promise<TargetProfile | null> {
  const admin = getSupabaseAdmin();
  // auth.admin.listUsers has no email filter pre-bulk; use the SQL path via
  // a view-free join: query profiles joined to auth.users through the id.
  const { data, error } = await admin
    .rpc("profile_by_email", { p_email: normalizeEmail(email) });
  if (error || !data || data.length === 0) return null;
  const row = data[0] as { id: string; role: Role; sponsor_ofw_id: string | null };
  return { id: row.id, role: row.role, sponsor_ofw_id: row.sponsor_ofw_id };
}

/** OFW claims a family: set family.sponsor_ofw_id = ofwId. */
export async function bindFamilyToOfw(ofwId: string, familyEmail: string): Promise<BindResult> {
  const target = await findProfileByEmail(familyEmail);
  const decision = classifyBindResult({ target, expectedRole: "family", actingId: ofwId, conflictField: "sponsor_ofw_id" });
  if (!decision.ok) return decision;
  const { error } = await getSupabaseAdmin()
    .from("profiles").update({ sponsor_ofw_id: ofwId }).eq("id", decision.targetId);
  return error ? { ok: false, reason: "db_error" } : { ok: true, targetId: decision.targetId };
}

/** Family picks its sponsoring OFW: set own sponsor_ofw_id = ofwId. */
export async function bindSponsorOfw(familyId: string, ofwEmail: string): Promise<BindResult> {
  const target = await findProfileByEmail(ofwEmail);
  const decision = classifyBindResult({ target, expectedRole: "ofw", actingId: familyId });
  if (!decision.ok) return decision;
  const { error } = await getSupabaseAdmin()
    .from("profiles").update({ sponsor_ofw_id: decision.targetId }).eq("id", familyId);
  return error ? { ok: false, reason: "db_error" } : { ok: true, targetId: decision.targetId };
}

/** Family picks its store: set own store_id = storeId. */
export async function bindStore(familyId: string, storeEmail: string): Promise<BindResult> {
  const target = await findProfileByEmail(storeEmail);
  const decision = classifyBindResult({ target, expectedRole: "store", actingId: familyId });
  if (!decision.ok) return decision;
  const { error } = await getSupabaseAdmin()
    .from("profiles").update({ store_id: decision.targetId }).eq("id", familyId);
  return error ? { ok: false, reason: "db_error" } : { ok: true, targetId: decision.targetId };
}
