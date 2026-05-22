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
  PackageIcon,
  ArrowUpRightIcon,
} from "@/components/ui/icons";
import { loadUserProfile } from "@/lib/auth-role";
import { loadStoreDashboard } from "@/lib/dashboard/store";
import { formatXlmWithUnit, truncateHash } from "@/lib/format-xlm";
import { STELLAR_EXPLORER_BASE } from "@/lib/stellar/explorer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time-ago";

import { CreateOrderForm } from "./CreateOrderForm";
import { InventoryItemCard } from "./InventoryItemCard";
import { MarkDeliveredButton } from "./MarkDeliveredButton";
import { OrdersRealtimeRefresher } from "./OrdersRealtimeRefresher";
import { ReceiptCard } from "./ReceiptCard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StoreDashboardPage() {
  // ---- Auth gate -----------------------------------------------------
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await loadUserProfile(user.id);
  if (profile?.role !== "store") redirect(dashboardForRole(profile?.role));

  const data = await loadStoreDashboard({ storeId: user.id });

  return (
    <div className="min-h-screen bg-surface">
      <DashboardHeader
        workspace="Store workspace"
        displayName={data.store.display_name}
        country={data.store.country}
      />

      <main className="mx-auto max-w-7xl px-4 md:px-8 pb-24 pt-10">
        {/* Invisible — subscribes to wishlist + settlement events and
            triggers router.refresh() so the queue updates live when a
            family locks. */}
        <OrdersRealtimeRefresher />

        <section className="mb-12">
          <p className="text-sm uppercase tracking-[0.22em] text-ink-muted font-medium">
            Welcome back
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-extrabold tracking-tight text-ink">
            {firstName(data.store.display_name)}&apos;s desk.
          </h1>
          <p className="mt-4 max-w-2xl text-ink-muted text-base md:text-lg leading-relaxed">
            {data.totals.pendingCount > 0 ? (
              <>
                <span className="text-ink font-medium">
                  {data.totals.pendingCount} order
                  {data.totals.pendingCount === 1 ? "" : "s"}
                </span>{" "}
                waiting on your approval. Once locked, families can confirm
                delivery and the escrow releases to you.
              </>
            ) : (
              <>
                No new orders need your attention right now. Locked orders are
                waiting on delivery confirmation.
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
              label="Pending approval"
              value={String(data.totals.pendingCount)}
              hint={
                data.totals.pendingCount > 0
                  ? "Needs your review"
                  : "All caught up"
              }
            />
          </Card>
          <Card className="p-8" interactive>
            <Stat
              icon={
                <IconWell tone="accent" size="md">
                  <LockIcon className="h-6 w-6" />
                </IconWell>
              }
              label="Locked, in flight"
              value={formatXlmWithUnit(data.totals.inEscrow)}
              hint="Pending delivery confirmation"
            />
          </Card>
          <Card className="p-8" interactive>
            <Stat
              icon={
                <IconWell tone="teal" size="md">
                  <CoinsIcon className="h-6 w-6" />
                </IconWell>
              }
              label="Revenue"
              value={formatXlmWithUnit(data.totals.revenue)}
              hint="Released to your store"
            />
          </Card>
        </section>

        {data.orders.length === 0 && data.inventory.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-10">
            <CreateOrderForm
              storeId={data.store.id}
              families={data.families}
              inventory={data.inventory.map((inv) => ({
                id: inv.id,
                name: inv.name,
                category: inv.category,
                // bigint → string for the client boundary
                price_stroops: inv.price_stroops.toString(),
                stock: inv.stock,
                unit: inv.unit,
              }))}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2">
                <OrderQueue orders={data.orders} />
              </div>
              <div>
                <ActivityFeed activity={data.activity} />
              </div>
            </div>

            {data.receipts.length > 0 ? (
              <ReceiptsPanel receipts={data.receipts} />
            ) : null}

            <InventoryPanel
              inventory={data.inventory}
              outOfStockCount={data.totals.outOfStockCount}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function firstName(displayName: string): string {
  return displayName.split(" ")[0] ?? displayName;
}

/* -------------------------------------------------------------------- */
/* Receipts panel — released orders with their settled details          */
/* -------------------------------------------------------------------- */

function ReceiptsPanel({
  receipts,
}: {
  receipts: import("@/lib/dashboard/store").StoreReceipt[];
}) {
  return (
    <Card className="p-8 md:p-10">
      <div className="flex items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
            Receipts
          </h2>
          <p className="text-ink-muted mt-2 text-sm md:text-base">
            Settled orders. Funds have already landed in your store account.
          </p>
        </div>
        <span className="hidden md:inline-flex items-center bg-surface shadow-neu-inset-sm rounded-full px-3 py-1.5 text-xs font-medium text-ink-muted">
          {receipts.length} settled
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {receipts.map((r) => (
          <ReceiptCard key={r.order.id} receipt={r} />
        ))}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------- */
/* Order queue                                                           */
/* -------------------------------------------------------------------- */

function OrderQueue({
  orders,
}: {
  orders: Array<{
    id: string;
    family_name: string;
    status: import("@/components/ui/StatusPill").WishlistStatus;
    total_stroops: bigint;
    notes: string | null;
    escrow_tx_hash: string | null;
    item_count: number;
    updated_at: string;
  }>;
}) {
  return (
    <Card className="p-8 md:p-10">
      <div className="flex items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
            Order queue
          </h2>
          <p className="text-ink-muted mt-2 text-sm md:text-base">
            Pending approvals first, then locked orders awaiting delivery.
          </p>
        </div>
        <span className="hidden md:inline-flex items-center bg-surface shadow-neu-inset-sm rounded-full px-3 py-1.5 text-xs font-medium text-ink-muted">
          {orders.length} order{orders.length === 1 ? "" : "s"}
        </span>
      </div>

      {orders.length === 0 ? (
        <p className="text-ink-muted text-sm">No incoming orders right now.</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {orders.map((o) => (
            <li key={o.id}>
              <div className="flex items-start gap-5 p-5 rounded-2xl bg-surface shadow-neu-inset-sm">
                <IconWell size="sm" tone="default" depth="shallow">
                  <PackageIcon className="h-5 w-5" />
                </IconWell>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <StatusPill status={o.status} />
                    <span className="text-xs text-ink-muted">
                      Updated {timeAgo(o.updated_at)}
                    </span>
                  </div>
                  <p className="text-ink font-medium truncate">
                    <span className="text-ink-muted">From</span> {o.family_name}
                    {o.notes ? <span className="text-ink-muted"> · {o.notes}</span> : null}
                  </p>
                  <p className="text-ink-muted text-sm mt-1">
                    <span className="text-ink font-medium tabular-nums">
                      {formatXlmWithUnit(o.total_stroops)}
                    </span>
                    <span className="mx-2">·</span>
                    {o.item_count} item{o.item_count === 1 ? "" : "s"}
                    {o.escrow_tx_hash ? (
                      <>
                        <span className="mx-2">·</span>
                        <span className="font-mono">{truncateHash(o.escrow_tx_hash)}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                {/* Trailing slot:
                      locked    → Mark-as-delivered CTA
                      delivered → "Waiting for confirmation" pill
                      else      → Stellar Expert link (if there's a tx hash) */}
                {o.status === "locked" ? (
                  <MarkDeliveredButton wishlistId={o.id} />
                ) : o.status === "delivered" ? (
                  <span className="shrink-0 inline-flex items-center gap-2 bg-surface shadow-neu-inset-sm rounded-full px-3 py-1.5 text-xs font-medium text-ink-muted">
                    <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                    Waiting for confirmation
                  </span>
                ) : o.escrow_tx_hash ? (
                  <a
                    href={`${STELLAR_EXPLORER_BASE}/tx/${o.escrow_tx_hash}`}
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
/* Inventory                                                             */
/* -------------------------------------------------------------------- */

function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function InventoryPanel({
  inventory,
  outOfStockCount,
}: {
  inventory: Array<{
    id: string;
    name: string;
    category: string;
    price_stroops: bigint;
    stock: number;
    unit: string | null;
  }>;
  outOfStockCount: number;
}) {
  if (inventory.length === 0) return null;

  // Group by category so the UI mirrors the way Nena's shelves are laid
  // out — categories as soft section headers.
  const byCategory = new Map<string, typeof inventory>();
  for (const item of inventory) {
    const arr = byCategory.get(item.category);
    if (arr) arr.push(item);
    else byCategory.set(item.category, [item]);
  }

  return (
    <Card className="p-8 md:p-10">
      <div className="flex items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">
            Inventory
          </h2>
          <p className="text-ink-muted mt-2 text-sm md:text-base">
            What&apos;s on the shelves right now.
          </p>
        </div>
        {outOfStockCount > 0 ? (
          <span className="inline-flex items-center bg-surface shadow-neu-inset-sm rounded-full px-3 py-1.5 text-xs font-medium text-red-500">
            {outOfStockCount} out of stock
          </span>
        ) : null}
      </div>

      <div className="space-y-10">
        {Array.from(byCategory.entries()).map(([category, items]) => (
          <div key={category}>
            <p className="text-xs uppercase tracking-[0.18em] text-ink-muted font-medium mb-4">
              {categoryLabel(category)}
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <InventoryItemCard
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  priceStroops={item.price_stroops.toString()}
                  stock={item.stock}
                  unit={item.unit}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------- */
/* Activity feed (same component shape as the other dashboards)          */
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

/* -------------------------------------------------------------------- */
/* Empty state                                                           */
/* -------------------------------------------------------------------- */

function EmptyState() {
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
        Once families start submitting wishlists for items in your store, they
        will appear here for approval, delivery tracking, and final release.
      </p>
      <p className="mt-6 text-xs text-ink-muted">
        Add inventory via <code className="font-mono">db/seed.sql</code> or
        run <code className="font-mono">db/seed-ofw-demo.sql</code> to populate
        a demo order queue.
      </p>
    </Card>
  );
}
