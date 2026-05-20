import type { WishlistStatus, SettlementEvent } from "@/components/ui/StatusPill";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Server-side data loader for the Family dashboard.
 *
 * Same three-query pattern as the OFW loader but family-scoped: every row
 * is filtered by `family_id = familyId`. We trust the audit trail
 * (`settlement`) over `wishlist.total_stroops` for money totals, same as
 * the OFW dashboard.
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
  /**
   * All wishlists except cancelled, newest-updated first. The page renders
   * them in two groups (in-flight vs released) but the loader keeps it as
   * one ordered list so the grouping decision stays in the view.
   */
  wishlists: FamilyWishlistRow[];
  activity: FamilySettlementRow[];
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

  // ---- 1. Family profile --------------------------------------------
  const { data: family, error: pErr } = await supabase
    .from("profiles")
    .select("id, display_name, country")
    .eq("id", opts.familyId)
    .maybeSingle();

  if (pErr) throw new Error(`family profile load failed: ${pErr.message}`);
  if (!family) {
    throw new Error(
      `Family profile not found: ${opts.familyId}. Did you run db/seed.sql?`,
    );
  }

  // ---- 2. Wishlists --------------------------------------------------
  const { data: wishlistRowsRaw, error: wErr } = await supabase
    .from("wishlist")
    .select(
      "id, status, total_stroops, notes, escrow_tx_hash, release_tx_hash, created_at, updated_at",
    )
    .eq("family_id", opts.familyId)
    .order("updated_at", { ascending: false });

  if (wErr) throw new Error(`wishlist load failed: ${wErr.message}`);

  const wishlistRows = wishlistRowsRaw ?? [];
  const wishlistIds = wishlistRows.map((w) => w.id as string);

  // ---- 3. Item counts + settlements (parallel) ----------------------
  let itemCounts = new Map<string, number>();
  let settlements: FamilySettlementRow[] = [];

  if (wishlistIds.length > 0) {
    const [itemsResult, settlementsResult] = await Promise.all([
      supabase
        .from("wishlist_item")
        .select("wishlist_id")
        .in("wishlist_id", wishlistIds),
      supabase
        .from("settlement")
        .select("id, wishlist_id, event_type, tx_hash, amount_stroops, created_at")
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

    settlements = (settlementsResult.data ?? []).map((s) => ({
      id: s.id as string,
      wishlist_id: s.wishlist_id as string,
      event_type: s.event_type as SettlementEvent,
      tx_hash: s.tx_hash as string,
      amount_stroops: toBig(s.amount_stroops),
      created_at: s.created_at as string,
    }));
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
    activity: settlements.slice(0, 10),
  };
}
