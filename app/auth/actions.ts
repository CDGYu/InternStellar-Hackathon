"use server";

import { redirect } from "next/navigation";

import { dashboardForRole, type Role } from "@/app/auth/role-routes";
import { loadUserProfile } from "@/lib/auth-role";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Sign-in server action. Called from the login form's <form action>.
 *
 * Returns `{ error: string }` when sign-in fails so the client can render
 * it inline. Successful sign-in throws a redirect (Next's standard pattern),
 * which is why there's no `success` branch.
 *
 * Role routing: after sign-in we look up `profiles.role` and send each role
 * to its own dashboard via [dashboardForRole](./role-routes.ts) — that
 * helper is the single source of truth for the mapping so this action,
 * the login page's already-signed-in redirect, and the dashboards'
 * wrong-role redirects can't drift apart.
 */
export interface SignInResult {
  error: string;
}

export async function signInAction(
  _prev: SignInResult | null,
  formData: FormData,
): Promise<SignInResult> {
  const email = (formData.get("email") as string | null)?.trim();
  const password = formData.get("password") as string | null;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    return { error: error?.message ?? "Sign-in failed." };
  }

  // Look up the role via service_role — see lib/auth-role.ts for why we
  // bypass the cookie-bound client here. data.user is already verified.
  const { profile, error: pErr } = await loadUserProfile(data.user.id);
  if (pErr) {
    return { error: `Signed in, but profile lookup failed: ${pErr}` };
  }
  if (!profile) {
    return {
      error:
        "Signed in, but no profile row exists for this account. Run db/seed.sql to seed demo profiles.",
    };
  }

  // Throws a NEXT_REDIRECT — must be after all DB work, never inside try/catch.
  redirect(dashboardForRole(profile.role));
}

/**
 * Sign-out server action. Wired to the sign-out button in the OFW header.
 * Always redirects to /login on success; on the rare auth error we send to
 * / so the user isn't stuck on a broken header.
 */
export async function signOutAction() {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  redirect(error ? "/" : "/login");
}

/* -------------------------------------------------------------------- */
/* Register                                                              */
/* -------------------------------------------------------------------- */

export interface RegisterResult {
  error: string;
}

const VALID_ROLES: ReadonlySet<Role> = new Set(["ofw", "family", "store"]);

/**
 * Sign-up server action.
 *
 * Flow:
 *   1. Validate fields.
 *   2. supabase.auth.signUp() — creates the auth.users row.
 *   3. Insert the matching `profiles` row (id, role, display_name).
 *      Always via service_role: if email confirmation is required, no
 *      session exists yet, so a cookie-bound insert would fail RLS.
 *   4. If a session came back (project has auto-confirm on), the user is
 *      already signed in → redirect to their dashboard.
 *      If not, redirect to /login?registered=1 so the login page can
 *      show a "check your email" banner.
 *
 * Idempotency: signUp is *not* idempotent — calling it twice for the
 * same email yields "User already registered". We surface that to the
 * caller as a friendly error.
 */
export async function registerAction(
  _prev: RegisterResult | null,
  formData: FormData,
): Promise<RegisterResult> {
  const email = (formData.get("email") as string | null)?.trim();
  const password = formData.get("password") as string | null;
  const displayName = (formData.get("display_name") as string | null)?.trim();
  const role = formData.get("role") as string | null;

  if (!email || !password || !displayName || !role) {
    return { error: "All fields are required." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  if (!VALID_ROLES.has(role as Role)) {
    return { error: "Pick a role: OFW, Family, or Store." };
  }

  const supabase = createSupabaseServerClient();

  // ---- 1. Create the auth user -------------------------------------
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, role },
    },
  });
  if (signUpErr) {
    return { error: signUpErr.message };
  }
  if (!signUpData.user) {
    // Defensive — shouldn't happen on a successful signUp.
    return { error: "Sign-up succeeded but no user was returned." };
  }

  // ---- 2. Insert the profile row via service_role ------------------
  // We can't rely on cookie-bound writes here because:
  //   - If the project requires email confirmation, signUp returns the
  //     user but no session, so the cookie-bound role has no auth.
  //   - Even if a session exists, racing the cookie-set against the
  //     INSERT introduces a flaky failure mode.
  // Service_role bypasses RLS and is the right hammer for "trusted
  // server-side post-signup setup."
  const admin = getSupabaseAdmin();
  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: signUpData.user.id,
      role,
      display_name: displayName,
    },
    { onConflict: "id" },
  );
  if (profileErr) {
    // The auth user exists at this point but the profile insert failed —
    // surface this so the caller knows. They can sign in and try again,
    // or contact support to clean up the orphaned auth row.
    return {
      error: `Account created but profile setup failed: ${profileErr.message}`,
    };
  }

  // ---- 3. Route the user --------------------------------------------
  // signUpData.session is null when email confirmation is required,
  // populated when the project auto-confirms.
  if (signUpData.session) {
    redirect(dashboardForRole(role));
  }
  redirect("/login?registered=1");
}
