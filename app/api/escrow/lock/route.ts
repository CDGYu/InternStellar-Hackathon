import { NextResponse } from "next/server";

import { requireUser } from "../../../../lib/api/auth";
import { err, ok, parseJsonBody } from "../../../../lib/api/errors";
import { beginIdempotent } from "../../../../lib/api/idempotency";
import { newRequestId } from "../../../../lib/api/request-id";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import {
  ContractCallError,
  ContractNotConfiguredError,
  lockEscrow,
} from "../../../../lib/stellar/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LockBody {
  family_id: string;
  wishlist_id: string;
}

function validateBody(body: Record<string, unknown>): LockBody | string {
  const family_id = body.family_id;
  const wishlist_id = body.wishlist_id;
  if (typeof family_id !== "string" || !family_id) return "family_id is required";
  if (typeof wishlist_id !== "string" || !wishlist_id) return "wishlist_id is required";
  return { family_id, wishlist_id };
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
  const { family_id, wishlist_id } = validation;

  // ---- 3. Idempotency guard ---------------------------------------
  // Prevents a double-clicking family from firing two concurrent lock_escrow
  // calls for the same wishlist. Auto-releases at function exit via the
  // try/finally below.
  const idemLock = beginIdempotent(["escrow/lock", family_id, wishlist_id]);
  if (!idemLock) {
    return err(409, "in_flight", "An identical request is already being processed.", undefined, {
      requestId,
      retryAfterSeconds: 10,
    });
  }

  try {
    // ---- 4. Load wishlist + items + family's stellar address --------
    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (e) {
      console.error("[escrow/lock] Supabase admin client init failed:", e);
      return err(500, "server_misconfigured", "Supabase service env vars missing.", undefined, { requestId });
    }

    // Auth check: caller must be the family themselves, OR an OFW.
    // DEMO: there's no schema-level OFW→family link yet (see CLAUDE.md
    // "Cross-cutting" — TODO P4 to add `family.sponsor_ofw_id`). Until
    // that lands, any OFW can lock for any family_id. Acceptable on
    // testnet; tighten before production.
    if (caller.userId !== family_id) {
      const { data: callerProfile, error: cpErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", caller.userId)
        .maybeSingle();
      if (cpErr) {
        console.error("[escrow/lock] caller profile lookup failed:", cpErr);
        return err(500, "db_error", "Could not verify caller role.", undefined, { requestId });
      }
      if (callerProfile?.role !== "ofw") {
        return err(403, "forbidden", "Caller must be the family or an OFW.", undefined, { requestId });
      }
    }

    const { data: wishlist, error: wErr } = await supabase
      .from("wishlist")
      .select("id, family_id, status, total_stroops, escrow_tx_hash, notes")
      .eq("id", wishlist_id)
      .eq("family_id", family_id)
      .maybeSingle();

    if (wErr) {
      console.error("[escrow/lock] wishlist load failed:", wErr);
      return err(500, "db_error", "Could not load wishlist.", undefined, { requestId });
    }
    if (!wishlist) {
      return err(404, "wishlist_not_found", undefined, undefined, { requestId });
    }
    if (wishlist.status !== "draft" && wishlist.status !== "pending_approval") {
      return err(409, "invalid_status", undefined, {
        current: wishlist.status,
        expected: ["draft", "pending_approval"],
      }, { requestId });
    }
    if (wishlist.escrow_tx_hash) {
      return err(409, "already_locked", "Wishlist already has an escrow tx hash.", {
        escrow_tx_hash: wishlist.escrow_tx_hash,
      }, { requestId });
    }

    const { data: items, error: iErr } = await supabase
      .from("wishlist_item")
      .select("quantity, price_stroops_at_add, inventory:inventory_id(store_id)")
      .eq("wishlist_id", wishlist_id);

    if (iErr) {
      console.error("[escrow/lock] wishlist_item load failed:", iErr);
      return err(500, "db_error", "Could not load wishlist items.", undefined, { requestId });
    }
    if (!items || items.length === 0) {
      return err(409, "wishlist_empty", "Wishlist has no items to escrow.", undefined, { requestId });
    }

    type ItemRow = {
      quantity: number;
      price_stroops_at_add: string | number;
      inventory: { store_id: string } | { store_id: string }[] | null;
    };

    function getStoreId(row: ItemRow): string | null {
      const inv = row.inventory;
      if (!inv) return null;
      if (Array.isArray(inv)) return inv[0]?.store_id ?? null;
      return inv.store_id ?? null;
    }

    const storeIds = new Set<string>();
    for (const row of items as ItemRow[]) {
      const sid = getStoreId(row);
      if (sid) storeIds.add(sid);
    }

    if (storeIds.size === 0) {
      return err(500, "db_error", "Could not resolve store from wishlist items.", undefined, { requestId });
    }
    if (storeIds.size > 1) {
      return err(409, "multiple_stores", "Wishlist items span multiple stores. Day 4 demo is single-store only.", undefined, { requestId });
    }

    const storeId = [...storeIds][0];

    const grocery_stroops = (items as ItemRow[]).reduce<bigint>((sum, row) => {
      const price = BigInt(row.price_stroops_at_add);
      const qty = BigInt(row.quantity);
      return sum + price * qty;
    }, 0n);

    if (grocery_stroops <= 0n) {
      return err(409, "wishlist_total_zero", "Computed escrow amount is zero.", undefined, { requestId });
    }

    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, stellar_public_key")
      .in("id", [family_id, storeId]);

    if (pErr) {
      console.error("[escrow/lock] profiles load failed:", pErr);
      return err(500, "db_error", "Could not load family/store profiles.", undefined, { requestId });
    }

    const familyAddress = profiles?.find((p) => p.id === family_id)?.stellar_public_key ?? null;
    const storeAddress = profiles?.find((p) => p.id === storeId)?.stellar_public_key ?? null;

    if (!familyAddress) {
      return err(400, "family_address_not_set", "Family profile is missing stellar_public_key.", undefined, { requestId });
    }
    if (!storeAddress) {
      return err(400, "store_address_not_set", "Store profile is missing stellar_public_key.", undefined, { requestId });
    }
    if (familyAddress === storeAddress) {
      return err(400, "family_cannot_be_store", "Family and store cannot be the same address.", undefined, { requestId });
    }

    // ---- 5. Call the contract ---------------------------------------
    let txHash: string;
    let escrowId: unknown;
    try {
      const result = await lockEscrow({
        familyAddress,
        storeAddress,
        amountStroops: grocery_stroops,
      });
      txHash = result.txHash;
      escrowId = result.escrowId;
    } catch (e) {
      if (e instanceof ContractNotConfiguredError) {
        console.error("[escrow/lock]", e.message);
        return err(503, "contract_not_configured", e.message, undefined, {
          requestId,
          retryAfterSeconds: 30,
        });
      }
      if (e instanceof ContractCallError) {
        console.error("[escrow/lock] contract call failed:", e.reason, e.detail);
        return err(400, "contract_error", e.reason, undefined, { requestId });
      }
      console.error("[escrow/lock] unexpected contract error:", e);
      return err(500, "contract_error", "Unexpected error invoking contract.", undefined, { requestId });
    }

    // ---- 6. Persist Supabase state (escrow_tx_hash + settlement) -----
    const notes_with_id =
      escrowId !== undefined && escrowId !== null
        ? `${wishlist.notes ?? ""}\n__escrow_ret__:${JSON.stringify(escrowId)}`.trim()
        : wishlist.notes ?? null;

    const { error: updErr } = await supabase
      .from("wishlist")
      .update({
        status: "locked",
        escrow_tx_hash: txHash,
        total_stroops: grocery_stroops.toString(),
        notes: notes_with_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wishlist_id);

    if (updErr) {
      console.error("[escrow/lock] wishlist update failed AFTER successful contract call:", updErr);
      return err(500, "db_error", "Escrow locked on-chain but DB update failed. Reconcile from settlement.", {
        tx_hash: txHash,
      }, { requestId });
    }

    const { error: setErr } = await supabase.from("settlement").insert({
      wishlist_id,
      event_type: "lock",
      tx_hash: txHash,
      amount_stroops: grocery_stroops.toString(),
    });

    if (setErr) {
      console.error("[escrow/lock] settlement insert failed:", setErr);
      // Don't fail the request — chain truth + wishlist row are good.
    }

    // ---- 7. Respond -------------------------------------------------
    return ok({
      escrow_id: escrowId ?? null,
      wishlist_id,
      tx_hash: txHash,
      status: "locked",
      amount_stroops: grocery_stroops.toString(),
      store_id: storeId,
      message: "Escrow locked successfully. Store can now prepare delivery.",
    }, { requestId });
  } finally {
    idemLock.release();
  }
}
