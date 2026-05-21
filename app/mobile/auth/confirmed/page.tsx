import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";

import { dashboardForRole } from "@/app/auth/role-routes";
import { loadUserProfile } from "@/lib/auth-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Mobile post-email-confirmation landing. Mirrors the web
 * app/auth/confirmed/page.tsx with mobile visuals. /auth/confirm
 * (the token-exchange route) is excluded from the middleware (see
 * spec §8.1) and always redirects to /auth/confirmed; that follow-up
 * gets caught by middleware and rewritten to /mobile/auth/confirmed
 * for mobile UAs, landing here.
 *
 * Two arrival paths:
 *   1. Token exchanged successfully (session cookies set) → show
 *      success copy + Go to dashboard CTA, role-routed.
 *   2. Token failed (?error=...) → show error inline + Sign in CTA.
 */
export default async function MobileConfirmedPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const { error } = (await searchParams) ?? {};

  if (error) {
    return <ErrorView error={error} />;
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let dashboardHref = "/mobile/login";
  let displayName: string | null = null;
  if (user) {
    const { profile } = await loadUserProfile(user.id);
    if (profile) {
      // dashboardForRole returns /ofw|/family|/store; middleware rewrites
      // to /mobile/* on the follow-up hop. We could prefix here too, but
      // letting middleware do it keeps the helper as the single source of
      // truth for role → dashboard mapping.
      dashboardHref = dashboardForRole(profile.role);
      displayName = profile.display_name || null;
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#1a1d2e] font-sans px-5 py-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-black/5 text-center">
          <div className="mb-6 text-left">
            <h2 className="text-lg font-extrabold tracking-tight">InternStellar</h2>
            <p className="text-[11px] text-[#6b7280] -mt-0.5">Chain Bridge</p>
          </div>

          <div className="inline-flex w-16 h-16 rounded-2xl bg-emerald-100 items-center justify-center mb-5">
            <CheckCircle className="w-8 h-8 text-emerald-600" strokeWidth={2.5} />
          </div>

          <h1 className="text-2xl font-extrabold mb-2">Email confirmed.</h1>
          <p className="text-sm text-[#6b7280] mb-7 leading-relaxed">
            {displayName ? (
              <>
                You&apos;re all set,{" "}
                <span className="text-[#1a1d2e] font-semibold">{displayName}</span>.
                Your account is live and ready to use.
              </>
            ) : (
              <>Your account is now active. Sign in to get started.</>
            )}
          </p>

          <Link
            href={dashboardHref}
            className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {user ? "Go to your dashboard" : "Sign in"}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorView({ error }: { error: string }) {
  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#1a1d2e] font-sans px-5 py-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-black/5">
          <div className="mb-6">
            <h2 className="text-lg font-extrabold tracking-tight">InternStellar</h2>
            <p className="text-[11px] text-[#6b7280] -mt-0.5">Chain Bridge</p>
          </div>

          <h1 className="text-2xl font-extrabold mb-2">Confirmation failed.</h1>
          <p className="text-sm text-[#6b7280] mb-5 leading-relaxed">
            We couldn&apos;t confirm your email with that link. It may have
            already been used or expired.
          </p>

          <div
            role="alert"
            className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 mb-6"
          >
            {decodeURIComponent(error)}
          </div>

          <div className="space-y-3">
            <Link
              href="/mobile/login"
              className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 flex items-center justify-center gap-2"
            >
              Try signing in
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/mobile/register"
              className="w-full text-center text-sm font-semibold text-[#5b7cff] py-3 block"
            >
              Start over
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
