import { signOutAction } from "@/app/auth/actions";
import { dashboardForRole } from "@/app/auth/role-routes";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { IconWell } from "@/components/ui/IconWell";
import { SparkleIcon, ArrowUpRightIcon } from "@/components/ui/icons";
import { loadUserProfile } from "@/lib/auth-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Marketing / entry page. Server-rendered so the CTA can adapt to the
 * caller's auth state without a client-side flicker.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let signedInDestination: string | null = null;
  let signedInName: string | null = null;
  if (user) {
    const { profile } = await loadUserProfile(user.id);
    signedInDestination = dashboardForRole(profile?.role);
    signedInName = profile?.display_name ?? null;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-xl p-10 md:p-14 text-center">
        <div className="inline-flex">
          <IconWell tone="accent" size="lg">
            <SparkleIcon className="h-8 w-8" />
          </IconWell>
        </div>
        <p className="mt-8 text-xs uppercase tracking-[0.22em] text-ink-muted font-medium">
          InternStellar · Chain Bridge
        </p>
        <h1 className="mt-4 font-display text-4xl md:text-5xl font-extrabold tracking-tight text-ink">
          Smart remittance, on-chain.
        </h1>
        <p className="mt-5 text-ink-muted leading-relaxed">
          A 7-day prototype for OFWs and their families — funded splits, real-time
          wishlists, and Soroban-backed escrow.
        </p>

        {signedInDestination ? (
          <SignedInCta destination={signedInDestination} signedInName={signedInName} />
        ) : (
          <SignedOutCta />
        )}
      </Card>
    </main>
  );
}

function SignedOutCta() {
  return (
    <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
      <ButtonLink href="/login" variant="primary" size="lg" className="w-full sm:w-auto">
        Sign in
        <ArrowUpRightIcon className="h-4 w-4" />
      </ButtonLink>
      <ButtonLink
        href="/register"
        variant="secondary"
        size="lg"
        className="w-full sm:w-auto"
      >
        Register an account
      </ButtonLink>
    </div>
  );
}

function SignedInCta({
  destination,
  signedInName,
}: {
  destination: string;
  signedInName: string | null;
}) {
  return (
    <>
      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
        <ButtonLink href={destination} variant="primary" size="lg" className="w-full sm:w-auto">
          Go to your dashboard
          <ArrowUpRightIcon className="h-4 w-4" />
        </ButtonLink>

        {/* Sign-out is a real action (clears session cookies), so it
            stays a <button> inside a server-action <form>. */}
        <form action={signOutAction} className="w-full sm:w-auto">
          <Button type="submit" variant="secondary" size="lg" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
      {signedInName ? (
        <p className="mt-6 text-sm text-ink-muted">
          Signed in as <span className="text-ink font-medium">{signedInName}</span>
        </p>
      ) : null}
    </>
  );
}
