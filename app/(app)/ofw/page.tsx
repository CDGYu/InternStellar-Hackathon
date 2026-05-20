import { redirect } from "next/navigation";

import { dashboardForRole } from "@/app/auth/role-routes";
import { Card } from "@/components/ui/Card";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { IconWell } from "@/components/ui/IconWell";
import { Stat } from "@/components/ui/Stat";
import {
  CoinsIcon,
  LockIcon,
  CheckCircleIcon,
  PackageIcon,
  ArrowUpRightIcon,
} from "@/components/ui/icons";
import { loadUserProfile } from "@/lib/auth-role";
import { loadOfwDashboard } from "@/lib/dashboard/ofw";
import { formatXlm, formatXlmWithUnit } from "@/lib/format-xlm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { BillsPanel } from "./BillsPanel";
import { OfwWishlistRow } from "./OfwWishlistRow";
import { SendFundsForm } from "./SendFundsForm";
import { TransactionHistory } from "./TransactionHistory";

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

        <div className="mb-10">
          <SendFundsForm ofwId={data.ofw.id} />
        </div>

        <div className="mb-10">
          <BillsPanel
            ofwId={data.ofw.id}
            bills={data.bills.map((b) => ({
              id: b.id,
              biller: b.biller,
              account_number: b.account_number,
              // bigint → string for the client boundary
              amount_stroops: b.amount_stroops.toString(),
              due_date: b.due_date,
              status: b.status,
              autopay_enabled: b.autopay_enabled,
            }))}
          />
        </div>

        {data.activeWishlists.length === 0 && data.activity.length === 0 ? (
          <EmptyState familyName={data.family?.display_name ?? "the family"} />
        ) : (
          <>
            <AllocationPanel allocation={data.allocation} />

            <div className="mt-10">
              <ActiveWishlists
                wishlists={data.activeWishlists}
                familyId={FAMILY_DEMO_ID}
                inventory={data.inventory}
              />
            </div>

            <div className="mt-10">
              <TransactionHistory
                rows={data.activity}
                ofwStellarAddress={data.ofw.stellar_public_key}
              />
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
  familyId,
  inventory,
}: {
  wishlists: Array<{
    id: string;
    status: import("@/components/ui/StatusPill").WishlistStatus;
    total_stroops: bigint;
    notes: string | null;
    escrow_tx_hash: string | null;
    updated_at: string;
    items: Array<{
      id: string;
      inventory_id: string;
      inventory_name: string;
      inventory_unit: string | null;
      quantity: number;
      price_stroops_at_add: bigint;
    }>;
  }>;
  familyId: string;
  inventory: Array<{
    id: string;
    name: string;
    category: string;
    price_stroops: bigint;
    stock: number;
    unit: string | null;
  }>;
}) {
  // Stringify the inventory bigints once at this boundary — passed into
  // every row, so converting per-row would be wasteful.
  const builderInventory = inventory.map((inv) => ({
    id: inv.id,
    name: inv.name,
    category: inv.category,
    price_stroops: inv.price_stroops.toString(),
    stock: inv.stock,
    unit: inv.unit,
  }));

  return (
    <Card className="p-8 md:p-10 mt-10">
      <div className="flex items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
            Active wishlists
          </h2>
          <p className="text-ink-muted mt-2 text-sm md:text-base">
            What your family has open right now. Edit items, lock funds, or
            confirm delivery — all from here.
          </p>
        </div>
        <span className="hidden md:inline-flex items-center bg-surface shadow-neu-inset-sm rounded-full px-3 py-1.5 text-xs font-medium text-ink-muted">
          {wishlists.length} open
        </span>
      </div>

      {wishlists.length === 0 ? (
        <p className="text-ink-muted text-sm">
          No wishlists in flight — everything has either been released or your
          family hasn&apos;t started a new one yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {wishlists.map((w) => (
            <OfwWishlistRow
              key={w.id}
              familyId={familyId}
              wishlistId={w.id}
              status={w.status}
              notes={w.notes}
              totalStroops={w.total_stroops.toString()}
              escrowTxHash={w.escrow_tx_hash}
              updatedAt={w.updated_at}
              items={w.items.map((it) => ({
                id: it.id,
                inventory_id: it.inventory_id,
                inventory_name: it.inventory_name,
                inventory_unit: it.inventory_unit,
                quantity: it.quantity,
                // bigint → string for the client boundary
                price_stroops_at_add: it.price_stroops_at_add.toString(),
              }))}
              inventory={builderInventory}
            />
          ))}
        </ul>
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
