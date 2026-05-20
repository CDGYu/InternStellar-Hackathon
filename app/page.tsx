import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { IconWell } from "@/components/ui/IconWell";
import { SparkleIcon, ArrowUpRightIcon } from "@/components/ui/icons";

/**
 * Marketing / entry page. Always shows Log in / Register — never auto-routes
 * a signed-in caller to their dashboard, since the landing is a shared entry
 * point we want consistent for everyone.
 */
export const dynamic = "force-dynamic";

export default function Home() {
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

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <ButtonLink href="/login" variant="primary" size="lg" className="w-full sm:w-auto">
            Log in
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
      </Card>
    </main>
  );
}
