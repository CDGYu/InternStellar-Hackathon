import { NextResponse } from "next/server";

import { requireUser } from "../../../lib/api/auth";
import { err, ok, parseJsonBody } from "../../../lib/api/errors";
import { newRequestId } from "../../../lib/api/request-id";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

/**
 * POST /api/wishlist — server-side wishlist creation for families.
 *
 * Status: KEPT AS RESERVE. The family UI today (web `WishlistBuilder.tsx`
 * and mobile `MobileShop.tsx`) creates the wishlist + items directly via
 * the Supabase browser client, gated by the existing RLS policies
 * (`family_writes_own_wishlist`, `family_writes_wishlist_item`). That
 * path is what the demo runs. This route is a working server-side
 * alternative — useful if you ever need to tighten validation beyond
 * what RLS expresses (item caps, cross-row invariants, etc.), or to
 * create wishlists from a server context (cron, admin tool) where the
 * cookie-bound client isn't available.
 *
 * Still referenced from `scripts/_test-escrow-wiring.ts` and
 * `scripts/_test-no-stacktrace-leak.ts`, so removing it would break
 * those probes. Keep the route until either the tests are rewritten
 * or the family UI is migrated to call it directly.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface InputItem {
  inventory_id: string;
  quantity: number;
}

interface WishlistBody {
  family_id: string;
  items: InputItem[];
  notes?: string;
}

function validateBody(body: Record<string, unknown>): WishlistBody | string {
  const family_id = body.family_id;
  const items = body.items;
  if (typeof family_id !== "string" || !family_id) return "family_id is required";
  if (!Array.isArray(items) || items.length === 0) return "items must be a non-empty array";
  if (items.length > 50) return "items array too large (max 50)";

  const cleaned: InputItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const raw = items[i] as Record<string, unknown>;
    const inventory_id = raw?.inventory_id;
    const quantity = raw?.quantity;
    if (typeof inventory_id !== "string" || !inventory_id) {
      return `items[${i}].inventory_id is required`;
    }
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
      return `items[${i}].quantity must be a positive integer`;
    }
    cleaned.push({ inventory_id, quantity });
  }

  const notes = body.notes;
  return {
    family_id,
    items: cleaned,
    notes: typeof notes === "string" ? notes : undefined,
  };
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = newRequestId(req);

  // ---- 1. Auth -----------------------------------------------------
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;

  // ---- 2. Parse + validate body -----------------------------------
  const parsed = await parseJsonBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const validation = validateBody(parsed);
  if (typeof validation === "string") {
    return err(400, "invalid_body", validation, undefined, { requestId });
  }
  const { family_id, items, notes } = validation;

  if (caller.userId !== family_id) {
    return err(403, "forbidden", "Authenticated user does not match family_id.", undefined, { requestId });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error("[wishlist] Supabase admin client init failed:", e);
    return err(500, "server_misconfigured", "Supabase service env vars missing.", undefined, { requestId });
  }

  // ---- 3. Load inventory rows (validate existence + snapshot price) -
  const inventoryIds = items.map((it) => it.inventory_id);
  const { data: inv, error: invErr } = await supabase
    .from("inventory")
    .select("id, store_id, price_stroops, stock, name")
    .in("id", inventoryIds);

  if (invErr) {
    console.error("[wishlist] inventory load failed:", invErr);
    return err(500, "db_error", "Could not load inventory.", undefined, { requestId });
  }
  if (!inv || inv.length !== inventoryIds.length) {
    const found = new Set((inv ?? []).map((r) => r.id));
    const missing = inventoryIds.filter((id) => !found.has(id));
    return err(404, "inventory_not_found", "One or more items do not exist.", { missing }, { requestId });
  }

  // Day 4 demo is single-store. Enforce that here so the lock route doesn't
  // have to surface multiple_stores later.
  const storeIds = new Set(inv.map((row) => row.store_id));
  if (storeIds.size > 1) {
    return err(409, "multiple_stores", "All wishlist items must come from the same store.", undefined, { requestId });
  }

  // Stock check (best-effort — the contract is the source of truth for funds,
  // and P4's finalize_wishlist will guard the decrement on release).
  const invById = new Map(inv.map((row) => [row.id, row]));
  for (const it of items) {
    const row = invById.get(it.inventory_id)!;
    if (row.stock < it.quantity) {
      return err(409, "insufficient_stock", `Not enough stock for "${row.name}".`, {
        inventory_id: it.inventory_id,
        requested: it.quantity,
        available: row.stock,
      }, { requestId });
    }
  }

  // ---- 4. Insert wishlist + items in two steps --------------------
  const total_stroops = items.reduce<bigint>((sum, it) => {
    const row = invById.get(it.inventory_id)!;
    return sum + BigInt(row.price_stroops) * BigInt(it.quantity);
  }, 0n);

  const { data: created, error: wlErr } = await supabase
    .from("wishlist")
    .insert({
      family_id,
      status: "draft",
      total_stroops: total_stroops.toString(),
      notes: notes ?? null,
    })
    .select("id, family_id, status, total_stroops, notes, created_at")
    .single();

  if (wlErr || !created) {
    console.error("[wishlist] wishlist insert failed:", wlErr);
    return err(500, "db_error", "Could not create wishlist.", undefined, { requestId });
  }

  const itemRows = items.map((it) => ({
    wishlist_id: created.id,
    inventory_id: it.inventory_id,
    quantity: it.quantity,
    price_stroops_at_add: invById.get(it.inventory_id)!.price_stroops,
  }));

  const { error: itemErr } = await supabase.from("wishlist_item").insert(itemRows);

  if (itemErr) {
    console.error("[wishlist] wishlist_item insert failed:", itemErr);
    // Compensating delete so we don't leave an empty wishlist row.
    await supabase.from("wishlist").delete().eq("id", created.id);
    return err(500, "db_error", "Could not create wishlist items.", undefined, { requestId });
  }

  // ---- 5. Respond -------------------------------------------------
  return ok({
    wishlist_id: created.id,
    family_id: created.family_id,
    status: created.status,
    total_stroops: total_stroops.toString(),
    item_count: items.length,
    notes: created.notes,
    message: "Wishlist created. Family can now request approval / lock escrow.",
  }, { requestId });
}
