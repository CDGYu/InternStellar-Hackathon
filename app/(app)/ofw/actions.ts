"use server";

import { revalidatePath } from "next/cache";

import { loadUserProfile } from "@/lib/auth-role";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * OFW-side wishlist editing.
 *
 * Why this file exists: the family RLS policies (`family_writes_*`)
 * require `auth.uid() = family_id`. The OFW isn't the family, so a
 * cookie-bound write from the OFW dashboard would be rejected by RLS.
 *
 * The right long-term fix is a real ofw→family schema link
 * (see CLAUDE.md "Cross-cutting" — TODO P4 to add
 * `family.sponsor_ofw_id`). Until that lands, these server actions
 * verify the caller is an OFW and then do the write via `service_role`
 * (which bypasses RLS). Mirrors the same DEMO posture as the
 * `/api/escrow/lock` and `/release` auth loosenings.
 *
 * Both actions revalidate `/ofw` so the page re-renders with the new
 * wishlist state without needing a manual refresh.
 */

export interface OfwActionResult {
  ok: boolean;
  error?: string;
}

async function requireOfwCaller(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { profile, error } = await loadUserProfile(user.id);
  if (error) return { ok: false, error: `Profile lookup failed: ${error}` };
  if (profile?.role !== "ofw") {
    return { ok: false, error: "Only OFWs can edit wishlists from this view." };
  }
  return { ok: true, userId: user.id };
}

/**
 * Add a unit of an inventory item to a wishlist.
 *
 * Behaviour:
 *   - If the wishlist already has this inventory_id, bumps its quantity.
 *   - Otherwise inserts a new line, snapshotting the current price.
 *   - Refuses if the wishlist is past the editing window (locked or later).
 */
export async function ofwAddWishlistItem(args: {
  wishlistId: string;
  inventoryId: string;
}): Promise<OfwActionResult> {
  const caller = await requireOfwCaller();
  if (!caller.ok) return { ok: false, error: caller.error };

  const admin = getSupabaseAdmin();

  // Validate the wishlist is still editable.
  const { data: wishlist, error: wErr } = await admin
    .from("wishlist")
    .select("id, status, family_id")
    .eq("id", args.wishlistId)
    .maybeSingle();
  if (wErr) return { ok: false, error: `Wishlist load failed: ${wErr.message}` };
  if (!wishlist) return { ok: false, error: "Wishlist not found." };
  if (wishlist.status !== "draft" && wishlist.status !== "pending_approval") {
    return {
      ok: false,
      error: `Wishlist is ${wishlist.status} — items can only be edited while draft or pending.`,
    };
  }

  // Snapshot the inventory price at insert time (matches the lock route's
  // expectation that price_stroops_at_add reflects what the family saw
  // when they added the item).
  const { data: inv, error: invErr } = await admin
    .from("inventory")
    .select("id, price_stroops, stock")
    .eq("id", args.inventoryId)
    .maybeSingle();
  if (invErr) return { ok: false, error: `Inventory load failed: ${invErr.message}` };
  if (!inv) return { ok: false, error: "Inventory item not found." };

  // Upsert by (wishlist_id, inventory_id): bump if it exists, insert if not.
  const { data: existing, error: exErr } = await admin
    .from("wishlist_item")
    .select("id, quantity")
    .eq("wishlist_id", args.wishlistId)
    .eq("inventory_id", args.inventoryId)
    .maybeSingle();
  if (exErr) return { ok: false, error: `Existing lookup failed: ${exErr.message}` };

  if (existing) {
    const nextQty = (existing.quantity as number) + 1;
    if (nextQty > inv.stock) {
      return {
        ok: false,
        error: `Only ${inv.stock} in stock — can't add another.`,
      };
    }
    const { error: uErr } = await admin
      .from("wishlist_item")
      .update({ quantity: nextQty })
      .eq("id", existing.id);
    if (uErr) return { ok: false, error: `Update failed: ${uErr.message}` };
  } else {
    if (inv.stock < 1) {
      return { ok: false, error: "Out of stock." };
    }
    const { error: iErr } = await admin.from("wishlist_item").insert({
      wishlist_id: args.wishlistId,
      inventory_id: args.inventoryId,
      quantity: 1,
      price_stroops_at_add: inv.price_stroops,
    });
    if (iErr) return { ok: false, error: `Insert failed: ${iErr.message}` };
  }

  revalidatePath("/ofw");
  return { ok: true };
}

/**
 * Set the stock count on an inventory row.
 *
 * Exposed on the OFW dashboard so demos can adjust supply on the fly
 * without bouncing through the store account. Same service-role posture
 * as the wishlist edits above.
 */
export async function ofwUpdateInventoryStock(args: {
  inventoryId: string;
  stock: number;
}): Promise<OfwActionResult> {
  const caller = await requireOfwCaller();
  if (!caller.ok) return { ok: false, error: caller.error };

  if (!Number.isInteger(args.stock) || args.stock < 0) {
    return { ok: false, error: "Stock must be a non-negative integer." };
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("inventory")
    .update({ stock: args.stock })
    .eq("id", args.inventoryId);
  if (error) return { ok: false, error: `Stock update failed: ${error.message}` };

  revalidatePath("/ofw");
  return { ok: true };
}

/**
 * Remove one unit of a wishlist item.
 *
 * Behaviour:
 *   - If quantity > 1, decrements.
 *   - If quantity = 1, deletes the row entirely.
 *   - Refuses if the parent wishlist is past the editing window.
 */
export async function ofwRemoveWishlistItem(args: {
  itemId: string;
}): Promise<OfwActionResult> {
  const caller = await requireOfwCaller();
  if (!caller.ok) return { ok: false, error: caller.error };

  const admin = getSupabaseAdmin();

  const { data: item, error: gErr } = await admin
    .from("wishlist_item")
    .select("id, quantity, wishlist:wishlist_id (id, status)")
    .eq("id", args.itemId)
    .maybeSingle();
  if (gErr) return { ok: false, error: `Item load failed: ${gErr.message}` };
  if (!item) return { ok: false, error: "Wishlist item not found." };

  // Inspect the parent wishlist's status (the join is one-to-one).
  const parent = Array.isArray((item as any).wishlist)
    ? (item as any).wishlist[0]
    : (item as any).wishlist;
  const parentStatus = parent?.status as string | undefined;
  if (parentStatus !== "draft" && parentStatus !== "pending_approval") {
    return {
      ok: false,
      error: `Wishlist is ${parentStatus ?? "missing"} — items can only be removed while draft or pending.`,
    };
  }

  const qty = item.quantity as number;
  if (qty > 1) {
    const { error: uErr } = await admin
      .from("wishlist_item")
      .update({ quantity: qty - 1 })
      .eq("id", args.itemId);
    if (uErr) return { ok: false, error: `Decrement failed: ${uErr.message}` };
  } else {
    const { error: dErr } = await admin
      .from("wishlist_item")
      .delete()
      .eq("id", args.itemId);
    if (dErr) return { ok: false, error: `Delete failed: ${dErr.message}` };
  }

  revalidatePath("/ofw");
  return { ok: true };
}
