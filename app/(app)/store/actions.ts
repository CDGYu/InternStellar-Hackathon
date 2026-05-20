"use server";

import { revalidatePath } from "next/cache";

import { loadUserProfile } from "@/lib/auth-role";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Store-side inventory editing.
 *
 * Verifies the caller is the inventory row's owning store, then writes
 * via `service_role` to bypass the wide-open dev RLS policies (and to
 * avoid coupling these UI writes to the policy shape that will tighten
 * on Day 4-5 per CLAUDE.md).
 */

export interface StoreActionResult {
  ok: boolean;
  error?: string;
}

async function requireStoreOwner(
  inventoryId: string,
): Promise<{ ok: true; storeId: string } | { ok: false; error: string }> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { profile, error: pErr } = await loadUserProfile(user.id);
  if (pErr) return { ok: false, error: `Profile lookup failed: ${pErr}` };
  if (profile?.role !== "store") {
    return { ok: false, error: "Only stores can edit inventory." };
  }

  const admin = getSupabaseAdmin();
  const { data: row, error: iErr } = await admin
    .from("inventory")
    .select("store_id")
    .eq("id", inventoryId)
    .maybeSingle();
  if (iErr) return { ok: false, error: `Inventory load failed: ${iErr.message}` };
  if (!row) return { ok: false, error: "Inventory item not found." };
  if (row.store_id !== user.id) {
    return { ok: false, error: "This item belongs to another store." };
  }

  return { ok: true, storeId: user.id };
}

/**
 * Atomically update price and/or stock on one inventory row. Fields are
 * optional — pass only what changed. Price is accepted as a stringified
 * bigint to preserve precision past JS's safe-integer range.
 */
export async function storeUpdateInventory(args: {
  inventoryId: string;
  stock?: number;
  priceStroops?: string;
}): Promise<StoreActionResult> {
  const updates: Record<string, string | number> = {};

  if (args.stock !== undefined) {
    if (!Number.isInteger(args.stock) || args.stock < 0) {
      return { ok: false, error: "Stock must be a non-negative integer." };
    }
    updates.stock = args.stock;
  }

  if (args.priceStroops !== undefined) {
    let parsed: bigint;
    try {
      parsed = BigInt(args.priceStroops);
    } catch {
      return { ok: false, error: "Price must be a whole number of stroops." };
    }
    if (parsed < 0n) {
      return { ok: false, error: "Price must be non-negative." };
    }
    updates.price_stroops = parsed.toString();
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  const owner = await requireStoreOwner(args.inventoryId);
  if (!owner.ok) return { ok: false, error: owner.error };

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("inventory")
    .update(updates)
    .eq("id", args.inventoryId);
  if (error) return { ok: false, error: `Update failed: ${error.message}` };

  revalidatePath("/store");
  return { ok: true };
}
