import { redirect } from "next/navigation";

import { dashboardForRole } from "@/app/auth/role-routes";
import { Card } from "@/components/ui/Card";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { IconWell } from "@/components/ui/IconWell";
import { Stat } from "@/components/ui/Stat";
import { StatusPill, EventPill } from "@/components/ui/StatusPill";
import {
  CoinsIcon,
  LockIcon,
  CheckCircleIcon,
  PackageIcon,
  ArrowUpRightIcon,
} from "@/components/ui/icons";
import { loadUserProfile } from "@/lib/auth-role";
import { loadOfwDashboard } from "@/lib/dashboard/ofw";
import { formatXlm, formatXlmWithUnit, truncateHash } from "@/lib/format-xlm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time-ago";

// Reads server-side env (service_role) at request time. force-dynamic keeps
// Next from trying to statically render this at build, which would crash on
// the env-var checks in getSupabaseAdmin().
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// DEMO: the OFW → family link is not in the schema yet. For the seed there
// is exactly one OFW (Auntie Maria) and one family (Lola Cora); the demo
// hardcodes the family side of that link here. TODO(P4): replace with a
// real relation — either a `family_ofw` join table or a
// `family.sponsor_ofw_id` column. The OFW side is now driven by the
// authenticated session (see below).
const FAMILY_DEMO_ID = "22222222-2222-2222-2222-222222222222";

export default async function OfwDashboardPage() {
  // ---- Auth gate -----------------------------------------------------
  // Three states we care about: unauthenticated, authenticated-but-wrong-role,
  // and authenticated-as-ofw. Each falls through to a different destination.
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await loadUserProfile(user.id);
  if (profile?.role !== "ofw") redirect(dashboardForRole(profile?.role));

  const data = await loadOfwDashboard({
    ofwId: user.id,
    familyId: FAMILY_DEMO_ID,
  });

  return (
    <div className="min-h-screen bg-surface">
      <DashboardHeader
        workspace="OFW workspace"
        displayName={data.ofw.display_name}
        country={data.ofw.country}
      />

      <main className="mx-auto max-w-7xl px-4 md:px-8 pb-24 pt-10">
        <HeroStrip ofwName={data.ofw.display_name} family={data.family} />

        <SummaryStats totals={data.totals} releasedCount={data.releasedCount} />

        {data.activeWishlists.length === 0 && data.activity.length === 0 ? (
          <EmptyState familyName={data.family?.display_name ?? "the family"} />
        ) : (
          <>
            <AllocationPanel allocation={data.allocation} />

            <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2">
                <ActiveWishlists wishlists={data.activeWishlists} />
              </div>
              <div>
                <ActivityFeed activity={data.activity} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* Hero strip                                                            */
/* -------------------------------------------------------------------- */

function HeroStrip({
  ofwName,
  family,
}: {
  ofwName: string;
  family: { display_name: string; country: string | null } | null;
}) {
  const first = ofwName.split(" ")[0] ?? ofwName;
  return (
    <section className="mb-12">
      <p className="text-sm uppercase tracking-[0.22em] text-ink-muted font-medium">
        Welcome back
      </p>
      <h1 className="mt-3 font-display text-4xl md:text-5xl font-extrabold tracking-tight text-ink">
        Salamat, {first}.
      </h1>
      <p className="mt-4 max-w-2xl text-ink-muted text-base md:text-lg leading-relaxed">
        {family ? (
          <>
            Here&apos;s how{" "}
            <span className="text-ink font-medium">{family.display_name}</span>
            {family.country ? ` in ${family.country}` : ""} is using your support — every
            stroop accounted for, on-chain.
          </>
        ) : (
          <>
            Your family hasn&apos;t been linked yet. Once they are, every wishlist they
            build will appear here with full on-chain provenance.
          </>
        )}
      </p>
    </section>
  );
}

/* -------------------------------------------------------------------- */
/* Summary stats                                                         */
/* -------------------------------------------------------------------- */

function SummaryStats({
  totals,
  releasedCount,
}: {
  totals: { funded: bigint; inEscrow: bigint; released: bigint };
  releasedCount: number;
}) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-12">
      <Card className="p-8" interactive>
        <Stat
          icon={
            <IconWell tone="accent" size="md">
              <CoinsIcon className="h-6 w-6" />
            </IconWell>
          }
          label="Total funded"
          value={formatXlmWithUnit(totals.funded)}
          hint="Lifetime deposits to escrow"
        />
      </Card>
      <Card className="p-8" interactive>
        <Stat
          icon={
            <IconWell tone="accent" size="md">
              <LockIcon className="h-6 w-6" />
            </IconWell>
          }
          label="In escrow"
          value={formatXlmWithUnit(totals.inEscrow)}
          hint="Locked, awaiting delivery"
        />
      </Card>
      <Card className="p-8" interactive>
        <Stat
          icon={
            <IconWell tone="teal" size="md">
              <CheckCircleIcon className="h-6 w-6" />
            </IconWell>
          }
          label="Released to family"
          value={formatXlmWithUnit(totals.released)}
          hint={`${releasedCount} wishlist${releasedCount === 1 ? "" : "s"} fully delivered`}
        />
      </Card>
    </section>
  );
}

/* -------------------------------------------------------------------- */
/* Allocation by inventory category                                      */
/* -------------------------------------------------------------------- */

function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function AllocationPanel({
  allocation,
}: {
  allocation: Array<{ category: string; stroops: bigint; share: number }>;
}) {
  if (allocation.length === 0) return null;

  return (
    <Card className="p-8 md:p-10">
      <div className="flex items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
            Where your support is going
          </h2>
          <p className="text-ink-muted mt-2 text-sm md:text-base">
            Spend by category, across every wishlist your family has built.
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-6">
        {allocation.map((slice) => {
          const percent = Math.round(slice.share * 100);
          return (
            <li key={slice.category}>
              <div className="flex items-baseline justify-between gap-4 mb-3">
                <p className="font-display text-lg font-bold text-ink">
                  {categoryLabel(slice.category)}
                </p>
                <p className="text-ink-muted text-sm tabular-nums">
                  <span className="text-ink font-medium">{formatXlm(slice.stroops)} XLM</span>
                  <span className="mx-2">·</span>
                  {percent}%
                </p>
              </div>
              <div
                className="h-3 w-full rounded-full bg-surface shadow-neu-inset-sm overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label={`${categoryLabel(slice.category)} share`}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-accent-light transition-all duration-500 ease-soft"
                  style={{ width: `${Math.max(percent, 2)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* -------------------------------------------------------------------- */
/* Active wishlists                                                      */
/* -------------------------------------------------------------------- */

function ActiveWishlists({
  wishlists,
}: {
  wishlists: Array<{
    id: string;
    status: import("@/components/ui/StatusPill").WishlistStatus;
    total_stroops: bigint;
    notes: string | null;
    escrow_tx_hash: string | null;
    updated_at: string;
  }>;
}) {
  return (
    <Card className="p-8 md:p-10 mt-10">
      <div className="flex items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
            Active wishlists
          </h2>
          <p className="text-ink-muted mt-2 text-sm md:text-base">
            What your family has open right now.
          </p>
        </div>
        <span className="hidden md:inline-flex items-center bg-surface shadow-neu-inset-sm rounded-full px-3 py-1.5 text-xs font-medium text-ink-muted">
          {wishlists.length} open
        </span>
      </div>

      {wishlists.length === 0 ? (
        <p className="text-ink-muted text-sm">No wishlists in flight — everything has either been released or your family hasn&apos;t started a new one yet.</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {wishlists.map((w) => (
            <li key={w.id}>
              <div className="flex items-start gap-5 p-5 rounded-2xl bg-surface shadow-neu-inset-sm">
                <IconWell size="sm" tone="default" depth="shallow">
                  <PackageIcon className="h-5 w-5" />
                </IconWell>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <StatusPill status={w.status} />
                    <span className="text-xs text-ink-muted">Updated {timeAgo(w.updated_at)}</span>
                  </div>
                  <p className="text-ink font-medium truncate">
                    {w.notes ?? "Untitled wishlist"}
                  </p>
                  <p className="text-ink-muted text-sm mt-1">
                    <span className="text-ink font-medium tabular-nums">
                      {formatXlmWithUnit(w.total_stroops)}
                    </span>
                    {w.escrow_tx_hash ? (
                      <>
                        <span className="mx-2">·</span>
                        <span className="font-mono">{truncateHash(w.escrow_tx_hash)}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                {w.escrow_tx_hash ? (
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${w.escrow_tx_hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-xl bg-surface shadow-neu hover:shadow-neu-hover hover:-translate-y-0.5 active:shadow-neu-inset-sm transition-all duration-300 ease-soft text-ink"
                    aria-label="View on Stellar testnet explorer"
                  >
                    <ArrowUpRightIcon className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------- */
/* Activity feed                                                         */
/* -------------------------------------------------------------------- */

function ActivityFeed({
  activity,
}: {
  activity: Array<{
    id: string;
    event_type: import("@/components/ui/StatusPill").SettlementEvent;
    tx_hash: string;
    amount_stroops: bigint;
    created_at: string;
  }>;
}) {
  return (
    <Card className="p-8 md:p-10 mt-10">
      <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
        On-chain activity
      </h2>
      <p className="text-ink-muted mt-2 text-sm md:text-base mb-8">
        Latest deposits, locks, and releases.
      </p>

      {activity.length === 0 ? (
        <p className="text-ink-muted text-sm">Nothing on-chain yet.</p>
      ) : (
        <ol className="flex flex-col gap-5">
          {activity.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-4 p-4 rounded-2xl bg-surface shadow-neu-inset-sm"
            >
              <EventPill event={row.event_type} />
              <div className="flex-1 min-w-0">
                <p className="text-ink font-medium tabular-nums">
                  {formatXlmWithUnit(row.amount_stroops)}
                </p>
                <p className="text-ink-muted text-xs font-mono truncate">
                  {truncateHash(row.tx_hash, 10, 6)}
                </p>
              </div>
              <span className="text-xs text-ink-muted shrink-0">{timeAgo(row.created_at)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------- */
/* Empty state                                                           */
/* -------------------------------------------------------------------- */

function EmptyState({ familyName }: { familyName: string }) {
  return (
    <Card className="p-12 md:p-16 text-center">
      <div className="inline-flex">
        <IconWell tone="accent" size="lg">
          <PackageIcon className="h-8 w-8" />
        </IconWell>
      </div>
      <h2 className="mt-6 font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
        Nothing here yet.
      </h2>
      <p className="mt-3 max-w-md mx-auto text-ink-muted">
        Once {familyName} builds a wishlist and submits it for approval, you&apos;ll see
        the funding split, escrow status, and on-chain audit trail here.
      </p>
      <p className="mt-6 text-xs text-ink-muted">
        Run <code className="font-mono">db/seed-ofw-demo.sql</code> in the Supabase SQL
        editor to populate this dashboard with demo data.
      </p>
    </Card>
  );
}
