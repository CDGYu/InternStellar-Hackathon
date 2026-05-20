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
  /** Set when the OFW has a Stellar testnet keypair on file — used to
   *  deep-link the Transaction History panel to Stellar Expert. */
  stellar_public_key: string | null;
}

export interface FamilyProfile {
  id: string;
  display_name: string;
  country: string | null;
}

export interface WishlistLine {
  /** wishlist_item.id — needed for the OFW editor's remove action. */
  id: string;
  /** inventory.id — needed for the OFW editor's add action. */
  inventory_id: string;
  inventory_name: string;
  inventory_unit: string | null;
  quantity: number;
  price_stroops_at_add: bigint;
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
  /** Inlined line items (joined with inventory) — populated only for
   *  active wishlists so the OFW dashboard's "Edit wishlist" expand
   *  panel can render without a second fetch per row. */
  items: WishlistLine[];
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
  /** Inlined from the parent wishlist so the TX history doesn't need a
   *  second lookup per row. Null if the wishlist was deleted (FK is
   *  ON DELETE CASCADE on items, but settlement is intentionally not
   *  cascaded — past audit rows should outlive a soft-deleted wishlist). */
  wishlist_notes: string | null;
  wishlist_status: WishlistStatus | null;
}

/** Store inventory item — mirrors the family loader's InventoryItem shape. */
export interface InventoryItem {
  id: string;
  store_id: string;
  name: string;
  category: string;
  price_stroops: bigint;
  stock: number;
  unit: string | null;
}

/** Biller (Meralco, Maynilad, …) — inlined onto each bill below. */
export interface BillerRef {
  id: string;
  name: string;
  category: string;
  stellar_address: string | null;
}

export type BillStatus = "due" | "paid" | "overdue";

export interface BillRow {
  id: string;
  biller: BillerRef;
  account_number: string;
  amount_stroops: bigint;
  /** ISO date (YYYY-MM-DD). */
  due_date: string;
  /** As stored in DB. The UI also computes `is_overdue` from due_date. */
  status: BillStatus;
  autopay_enabled: boolean;
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
  /** Store's full inventory — feeds the OFW's "Edit wishlist" editor. */
  inventory: InventoryItem[];
  /** Household bills (Meralco, Maynilad, …) — feeds the Bills panel. */
  bills: BillRow[];
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

  // ---- 1. Profiles + inventory + bills (parallel) ---------------------
  // Profiles: OFW + linked family in one query. Returns 1-2 rows
  // depending on whether the demo data has been seeded; we partition
  // by role below.
  // Inventory: full store catalogue, used by the OFW's wishlist editor.
  // Bills: the family's household bills + each bill's biller info.
  const [profilesResult, inventoryResult, billsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, display_name, country, stellar_public_key")
      .in("id", [opts.ofwId, opts.familyId]),
    supabase
      .from("inventory")
      .select("id, store_id, name, category, price_stroops, stock, unit")
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("bill")
      .select(
        "id, account_number, amount_stroops, due_date, status, autopay_enabled, biller:biller_id (id, name, category, stellar_address)",
      )
      .eq("family_id", opts.familyId)
      .order("due_date", { ascending: true }),
  ]);

  const { data: profiles, error: pErr } = profilesResult;
  if (inventoryResult.error) {
    throw new Error(`inventory load failed: ${inventoryResult.error.message}`);
  }
  // Bills are additive — if the table doesn't exist yet (db/bills.sql
  // not applied), surface a clear error rather than 500'ing on every
  // OFW page load.
  if (billsResult.error) {
    const m = billsResult.error.message;
    if (m.includes("relation") && m.includes("does not exist")) {
      throw new Error(
        "bills tables not found — run db/bills.sql then `npm run setup-billers`.",
      );
    }
    throw new Error(`bills load failed: ${m}`);
  }

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
    items: [], // populated below from the same query that builds `items`
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
    // ---- 3. Items joined to inventory ---------------------------------
    // We pull `category` (for the allocation breakdown panel), `name`/
    // `unit` (for the OFW dashboard's expandable editor), AND the row's
    // own `id` + `inventory_id` (used by the editor's add/remove
    // actions) in the same join so we only round-trip once.
    const { data: itemRows, error: iErr } = await supabase
      .from("wishlist_item")
      .select(
        "id, wishlist_id, inventory_id, quantity, price_stroops_at_add, inventory:inventory_id (category, name, unit)",
      )
      .in("wishlist_id", wishlistIds);

    if (iErr) throw new Error(`wishlist_item load failed: ${iErr.message}`);

    items = (itemRows ?? []).map((row) => {
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

    // Build the per-wishlist line-item map so the expand panel can render
    // without re-fetching. Same source as `items` above.
    const linesByWishlist = new Map<string, WishlistLine[]>();
    for (const row of itemRows ?? []) {
      const inv = Array.isArray((row as any).inventory)
        ? (row as any).inventory[0]
        : (row as any).inventory;
      const wid = row.wishlist_id as string;
      const line: WishlistLine = {
        id: row.id as string,
        inventory_id: row.inventory_id as string,
        inventory_name: (inv?.name as string) ?? "Unknown item",
        inventory_unit: (inv?.unit as string | null) ?? null,
        quantity: Number(row.quantity),
        price_stroops_at_add: toBig(row.price_stroops_at_add),
      };
      const arr = linesByWishlist.get(wid);
      if (arr) arr.push(line);
      else linesByWishlist.set(wid, [line]);
    }
    for (const w of wishlists) {
      w.items = linesByWishlist.get(w.id) ?? [];
    }

    // ---- 4. Settlement audit rows + wishlist context ----------------
    // Inline the wishlist's notes + status so the TransactionHistory
    // panel can show "Released — Lola's pantry restock" without a
    // second per-row lookup.
    const { data: setRows, error: sErr } = await supabase
      .from("settlement")
      .select(
        "id, wishlist_id, event_type, tx_hash, amount_stroops, created_at, wishlist:wishlist_id (notes, status)",
      )
      .in("wishlist_id", wishlistIds)
      .order("created_at", { ascending: false });

    if (sErr) throw new Error(`settlement load failed: ${sErr.message}`);

    settlements = (setRows ?? []).map((s) => {
      const w = Array.isArray((s as any).wishlist)
        ? (s as any).wishlist[0]
        : (s as any).wishlist;
      return {
        id: s.id as string,
        wishlist_id: s.wishlist_id as string,
        event_type: s.event_type as SettlementEvent,
        tx_hash: s.tx_hash as string,
        amount_stroops: toBig(s.amount_stroops),
        created_at: s.created_at as string,
        wishlist_notes: (w?.notes as string | null) ?? null,
        wishlist_status: (w?.status as WishlistStatus | null) ?? null,
      };
    });
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
      stellar_public_key:
        (ofwRow.stellar_public_key as string | null) ?? null,
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
    // Bumped to 25 so the Transaction History statement view has more
    // to render. The legacy sidebar ActivityFeed only renders what it's
    // given, so this is also safe for any other consumer.
    activity: settlements.slice(0, 25),
    inventory: (inventoryResult.data ?? []).map((row) => ({
      id: row.id as string,
      store_id: row.store_id as string,
      name: row.name as string,
      category: row.category as string,
      price_stroops: toBig(row.price_stroops),
      stock: Number(row.stock ?? 0),
      unit: (row.unit as string | null) ?? null,
    })),
    bills: (billsResult.data ?? []).map((row) => {
      // Supabase joined relations: object | array — normalize.
      const b = Array.isArray((row as any).biller)
        ? (row as any).biller[0]
        : (row as any).biller;
      return {
        id: row.id as string,
        biller: {
          id: (b?.id as string) ?? "",
          name: (b?.name as string) ?? "Unknown biller",
          category: (b?.category as string) ?? "unknown",
          stellar_address: (b?.stellar_address as string | null) ?? null,
        },
        account_number: row.account_number as string,
        amount_stroops: toBig(row.amount_stroops),
        due_date: row.due_date as string,
        status: row.status as BillStatus,
        autopay_enabled: Boolean(row.autopay_enabled),
      };
    }),
  };
}
