import { dashboardForRole } from "@/app/auth/role-routes";
import { BackToHomeButton } from "@/components/ui/BackToHomeButton";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { IconWell } from "@/components/ui/IconWell";
import {
  ArrowUpRightIcon,
  CheckCircleIcon,
  SparkleIcon,
} from "@/components/ui/icons";
import { loadUserProfile } from "@/lib/auth-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Post-email-confirmation landing.
 *
 * Two ways to land here:
 *   1. /auth/confirm verified the token, set the session cookies, then
 *      redirected here (no `error` param). At that point `getUser()`
 *      should resolve — we use it to personalize and offer a "Go to
 *      dashboard" CTA routed by role.
 *   2. Verification failed (e.g. link reused or expired). `?error=…`
 *      carries the message; we show it inline and offer a sign-in CTA
 *      so the user has somewhere to go.
 *
 * No interactive form lives here, so the whole thing stays a server
 * component.
 */
export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const { error } = (await searchParams) ?? {};

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If we have a session (verifyOtp succeeded and cookies stuck), look
  // up the role to pick the right dashboard. Falls back to /login if the
  // profile row is somehow missing — shouldn't happen since registerAction
  // always inserts one, but harmless to defend.
  let dashboardHref = "/login";
  let displayName: string | null = null;
  if (user && !error) {
    const { profile } = await loadUserProfile(user.id);
    if (profile) {
      dashboardHref = dashboardForRole(profile.role);
      displayName = profile.display_name || null;
    }
  }

  if (error) {
    return (
      <ErrorView error={error} />
    );
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 py-16">
      <BackToHomeButton />

      <Card className="w-full max-w-md p-8 md:p-12 text-center">
        <div className="flex items-center gap-3 mb-10 justify-center sm:justify-start">
          <div className="h-11 w-11 rounded-2xl bg-surface shadow-neu flex items-center justify-center text-accent">
            <SparkleIcon className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="font-display text-base font-extrabold tracking-tight text-ink">
              InternStellar
            </p>
            <p className="text-xs text-ink-muted -mt-0.5">Chain Bridge</p>
          </div>
        </div>

        <div className="inline-flex">
          <IconWell tone="teal" size="lg">
            <CheckCircleIcon className="h-8 w-8" />
          </IconWell>
        </div>

        <h1 className="mt-8 font-display text-3xl md:text-4xl font-extrabold tracking-tight text-ink">
          Email confirmed.
        </h1>
        <p className="mt-3 text-ink-muted leading-relaxed">
          {displayName ? (
            <>
              You&apos;re all set,{" "}
              <span className="text-ink font-medium">{displayName}</span>. Your
              account is live and ready to use.
            </>
          ) : (
            <>Your account is now active. Sign in to get started.</>
          )}
        </p>

        <div className="mt-10 flex flex-col items-center gap-3">
          {user ? (
            <ButtonLink
              href={dashboardHref}
              variant="primary"
              size="lg"
              className="w-full"
            >
              Go to your dashboard
              <ArrowUpRightIcon className="h-4 w-4" />
            </ButtonLink>
          ) : (
            <ButtonLink href="/login" variant="primary" size="lg" className="w-full">
              Sign in
              <ArrowUpRightIcon className="h-4 w-4" />
            </ButtonLink>
          )}
        </div>
      </Card>
    </main>
  );
}

/**
 * Failure view — same shell, different copy, no dashboard CTA. We render
 * the actual error message because the common causes (expired token,
 * already-used link) read fine to a real user.
 */
function ErrorView({ error }: { error: string }) {
  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 py-16">
      <BackToHomeButton />

      <Card className="w-full max-w-md p-8 md:p-12 text-center">
        <div className="flex items-center gap-3 mb-10 justify-center sm:justify-start">
          <div className="h-11 w-11 rounded-2xl bg-surface shadow-neu flex items-center justify-center text-accent">
            <SparkleIcon className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="font-display text-base font-extrabold tracking-tight text-ink">
              InternStellar
            </p>
            <p className="text-xs text-ink-muted -mt-0.5">Chain Bridge</p>
          </div>
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-ink">
          Confirmation failed.
        </h1>
        <p className="mt-3 text-ink-muted leading-relaxed">
          We couldn&apos;t confirm your email with that link. It may have
          already been used or expired.
        </p>

        <div
          role="alert"
          className="mt-6 rounded-2xl bg-surface shadow-neu-inset-sm px-4 py-3 text-sm text-red-500 text-left"
        >
          {decodeURIComponent(error)}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3">
          <ButtonLink href="/login" variant="primary" size="lg" className="w-full">
            Try signing in
            <ArrowUpRightIcon className="h-4 w-4" />
          </ButtonLink>
          <ButtonLink href="/register" variant="secondary" size="lg" className="w-full">
            Start over
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
