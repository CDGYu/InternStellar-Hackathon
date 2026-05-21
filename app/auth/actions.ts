"use server";

import { Keypair } from "@stellar/stellar-sdk";
import { redirect } from "next/navigation";

import { dashboardForRole, type Role } from "@/app/auth/role-routes";
import { loadUserProfile } from "@/lib/auth-role";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * For the demo, every OFW and Family signs through the server's shared
 * STELLAR_DEMO_SECRET_KEY (see db/seed.sql comments + lib/stellar/contract.ts).
 * The contract calls `require_auth()` on the from-address, so the profile's
 * stellar_public_key MUST match the signer's pubkey or the on-chain tx
 * surfaces as `contract_call_failed`.
 *
 * Resolving the pubkey from the secret at sign-up time keeps the seeded
 * profiles and the freshly-registered ones aligned automatically — no manual
 * step to remember after rotating the demo signer.
 *
 * Returns null when the secret isn't configured or is malformed; callers
 * then leave stellar_public_key null and /api/deposit surfaces the clearer
 * "ofw_address_not_set" error downstream.
 */
function demoSignerPublicKey(): string | null {
  const secret = process.env.STELLAR_DEMO_SECRET_KEY;
  if (!secret) return null;
  try {
    return Keypair.fromSecret(secret).publicKey();
  } catch {
    return null;
  }
}

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

  // Supabase email-enumeration protection: when email confirmation is on
  // AND the email already exists in auth.users, signUp returns a synthetic
  // user object with an empty `identities` array (and no real auth.users
  // row). If we let this fall through to the profile insert below, the
  // foreign key on profiles.id → auth.users.id will reject it. Surface a
  // friendly message and return.
  if (
    signUpData.user.identities !== undefined &&
    signUpData.user.identities !== null &&
    signUpData.user.identities.length === 0
  ) {
    return {
      error:
        "An account with this email already exists. Try signing in instead.",
    };
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
  // OFW + Family share the demo signer's pubkey so the contract's
  // require_auth() matches. Store doesn't sign anything — leave null.
  const stellarPublicKey =
    role === "ofw" || role === "family" ? demoSignerPublicKey() : null;
  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: signUpData.user.id,
      role,
      display_name: displayName,
      stellar_public_key: stellarPublicKey,
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
