import type { WishlistStatus, SettlementEvent } from "@/components/ui/StatusPill";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Server-side data loader for the Family dashboard.
 *
 * Family-scoped: every wishlist row is filtered by `family_id = familyId`.
 * Now also returns:
 *   - the full inventory grid (for the WishlistBuilder Add buttons)
 *   - the family's "active draft" wishlist (status = draft|pending_approval)
 *     with its line items, so the cart UI has everything it needs in one
 *     server round-trip.
 *
 * We trust the audit trail (`settlement`) over `wishlist.total_stroops`
 * for money totals, same as the OFW dashboard.
 *
 * Money math is in bigint. Bigint columns arrive from Supabase as strings;
 * see the same pattern in app/api/escrow/lock/route.ts.
 */

export interface FamilyProfile {
  id: string;
  display_name: string;
  country: string | null;
}

export interface FamilyWishlistRow {
  id: string;
  status: WishlistStatus;
  total_stroops: bigint;
  notes: string | null;
  escrow_tx_hash: string | null;
  release_tx_hash: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface FamilySettlementRow {
  id: string;
  wishlist_id: string;
  event_type: SettlementEvent;
  tx_hash: string;
  amount_stroops: bigint;
  created_at: string;
  /** Inlined from the parent wishlist so MobileActivity can label
   *  rows without a second lookup. Null when the wishlist row is
   *  gone (settlement is intentionally not cascaded — same as OFW). */
  wishlist_notes: string | null;
  wishlist_status: WishlistStatus | null;
}

export interface InventoryItem {
  id: string;
  store_id: string;
  name: string;
  category: string;
  price_stroops: bigint;
  stock: number;
  unit: string | null;
}

export interface WishlistLineItem {
  id: string;
  wishlist_id: string;
  inventory_id: string;
  /** Snapshot — what the family sees in the cart even if inventory.name later changes. */
  inventory_name: string;
  inventory_unit: string | null;
  quantity: number;
  price_stroops_at_add: bigint;
}

/** Biller row used by the "Add a bill" picker. Mirrors lib/dashboard/ofw.ts. */
export interface BillerOption {
  id: string;
  name: string;
  category: string;
  stellar_address: string | null;
}

export type BillStatus = "due" | "paid" | "overdue";

export interface FamilyBillRow {
  id: string;
  biller: BillerOption;
  account_number: string;
  amount_stroops: bigint;
  /** ISO YYYY-MM-DD. */
  due_date: string;
  status: BillStatus;
  autopay_enabled: boolean;
}

export interface ActiveDraft {
  wishlist: FamilyWishlistRow;
  items: WishlistLineItem[];
  /** Sum of qty × price across line items. Recomputed at read time so the
   *  cart stays accurate even if a write didn't update wishlist.total_stroops. */
  total_stroops: bigint;
}

export interface FamilyDashboardData {
  family: FamilyProfile;
  totals: {
    /** Sum of `lock` minus `release` events — currently locked on the family's behalf. */
    inEscrow: bigint;
    /** Sum of `release` events — money that's flowed to the store for delivered orders. */
    receivedValue: bigint;
    /** Count of wishlists not yet released or cancelled. */
    activeCount: number;
  };
  /** All non-cancelled wishlists newest-first. The view groups them. */
  wishlists: FamilyWishlistRow[];
  /** Most recent wishlist with status draft|pending_approval, or null. */
  activeDraft: ActiveDraft | null;
  /** Store's full inventory — feeds the WishlistBuilder grid. */
  inventory: InventoryItem[];
  activity: FamilySettlementRow[];
  /** Curated billers (Meralco, Maynilad, …) — feeds the "Add a bill" picker. */
  billers: BillerOption[];
  /** This family's bills — read-only list under the Add form. */
  bills: FamilyBillRow[];
}

function toBig(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string") return BigInt(value);
  return 0n;
}

export async function loadFamilyDashboard(opts: {
  familyId: string;
}): Promise<FamilyDashboardData> {
  const supabase = getSupabaseAdmin();

  // ---- 1. Family profile + wishlists + inventory + billers + bills (parallel) ---------
  const [profileResult, wishlistResult, inventoryResult, billersResult, billsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, country")
        .eq("id", opts.familyId)
        .maybeSingle(),
      supabase
        .from("wishlist")
        .select(
          "id, status, total_stroops, notes, escrow_tx_hash, release_tx_hash, created_at, updated_at",
        )
        .eq("family_id", opts.familyId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("inventory")
        .select("id, store_id, name, category, price_stroops, stock, unit")
        .order("category", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("biller")
        .select("id, name, category, stellar_address")
        .order("name", { ascending: true }),
      supabase
        .from("bill")
        .select(
          "id, account_number, amount_stroops, due_date, status, autopay_enabled, biller:biller_id (id, name, category, stellar_address)",
        )
        .eq("family_id", opts.familyId)
        .order("due_date", { ascending: true }),
    ]);

  if (profileResult.error) throw new Error(`family profile load failed: ${profileResult.error.message}`);
  if (wishlistResult.error) throw new Error(`wishlist load failed: ${wishlistResult.error.message}`);
  if (inventoryResult.error) throw new Error(`inventory load failed: ${inventoryResult.error.message}`);
  // Bills tables are additive — surface a clear setup hint if they're not
  // applied yet. Don't break the rest of the dashboard.
  let billers: BillerOption[] = [];
  let bills: FamilyBillRow[] = [];
  const billsTablesMissing = (msg: string | undefined): boolean =>
    !!msg && msg.includes("relation") && msg.includes("does not exist");
  if (billersResult.error && !billsTablesMissing(billersResult.error.message)) {
    throw new Error(`biller load failed: ${billersResult.error.message}`);
  }
  if (billsResult.error && !billsTablesMissing(billsResult.error.message)) {
    throw new Error(`bills load failed: ${billsResult.error.message}`);
  }
  if (!billersResult.error) {
    billers = (billersResult.data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      category: row.category as string,
      stellar_address: (row.stellar_address as string | null) ?? null,
    }));
  }
  if (!billsResult.error) {
    bills = (billsResult.data ?? []).map((row) => {
      const b = Array.isArray((row as any).biller)
        ? (row as any).biller[0]
        : (row as any).biller;
      return {
        id: row.id as string,
        biller: {
          id: (b?.id as string) ?? "",
          name: (b?.name as string) ?? "Unknown biller",
          category: (b?.category as string) ?? "",
          stellar_address: (b?.stellar_address as string | null) ?? null,
        },
        account_number: row.account_number as string,
        amount_stroops: toBig(row.amount_stroops),
        due_date: row.due_date as string,
        status: row.status as BillStatus,
        autopay_enabled: Boolean(row.autopay_enabled),
      };
    });
  }

  const family = profileResult.data;
  if (!family) {
    throw new Error(
      `Family profile not found: ${opts.familyId}. Did you run db/seed.sql?`,
    );
  }

  const wishlistRows = wishlistResult.data ?? [];
  const wishlistIds = wishlistRows.map((w) => w.id as string);

  // ---- 2. Item counts + settlements + draft items (parallel) --------
  let itemCounts = new Map<string, number>();
  let settlements: FamilySettlementRow[] = [];

  // Find the active draft *now* so we can fetch its items in the same
  // parallel batch as the other dependent reads.
  const draftRow = wishlistRows.find(
    (w) => w.status === "draft" || w.status === "pending_approval",
  );

  if (wishlistIds.length > 0) {
    const [itemsResult, settlementsResult] = await Promise.all([
      supabase
        .from("wishlist_item")
        .select("wishlist_id")
        .in("wishlist_id", wishlistIds),
      supabase
        .from("settlement")
        .select(
          "id, wishlist_id, event_type, tx_hash, amount_stroops, created_at, " +
            "wishlist:wishlist_id (notes, status)",
        )
        .in("wishlist_id", wishlistIds)
        .order("created_at", { ascending: false }),
    ]);

    if (itemsResult.error) {
      throw new Error(`wishlist_item count load failed: ${itemsResult.error.message}`);
    }
    if (settlementsResult.error) {
      throw new Error(`settlement load failed: ${settlementsResult.error.message}`);
    }

    for (const row of itemsResult.data ?? []) {
      const id = row.wishlist_id as string;
      itemCounts.set(id, (itemCounts.get(id) ?? 0) + 1);
    }

    settlements = (settlementsResult.data ?? []).map((row) => {
      // Supabase's TS inference for nested-join selects degrades to
      // GenericStringError under Next 15's stricter build-time checks.
      // Cast to any once and use defensively. Also coerces the
      // wishlist join which can be either an object or an array
      // depending on FK shape (same pattern as ofw loader).
      const s = row as any;
      const wishlist = Array.isArray(s.wishlist) ? s.wishlist[0] : s.wishlist;
      return {
        id: s.id as string,
        wishlist_id: s.wishlist_id as string,
        event_type: s.event_type as SettlementEvent,
        tx_hash: s.tx_hash as string,
        amount_stroops: toBig(s.amount_stroops),
        created_at: s.created_at as string,
        wishlist_notes: (wishlist?.notes as string | null) ?? null,
        wishlist_status: (wishlist?.status as WishlistStatus | null) ?? null,
      };
    });
  }

  // ---- 3. Active draft's line items (joined with inventory) ---------
  let activeDraft: ActiveDraft | null = null;
  if (draftRow) {
    const { data: lineItemRows, error: liErr } = await supabase
      .from("wishlist_item")
      .select("id, wishlist_id, inventory_id, quantity, price_stroops_at_add, inventory:inventory_id (name, unit)")
      .eq("wishlist_id", draftRow.id as string);

    if (liErr) throw new Error(`draft items load failed: ${liErr.message}`);

    const items: WishlistLineItem[] = (lineItemRows ?? []).map((row) => {
      const inv = Array.isArray((row as any).inventory)
        ? (row as any).inventory[0]
        : (row as any).inventory;
      return {
        id: row.id as string,
        wishlist_id: row.wishlist_id as string,
        inventory_id: row.inventory_id as string,
        inventory_name: (inv?.name as string) ?? "Unknown item",
        inventory_unit: (inv?.unit as string | null) ?? null,
        quantity: Number(row.quantity),
        price_stroops_at_add: toBig(row.price_stroops_at_add),
      };
    });

    // Recompute total from line items so the cart subtotal stays honest
    // even if the wishlist.total_stroops column hasn't been resynced.
    const total = items.reduce<bigint>(
      (sum, it) => sum + it.price_stroops_at_add * BigInt(it.quantity),
      0n,
    );

    activeDraft = {
      wishlist: {
        id: draftRow.id as string,
        status: draftRow.status as WishlistStatus,
        total_stroops: total,
        notes: (draftRow.notes as string | null) ?? null,
        escrow_tx_hash: (draftRow.escrow_tx_hash as string | null) ?? null,
        release_tx_hash: (draftRow.release_tx_hash as string | null) ?? null,
        item_count: items.length,
        created_at: draftRow.created_at as string,
        updated_at: draftRow.updated_at as string,
      },
      items,
      total_stroops: total,
    };
  }

  const wishlists: FamilyWishlistRow[] = wishlistRows
    .map((w) => ({
      id: w.id as string,
      status: w.status as WishlistStatus,
      total_stroops: toBig(w.total_stroops),
      notes: (w.notes as string | null) ?? null,
      escrow_tx_hash: (w.escrow_tx_hash as string | null) ?? null,
      release_tx_hash: (w.release_tx_hash as string | null) ?? null,
      item_count: itemCounts.get(w.id as string) ?? 0,
      created_at: w.created_at as string,
      updated_at: w.updated_at as string,
    }))
    .filter((w) => w.status !== "cancelled");

  // ---- 4. Totals -----------------------------------------------------
  let locked = 0n;
  let released = 0n;
  for (const s of settlements) {
    if (s.event_type === "lock") locked += s.amount_stroops;
    else if (s.event_type === "release") released += s.amount_stroops;
  }
  const inEscrow = locked - released;
  const activeCount = wishlists.filter((w) => w.status !== "released").length;

  const inventory: InventoryItem[] = (inventoryResult.data ?? []).map((row) => ({
    id: row.id as string,
    store_id: row.store_id as string,
    name: row.name as string,
    category: row.category as string,
    price_stroops: toBig(row.price_stroops),
    stock: Number(row.stock ?? 0),
    unit: (row.unit as string | null) ?? null,
  }));

  return {
    family: {
      id: family.id as string,
      display_name: (family.display_name as string) ?? "Family",
      country: (family.country as string | null) ?? null,
    },
    totals: {
      inEscrow,
      receivedValue: released,
      activeCount,
    },
    wishlists,
    activeDraft,
    inventory,
    activity: settlements.slice(0, 10),
    billers,
    bills,
  };
}
