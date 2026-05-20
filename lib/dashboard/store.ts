import type { WishlistStatus, SettlementEvent } from "@/components/ui/StatusPill";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Server-side data loader for the Store dashboard.
 *
 * The store is the "many sides" of the data: it sees wishlists from every
 * family, settlements across all of them, and its own inventory. We pull
 * the inventory in the same round-trip so the dashboard can show stock
 * levels and category mix without a follow-up fetch.
 *
 * Money math is in bigint. Bigint columns arrive from Supabase as strings;
 * see the same pattern in app/api/escrow/lock/route.ts.
 */

export interface StoreProfile {
  id: string;
  display_name: string;
  country: string | null;
}

export interface StoreOrderRow {
  id: string;
  family_id: string;
  family_name: string;
  status: WishlistStatus;
  total_stroops: bigint;
  notes: string | null;
  escrow_tx_hash: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface StoreInventoryRow {
  id: string;
  name: string;
  category: string;
  price_stroops: bigint;
  stock: number;
  unit: string | null;
}

export interface StoreSettlementRow {
  id: string;
  wishlist_id: string;
  event_type: SettlementEvent;
  tx_hash: string;
  amount_stroops: bigint;
  created_at: string;
}

export interface StoreDashboardData {
  store: StoreProfile;
  totals: {
    /** Count of wishlists at status='pending_approval'. */
    pendingCount: number;
    /** Sum of lock − release across the store's order book. */
    inEscrow: bigint;
    /** Sum of release events — money received for delivered orders. */
    revenue: bigint;
    /** Inventory items at zero stock. Surfaces a "restock soon" signal. */
    outOfStockCount: number;
  };
  orders: StoreOrderRow[];
  inventory: StoreInventoryRow[];
  activity: StoreSettlementRow[];
}

function toBig(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string") return BigInt(value);
  return 0n;
}

export async function loadStoreDashboard(opts: {
  storeId: string;
}): Promise<StoreDashboardData> {
  const supabase = getSupabaseAdmin();

  // ---- 1. Store profile ---------------------------------------------
  const { data: store, error: pErr } = await supabase
    .from("profiles")
    .select("id, display_name, country")
    .eq("id", opts.storeId)
    .maybeSingle();

  if (pErr) throw new Error(`store profile load failed: ${pErr.message}`);
  if (!store) {
    throw new Error(
      `Store profile not found: ${opts.storeId}. Did you run db/seed.sql?`,
    );
  }

  // ---- 2. Orders + inventory (parallel) -----------------------------
  // Wishlists are scoped to "those whose items reference this store's
  // inventory." Schema-wise wishlists don't carry a store_id, so we
  // discover the link through wishlist_item → inventory.store_id. The
  // single-store demo means every wishlist belongs to this store, but
  // we filter anyway so this keeps working when a second store is added.
  const [inventoryResult, orderItemsResult] = await Promise.all([
    supabase
      .from("inventory")
      .select("id, name, category, price_stroops, stock, unit")
      .eq("store_id", opts.storeId)
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("wishlist_item")
      .select("wishlist_id, inventory:inventory_id (store_id)")
      .order("wishlist_id"),
  ]);

  if (inventoryResult.error) {
    throw new Error(`inventory load failed: ${inventoryResult.error.message}`);
  }
  if (orderItemsResult.error) {
    throw new Error(
      `wishlist_item join failed: ${orderItemsResult.error.message}`,
    );
  }

  // Build the set of wishlist ids that touch this store, plus per-wishlist
  // item counts.
  const storeWishlistIds = new Set<string>();
  const itemCounts = new Map<string, number>();
  for (const row of orderItemsResult.data ?? []) {
    const inv = Array.isArray((row as any).inventory)
      ? (row as any).inventory[0]
      : (row as any).inventory;
    if (inv?.store_id === opts.storeId) {
      const wid = row.wishlist_id as string;
      storeWishlistIds.add(wid);
      itemCounts.set(wid, (itemCounts.get(wid) ?? 0) + 1);
    }
  }

  // ---- 3. Wishlists + family names + settlements (parallel) ---------
  let orders: StoreOrderRow[] = [];
  let settlements: StoreSettlementRow[] = [];

  if (storeWishlistIds.size > 0) {
    const ids = Array.from(storeWishlistIds);

    const [wishlistResult, settlementsResult] = await Promise.all([
      supabase
        .from("wishlist")
        .select(
          "id, family_id, status, total_stroops, notes, escrow_tx_hash, created_at, updated_at, family:family_id (display_name)",
        )
        .in("id", ids)
        .neq("status", "cancelled"),
      supabase
        .from("settlement")
        .select(
          "id, wishlist_id, event_type, tx_hash, amount_stroops, created_at",
        )
        .in("wishlist_id", ids)
        .order("created_at", { ascending: false }),
    ]);

    if (wishlistResult.error) {
      throw new Error(`wishlist load failed: ${wishlistResult.error.message}`);
    }
    if (settlementsResult.error) {
      throw new Error(
        `settlement load failed: ${settlementsResult.error.message}`,
      );
    }

    orders = (wishlistResult.data ?? []).map((w) => {
      const fam = Array.isArray((w as any).family)
        ? (w as any).family[0]
        : (w as any).family;
      return {
        id: w.id as string,
        family_id: w.family_id as string,
        family_name: (fam?.display_name as string) ?? "Family",
        status: w.status as WishlistStatus,
        total_stroops: toBig(w.total_stroops),
        notes: (w.notes as string | null) ?? null,
        escrow_tx_hash: (w.escrow_tx_hash as string | null) ?? null,
        item_count: itemCounts.get(w.id as string) ?? 0,
        created_at: w.created_at as string,
        updated_at: w.updated_at as string,
      };
    });

    settlements = (settlementsResult.data ?? []).map((s) => ({
      id: s.id as string,
      wishlist_id: s.wishlist_id as string,
      event_type: s.event_type as SettlementEvent,
      tx_hash: s.tx_hash as string,
      amount_stroops: toBig(s.amount_stroops),
      created_at: s.created_at as string,
    }));
  }

  // Sort orders by a "queue priority" — what needs the store's attention
  // first goes to the top: pending_approval > locked > delivered > the rest.
  const statusRank: Record<WishlistStatus, number> = {
    pending_approval: 0,
    locked: 1,
    delivered: 2,
    draft: 3,
    released: 4,
    cancelled: 5,
  };
  orders.sort((a, b) => {
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    // Most recently updated first within a status.
    return a.updated_at < b.updated_at ? 1 : -1;
  });

  const inventory: StoreInventoryRow[] = (inventoryResult.data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    category: row.category as string,
    price_stroops: toBig(row.price_stroops),
    stock: Number(row.stock ?? 0),
    unit: (row.unit as string | null) ?? null,
  }));

  // ---- 4. Totals -----------------------------------------------------
  const pendingCount = orders.filter((o) => o.status === "pending_approval").length;
  const outOfStockCount = inventory.filter((i) => i.stock === 0).length;

  let locked = 0n;
  let released = 0n;
  for (const s of settlements) {
    if (s.event_type === "lock") locked += s.amount_stroops;
    else if (s.event_type === "release") released += s.amount_stroops;
  }

  return {
    store: {
      id: store.id as string,
      display_name: (store.display_name as string) ?? "Store",
      country: (store.country as string | null) ?? null,
    },
    totals: {
      pendingCount,
      inEscrow: locked - released,
      revenue: released,
      outOfStockCount,
    },
    orders,
    inventory,
    activity: settlements.slice(0, 10),
  };
}
