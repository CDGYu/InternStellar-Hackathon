import { redirect } from "next/navigation";

import { dashboardForRole } from "@/app/auth/role-routes";
import { Card } from "@/components/ui/Card";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { IconWell } from "@/components/ui/IconWell";
import { Stat } from "@/components/ui/Stat";
import { StatusPill, EventPill } from "@/components/ui/StatusPill";
import {
  LockIcon,
  CheckCircleIcon,
  PackageIcon,
  ArrowUpRightIcon,
} from "@/components/ui/icons";
import { loadUserProfile } from "@/lib/auth-role";
import { loadFamilyDashboard } from "@/lib/dashboard/family";
import { formatXlmWithUnit, truncateHash } from "@/lib/format-xlm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time-ago";

import { BalanceBreakdown } from "./BalanceBreakdown";
import { BillsSection } from "./BillsSection";
import { ConfirmDeliveryButton } from "./ConfirmDeliveryButton";
import {
  WishlistBuilder,
  type BuilderInventoryItem,
  type BuilderLineItem,
} from "./WishlistBuilder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FamilyDashboardPage() {
  // ---- Auth gate -----------------------------------------------------
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await loadUserProfile(user.id);
  if (profile?.role !== "family") redirect(dashboardForRole(profile?.role));

  const data = await loadFamilyDashboard({ familyId: user.id });

  // Split wishlists into "in-flight" vs "released" for the view. Cancelled
  // ones are already filtered out by the loader.
  const inFlight = data.wishlists.filter((w) => w.status !== "released");
  const released = data.wishlists.filter((w) => w.status === "released");

  // Bigints don't serialize across the server-client boundary, so we
  // stringify the few numeric fields the WishlistBuilder needs.
  const builderInventory: BuilderInventoryItem[] = data.inventory.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    price_stroops: i.price_stroops.toString(),
    stock: i.stock,
    unit: i.unit,
  }));
  const builderInitialItems: BuilderLineItem[] = data.activeDraft
    ? data.activeDraft.items.map((it) => ({
        id: it.id,
        inventory_id: it.inventory_id,
        inventory_name: it.inventory_name,
        inventory_unit: it.inventory_unit,
        quantity: it.quantity,
        price_stroops_at_add: it.price_stroops_at_add.toString(),
      }))
    : [];

  return (
    <div className="min-h-screen bg-surface">
      <DashboardHeader
        workspace="Family workspace"
        displayName={data.family.display_name}
        country={data.family.country}
      />

      <main className="mx-auto max-w-7xl px-4 md:px-8 pb-24 pt-10">
        <section className="mb-12">
          <p className="text-sm uppercase tracking-[0.22em] text-ink-muted font-medium">
            Welcome back
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-extrabold tracking-tight text-ink">
            Mabuhay, {firstName(data.family.display_name)}.
          </h1>
          <p className="mt-4 max-w-2xl text-ink-muted text-base md:text-lg leading-relaxed">
            {inFlight.length > 0 ? (
              <>
                You have{" "}
                <span className="text-ink font-medium">
                  {inFlight.length} wishlist{inFlight.length === 1 ? "" : "s"}
                </span>{" "}
                in flight. Build a new one below, or confirm delivery on an
                order that just arrived.
              </>
            ) : (
              <>
                Pick what you need from your local store. Funds lock in escrow
                once you submit; release when you confirm delivery.
              </>
            )}
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-12">
          <Card className="p-8" interactive>
            <Stat
              icon={
                <IconWell tone="accent" size="md">
                  <PackageIcon className="h-6 w-6" />
                </IconWell>
              }
              label="Active wishlists"
              value={String(data.totals.activeCount)}
              hint="Not yet released or cancelled"
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
              value={formatXlmWithUnit(data.totals.inEscrow)}
              hint="Locked, waiting on delivery"
            />
          </Card>
          <Card className="p-8" interactive>
            <Stat
              icon={
                <IconWell tone="teal" size="md">
                  <CheckCircleIcon className="h-6 w-6" />
                </IconWell>
              }
              label="Received"
              value={formatXlmWithUnit(data.totals.receivedValue)}
              hint={`${released.length} order${released.length === 1 ? "" : "s"} delivered`}
            />
          </Card>
        </section>

        <div className="mb-10">
          <BalanceBreakdown userId={data.family.id} />
        </div>

        <div className="mb-10">
          <WishlistBuilder
            familyId={data.family.id}
            inventory={builderInventory}
            initialWishlistId={data.activeDraft?.wishlist.id ?? null}
            initialStatus={data.activeDraft?.wishlist.status ?? null}
            initialItems={builderInitialItems}
            initialEscrowTxHash={data.activeDraft?.wishlist.escrow_tx_hash ?? null}
          />
        </div>

        <div className="mb-10">
          <BillsSection
            familyId={data.family.id}
            billers={data.billers.map((b) => ({
              id: b.id,
              name: b.name,
              category: b.category,
            }))}
            bills={data.bills.map((b) => ({
              id: b.id,
              biller_name: b.biller.name,
              biller_category: b.biller.category,
              account_number: b.account_number,
              // bigint → string for the client boundary
              amount_stroops: b.amount_stroops.toString(),
              due_date: b.due_date,
              status: b.status,
            }))}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <WishlistGroup
              title="In flight"
              description="Your active orders. Confirm delivery when an order arrives."
              wishlists={inFlight}
              emptyText="Nothing in flight — build a new wishlist above."
              familyId={data.family.id}
            />
            {released.length > 0 ? (
              <WishlistGroup
                title="Delivered"
                description="Past orders that have been released to the store."
                wishlists={released}
                emptyText=""
                familyId={data.family.id}
                muted
              />
            ) : null}
          </div>
          <div>
            <ActivityFeed activity={data.activity} />
          </div>
        </div>
      </main>
    </div>
  );
}

function firstName(displayName: string): string {
  // "Lola Cora" → "Lola"; "Auntie Maria" → "Auntie". Keeps the greeting
  // warm without showing the whole name twice (it's already in the header).
  return displayName.split(" ")[0] ?? displayName;
}

/* -------------------------------------------------------------------- */
/* Wishlist group (in-flight / delivered)                                */
/* -------------------------------------------------------------------- */

function WishlistGroup({
  title,
  description,
  wishlists,
  emptyText,
  familyId,
  muted = false,
}: {
  title: string;
  description: string;
  wishlists: Array<{
    id: string;
    status: import("@/components/ui/StatusPill").WishlistStatus;
    total_stroops: bigint;
    notes: string | null;
    escrow_tx_hash: string | null;
    item_count: number;
    updated_at: string;
  }>;
  emptyText: string;
  familyId: string;
  muted?: boolean;
}) {
  return (
    <Card className="p-8 md:p-10">
      <div className="flex items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
            {title}
          </h2>
          <p className="text-ink-muted mt-2 text-sm md:text-base">{description}</p>
        </div>
        <span className="hidden md:inline-flex items-center bg-surface shadow-neu-inset-sm rounded-full px-3 py-1.5 text-xs font-medium text-ink-muted">
          {wishlists.length}
        </span>
      </div>

      {wishlists.length === 0 ? (
        <p className="text-ink-muted text-sm">{emptyText}</p>
      ) : (
        <ul className={`flex flex-col gap-5 ${muted ? "opacity-80" : ""}`}>
          {wishlists.map((w) => (
            <li key={w.id}>
              <div className="flex items-start gap-5 p-5 rounded-2xl bg-surface shadow-neu-inset-sm">
                <IconWell size="sm" tone="default" depth="shallow">
                  <PackageIcon className="h-5 w-5" />
                </IconWell>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <StatusPill status={w.status} />
                    <span className="text-xs text-ink-muted">
                      Updated {timeAgo(w.updated_at)}
                    </span>
                  </div>
                  <p className="text-ink font-medium truncate">
                    {w.notes ?? "Untitled wishlist"}
                  </p>
                  <p className="text-ink-muted text-sm mt-1">
                    <span className="text-ink font-medium tabular-nums">
                      {formatXlmWithUnit(w.total_stroops)}
                    </span>
                    <span className="mx-2">·</span>
                    {w.item_count} item{w.item_count === 1 ? "" : "s"}
                    {w.escrow_tx_hash ? (
                      <>
                        <span className="mx-2">·</span>
                        <span className="font-mono">{truncateHash(w.escrow_tx_hash)}</span>
                      </>
                    ) : null}
                  </p>
                </div>

                {/* Trailing slot: the "Confirm delivery" CTA on delivered
                    orders, otherwise the Stellar Expert link. */}
                {w.status === "delivered" ? (
                  <ConfirmDeliveryButton familyId={familyId} wishlistId={w.id} />
                ) : w.escrow_tx_hash ? (
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
    <Card className="p-8 md:p-10">
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
