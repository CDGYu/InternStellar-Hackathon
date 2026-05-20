import type { WishlistStatus, SettlementEvent } from "@/components/ui/StatusPill";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Server-side data loader for the OFW dashboard.
 *
 * Reads everything in three queries (wishlists, items + inventory join,
 * settlements) and aggregates in TypeScript. That's deliberate — the
 * dashboard's panels all share the same row set, so doing one round of
 * fetches and partitioning beats N parallel queries with overlapping
 * column lists.
 *
 * Money math is in bigint. Bigint columns arrive from Supabase as strings;
 * see the same pattern in app/api/escrow/lock/route.ts.
 */

export interface OfwProfile {
  id: string;
  display_name: string;
  country: string | null;
}

export interface FamilyProfile {
  id: string;
  display_name: string;
  country: string | null;
}

export interface WishlistRow {
  id: string;
  status: WishlistStatus;
  total_stroops: bigint;
  notes: string | null;
  escrow_tx_hash: string | null;
  release_tx_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface AllocationSlice {
  category: string;
  stroops: bigint;
  /** 0..1 — fraction of the *total across categories*, not per wishlist. */
  share: number;
}

export interface SettlementRow {
  id: string;
  wishlist_id: string;
  event_type: SettlementEvent;
  tx_hash: string;
  amount_stroops: bigint;
  created_at: string;
}

export interface OfwDashboardData {
  ofw: OfwProfile;
  family: FamilyProfile | null;
  totals: {
    funded: bigint;     // sum of deposit events
    inEscrow: bigint;   // sum of lock − sum of release
    released: bigint;   // sum of release events
  };
  allocation: AllocationSlice[];
  activeWishlists: WishlistRow[];
  releasedCount: number;
  activity: SettlementRow[];
}

function toBig(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string") return BigInt(value);
  return 0n;
}

export async function loadOfwDashboard(opts: {
  ofwId: string;
  familyId: string;
}): Promise<OfwDashboardData> {
  const supabase = getSupabaseAdmin();

  // ---- 1. Profiles (OFW + linked family) -----------------------------
  // One query, two ids in. Returns 1-2 rows depending on whether the
  // demo data has been seeded; we partition by role below.
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, role, display_name, country")
    .in("id", [opts.ofwId, opts.familyId]);

  if (pErr) throw new Error(`profiles load failed: ${pErr.message}`);

  const ofwRow = profiles?.find((p) => p.id === opts.ofwId);
  if (!ofwRow) {
    throw new Error(
      `OFW profile not found: ${opts.ofwId}. Did you run db/seed.sql?`,
    );
  }
  const familyRow = profiles?.find((p) => p.id === opts.familyId) ?? null;

  // ---- 2. Wishlists for this family ----------------------------------
  const { data: wishlistRowsRaw, error: wErr } = await supabase
    .from("wishlist")
    .select(
      "id, status, total_stroops, notes, escrow_tx_hash, release_tx_hash, created_at, updated_at",
    )
    .eq("family_id", opts.familyId)
    .order("updated_at", { ascending: false });

  if (wErr) throw new Error(`wishlist load failed: ${wErr.message}`);

  const wishlists: WishlistRow[] = (wishlistRowsRaw ?? []).map((w) => ({
    id: w.id as string,
    status: w.status as WishlistStatus,
    total_stroops: toBig(w.total_stroops),
    notes: (w.notes as string | null) ?? null,
    escrow_tx_hash: (w.escrow_tx_hash as string | null) ?? null,
    release_tx_hash: (w.release_tx_hash as string | null) ?? null,
    created_at: w.created_at as string,
    updated_at: w.updated_at as string,
  }));

  const wishlistIds = wishlists.map((w) => w.id);

  // Skip the dependent queries entirely if there are no wishlists — keeps
  // the empty-state path snappy.
  let items: Array<{
    wishlist_id: string;
    quantity: number;
    price_stroops_at_add: bigint;
    category: string;
  }> = [];
  let settlements: SettlementRow[] = [];

  if (wishlistIds.length > 0) {
    // ---- 3. Items joined to inventory (for `category`) ---------------
    const { data: itemRows, error: iErr } = await supabase
      .from("wishlist_item")
      .select("wishlist_id, quantity, price_stroops_at_add, inventory:inventory_id (category)")
      .in("wishlist_id", wishlistIds);

    if (iErr) throw new Error(`wishlist_item load failed: ${iErr.message}`);

    items = (itemRows ?? []).map((row) => {
      // Supabase typings make joined relations either an object or an array
      // depending on the schema relationship; normalize.
      const inv = Array.isArray((row as any).inventory)
        ? (row as any).inventory[0]
        : (row as any).inventory;
      return {
        wishlist_id: row.wishlist_id as string,
        quantity: Number(row.quantity),
        price_stroops_at_add: toBig(row.price_stroops_at_add),
        category: (inv?.category as string) ?? "uncategorized",
      };
    });

    // ---- 4. Settlement audit rows -----------------------------------
    const { data: setRows, error: sErr } = await supabase
      .from("settlement")
      .select("id, wishlist_id, event_type, tx_hash, amount_stroops, created_at")
      .in("wishlist_id", wishlistIds)
      .order("created_at", { ascending: false });

    if (sErr) throw new Error(`settlement load failed: ${sErr.message}`);

    settlements = (setRows ?? []).map((s) => ({
      id: s.id as string,
      wishlist_id: s.wishlist_id as string,
      event_type: s.event_type as SettlementEvent,
      tx_hash: s.tx_hash as string,
      amount_stroops: toBig(s.amount_stroops),
      created_at: s.created_at as string,
    }));
  }

  // ---- 5. Totals (settlement-driven, not wishlist.total_stroops) -----
  // We trust the settlement audit trail over wishlist.total_stroops because
  // settlement rows are append-only and reflect on-chain truth.
  let funded = 0n;
  let locked = 0n;
  let released = 0n;
  for (const s of settlements) {
    if (s.event_type === "deposit") funded += s.amount_stroops;
    else if (s.event_type === "lock") locked += s.amount_stroops;
    else if (s.event_type === "release") released += s.amount_stroops;
  }
  const inEscrow = locked - released; // unreleased portion of locked funds

  // ---- 6. Allocation by inventory.category ---------------------------
  // Computed across ALL wishlists (released + in-flight) so the OFW sees a
  // true picture of where their money has gone categorically, not just
  // what's currently in escrow.
  const byCategory = new Map<string, bigint>();
  for (const it of items) {
    const line = it.price_stroops_at_add * BigInt(it.quantity);
    byCategory.set(it.category, (byCategory.get(it.category) ?? 0n) + line);
  }
  const allocationTotal = Array.from(byCategory.values()).reduce<bigint>(
    (sum, n) => sum + n,
    0n,
  );
  const allocation: AllocationSlice[] = Array.from(byCategory.entries())
    .map(([category, stroops]) => ({
      category,
      stroops,
      share:
        allocationTotal === 0n
          ? 0
          : Number((stroops * 10000n) / allocationTotal) / 10000,
    }))
    .sort((a, b) => (a.stroops > b.stroops ? -1 : a.stroops < b.stroops ? 1 : 0));

  // ---- 7. Active vs released split + activity feed -------------------
  const activeStatuses: WishlistStatus[] = [
    "draft",
    "pending_approval",
    "locked",
    "delivered",
  ];
  const activeWishlists = wishlists.filter((w) =>
    activeStatuses.includes(w.status),
  );
  const releasedCount = wishlists.filter((w) => w.status === "released").length;

  return {
    ofw: {
      id: ofwRow.id as string,
      display_name: (ofwRow.display_name as string) ?? "OFW",
      country: (ofwRow.country as string | null) ?? null,
    },
    family: familyRow
      ? {
          id: familyRow.id as string,
          display_name: (familyRow.display_name as string) ?? "Family",
          country: (familyRow.country as string | null) ?? null,
        }
      : null,
    totals: { funded, inEscrow, released },
    allocation,
    activeWishlists,
    releasedCount,
    activity: settlements.slice(0, 10),
  };
}
