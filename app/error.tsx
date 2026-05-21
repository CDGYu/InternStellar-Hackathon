"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { IconWell } from "@/components/ui/IconWell";
import { BugIcon } from "@/components/ui/icons";

/**
 * Global error boundary for the App Router.
 *
 * Renders whenever a Server Component, layout, or Server Action that wasn't
 * caught further down throws. Without this file, Next.js production shows
 * the generic "Application error: a server-side exception has occurred"
 * page with only an opaque digest — which is the failure mode that prompted
 * this file's creation.
 *
 * What we do instead:
 *   - State plainly that something is wrong.
 *   - Surface the digest so the operator can correlate with `vercel logs`,
 *     but never the raw stack (production hides it from us too anyway).
 *   - Send the user one click away from /status, which runs the same probes
 *     as /api/health and renders a humanized checklist.
 *   - Offer a "Try again" button that calls Next's reset() so transient
 *     errors don't strand the user on this page.
 *
 * `error.tsx` MUST be a client component (Next.js requirement) and MUST
 * NOT itself depend on Supabase / Stellar / env vars — otherwise a
 * misconfigured deploy can fail to render this very page. Keep it dumb.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Logs are shipped to Vercel automatically; this just makes them
    // easy to spot in `vercel logs --since 10m | grep "[app/error]"`.
    console.error("[app/error] uncaught error rendered the global boundary:", {
      digest: error.digest,
      name: error.name,
      message: error.message,
    });
  }, [error]);

  const digest = error.digest ? `Digest: ${error.digest}` : null;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-xl p-10 md:p-14 text-center">
        <div className="inline-flex">
          <IconWell tone="accent" size="lg">
            <BugIcon className="h-8 w-8" />
          </IconWell>
        </div>
        <p className="mt-8 text-xs uppercase tracking-[0.22em] text-ink-muted font-medium">
          InternStellar · Something went wrong
        </p>
        <h1 className="mt-4 font-display text-3xl md:text-4xl font-extrabold tracking-tight text-ink">
          The server hit an error rendering this page.
        </h1>
        <p className="mt-5 text-ink-muted leading-relaxed">
          Most of the time this means the deploy is missing one or more environment variables.
          Open the deployment status page below to see exactly what&apos;s configured and what
          isn&apos;t. If everything looks green there, hit &ldquo;Try again&rdquo; — transient
          errors usually clear on a retry.
        </p>

        {digest ? (
          <p
            className="mt-6 inline-block rounded-2xl bg-surface shadow-neu-inset-sm px-4 py-2 text-xs text-ink-muted font-mono"
            aria-label="Error digest for log correlation"
          >
            {digest}
          </p>
        ) : null}

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <ButtonLink
            href="/status"
            variant="primary"
            size="lg"
            className="w-full sm:w-auto"
          >
            View deployment status
          </ButtonLink>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => reset()}
            className="w-full sm:w-auto"
          >
            Try again
          </Button>
        </div>
      </Card>
    </main>
  );
}
