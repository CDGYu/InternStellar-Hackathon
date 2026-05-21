import Link from "next/link";

import { BackToHomeButton } from "@/components/ui/BackToHomeButton";
import { Card } from "@/components/ui/Card";
import { CheckCircleIcon, SparkleIcon } from "@/components/ui/icons";

import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

/**
 * Sign-in page. Server component — the only interactive piece is
 * <LoginForm>, which is a client component.
 *
 * We deliberately do NOT auto-redirect signed-in users to their dashboard
 * here. Clicking "Log in" from the marketing page should land on the form,
 * even mid-session — useful for switching accounts during the demo and for
 * recovering from a stale auth cookie. Signing in over an existing session
 * just replaces the Supabase session.
 *
 * Search params:
 *   ?registered=1 — shown after successful signup that needs email
 *                   confirmation. Renders a success banner.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { registered?: string };
}) {
  const justRegistered = searchParams?.registered === "1";

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 py-16">
      <BackToHomeButton />

      <Card className="w-full max-w-md p-8 md:p-12">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-11 w-11 rounded-2xl bg-surface shadow-neu flex items-center justify-center text-accent">
            <SparkleIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-base font-extrabold tracking-tight text-ink">
              InternStellar
            </p>
            <p className="text-xs text-ink-muted -mt-0.5">Chain Bridge</p>
          </div>
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-ink">
          Welcome back.
        </h1>
        <p className="mt-2 text-ink-muted">
          Sign in to your InternStellar account.
        </p>

        {justRegistered ? (
          <div
            role="status"
            className="mt-6 flex items-start gap-3 rounded-2xl bg-surface shadow-neu-inset-sm px-4 py-3 text-sm text-ink"
          >
            <CheckCircleIcon className="h-5 w-5 text-accent-teal shrink-0 mt-0.5" />
            <span>
              <span className="font-medium">Account created.</span>{" "}
              <span className="text-ink-muted">
                Check your email for a confirmation link, then sign in below.
              </span>
            </span>
          </div>
        ) : null}

        <div className="mt-8">
          <LoginForm />
        </div>

        <p className="mt-10 text-center text-sm text-ink-muted">
          New here?{" "}
          <Link
            href="/register"
            className="text-accent hover:text-accent-light transition-colors font-medium"
          >
            Create an account
          </Link>
        </p>
      </Card>
    </main>
  );
}
