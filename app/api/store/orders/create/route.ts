import { NextResponse } from "next/server";

import { requireUser } from "../../../../../lib/api/auth";
import { err, ok, parseJsonBody } from "../../../../../lib/api/errors";
import { beginIdempotent } from "../../../../../lib/api/idempotency";
import { newRequestId } from "../../../../../lib/api/request-id";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/store/orders/create — store creates a wishlist on behalf of a family.
 *
 * Use case: walk-in / phone-in customers whose order didn't originate from
 * the family's WishlistBuilder. The store enters items + qty + family,
 * submits, and a fresh wishlist appears in the order queue at status
 * `pending_approval` — the same lock/release flow then applies as for any
 * family-built order.
 *
 * Auth: caller must be a `store` AND `caller.userId === store_id`.
 *
 * Body: { store_id, family_id, items: [{inventory_id, quantity}], notes? }
 *
 * Validation:
 *   - All inventory items must belong to the calling store (no cross-store
 *     orders — matches the lock route's single-store demo invariant).
 *   - Stock check is best-effort, same as /api/wishlist.
 *   - Family must exist with role='family'.
 *
 * Mirrors /api/wishlist's create flow (wishlist + items in two inserts with
 * a compensating delete if items fail) — the only differences are status
 * starts at `pending_approval` (so it lands in the queue immediately) and
 * the caller is the store, not the family.
 */

interface InputItem {
  inventory_id: string;
  quantity: number;
}

interface CreateOrderBody {
  store_id: string;
  family_id: string;
  items: InputItem[];
  notes?: string;
}

function validateBody(body: Record<string, unknown>): CreateOrderBody | string {
  const store_id = body.store_id;
  const family_id = body.family_id;
  const items = body.items;
  if (typeof store_id !== "string" || !store_id) return "store_id is required";
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
    store_id,
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
  const { store_id, family_id, items, notes } = validation;

  if (caller.userId !== store_id) {
    return err(403, "forbidden", "Authenticated user does not match store_id.", undefined, { requestId });
  }

  // ---- 3. Idempotency guard ---------------------------------------
  // (store, family, item-set hash) — double-clicking "Create order" with
  // the same exact items + family is treated as in-flight. Different items
  // = a separate order.
  const itemFingerprint = items
    .map((it) => `${it.inventory_id}:${it.quantity}`)
    .sort()
    .join(",");
  const idemLock = await beginIdempotent([
    "store/orders/create",
    store_id,
    family_id,
    itemFingerprint,
  ]);
  if (!idemLock) {
    return err(409, "in_flight", "An identical order is already being created.", undefined, {
      requestId,
      retryAfterSeconds: 5,
    });
  }

  try {
    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (e) {
      console.error("[store/orders/create] Supabase admin init failed:", e);
      return err(500, "server_misconfigured", "Supabase service env vars missing.", undefined, { requestId });
    }

    // ---- 4. Verify caller is a store + family exists --------------
    const { data: callerProfile, error: cpErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", caller.userId)
      .maybeSingle();
    if (cpErr) {
      console.error("[store/orders/create] caller profile lookup failed:", cpErr);
      return err(500, "db_error", "Could not verify caller role.", undefined, { requestId });
    }
    if (callerProfile?.role !== "store") {
      return err(403, "wrong_role", "Only store callers can create orders.", {
        current_role: callerProfile?.role,
      }, { requestId });
    }

    const { data: familyProfile, error: fpErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", family_id)
      .maybeSingle();
    if (fpErr) {
      console.error("[store/orders/create] family profile lookup failed:", fpErr);
      return err(500, "db_error", "Could not verify family.", undefined, { requestId });
    }
    if (!familyProfile) {
      return err(404, "family_not_found", "Family profile does not exist.", undefined, { requestId });
    }
    if (familyProfile.role !== "family") {
      return err(400, "not_a_family", "Selected user is not a family profile.", {
        current_role: familyProfile.role,
      }, { requestId });
    }

    // ---- 5. Load inventory + verify store ownership ---------------
    const inventoryIds = items.map((it) => it.inventory_id);
    const { data: inv, error: invErr } = await supabase
      .from("inventory")
      .select("id, store_id, price_stroops, stock, name")
      .in("id", inventoryIds);

    if (invErr) {
      console.error("[store/orders/create] inventory load failed:", invErr);
      return err(500, "db_error", "Could not load inventory.", undefined, { requestId });
    }
    if (!inv || inv.length !== inventoryIds.length) {
      const found = new Set((inv ?? []).map((r) => r.id));
      const missing = inventoryIds.filter((id) => !found.has(id));
      return err(404, "inventory_not_found", "One or more items do not exist.", { missing }, { requestId });
    }

    // Every item must belong to the calling store. Anything else would
    // let a store stuff an order into another store's queue.
    const foreign = inv.filter((row) => row.store_id !== store_id);
    if (foreign.length > 0) {
      return err(403, "foreign_inventory", "All items must come from your own store.", {
        foreign_ids: foreign.map((r) => r.id),
      }, { requestId });
    }

    // Stock check (best-effort, same as /api/wishlist).
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

    // ---- 6. Insert wishlist + items -------------------------------
    const total_stroops = items.reduce<bigint>((sum, it) => {
      const row = invById.get(it.inventory_id)!;
      return sum + BigInt(row.price_stroops) * BigInt(it.quantity);
    }, 0n);

    const { data: created, error: wlErr } = await supabase
      .from("wishlist")
      .insert({
        family_id,
        // Lands in the queue immediately — the store just created it
        // on behalf of the family, so "draft" would just add a wasted
        // step. Family/OFW can still cancel, lock, etc. as usual.
        status: "pending_approval",
        total_stroops: total_stroops.toString(),
        notes: notes ?? null,
      })
      .select("id, family_id, status, total_stroops, notes, created_at")
      .single();

    if (wlErr || !created) {
      console.error("[store/orders/create] wishlist insert failed:", wlErr);
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
      console.error("[store/orders/create] wishlist_item insert failed:", itemErr);
      // Compensating delete so we don't leave an empty wishlist row.
      await supabase.from("wishlist").delete().eq("id", created.id);
      return err(500, "db_error", "Could not create wishlist items.", undefined, { requestId });
    }

    // ---- 7. Respond -----------------------------------------------
    return ok({
      wishlist_id: created.id,
      family_id: created.family_id,
      status: created.status,
      total_stroops: total_stroops.toString(),
      item_count: items.length,
      notes: created.notes,
      message: "Order created on the family's behalf. It now appears in the queue.",
    }, { requestId });
  } finally {
    await idemLock.release();
  }
}
