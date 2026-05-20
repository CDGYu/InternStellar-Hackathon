import type { NextResponse } from "next/server";

import { err } from "./errors";
import { getSupabaseForToken } from "../supabase-admin";

export interface AuthedCaller {
  userId: string;
  email: string | null;
}

/**
 * Verify the `Authorization: Bearer <jwt>` header and return the caller's
 * user id. On any failure returns a NextResponse the caller should forward.
 *
 * Two failure modes are distinct so a confused frontend gets the right hint:
 *   - 401 unauthorized     → no/invalid token
 *   - (caller does 403)    → token valid but user_id mismatches ownership
 */
export async function requireUser(
  req: Request,
): Promise<AuthedCaller | NextResponse> {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return err(401, "unauthorized", "Missing Bearer token in Authorization header.");
  }
  const token = auth.slice("bearer ".length).trim();
  if (!token) {
    return err(401, "unauthorized", "Empty Bearer token.");
  }

  const supabase = getSupabaseForToken(token);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return err(401, "unauthorized", error?.message ?? "Token rejected by Supabase.");
  }
  return { userId: data.user.id, email: data.user.email ?? null };
}
