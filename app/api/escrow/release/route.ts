import { NextResponse } from "next/server";

import { requireUser } from "../../../../lib/api/auth";
import { err, ok, parseJsonBody } from "../../../../lib/api/errors";
import { beginIdempotent } from "../../../../lib/api/idempotency";
import { newRequestId } from "../../../../lib/api/request-id";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import {
  ContractCallError,
  ContractNotConfiguredError,
  releaseEscrow,
} from "../../../../lib/stellar/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReleaseBody {
  family_id: string;
  wishlist_id: string;
}

function validateBody(body: Record<string, unknown>): ReleaseBody | string {
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
  // Stops the family's "Confirm Delivery" double-click from racing two
  // release_escrow calls. Already-released is also guarded inside the
  // handler (DB check), but the in-flight check fires first and saves
  // the chain round-trip on the second click.
  const idemLock = await beginIdempotent(["escrow/release", family_id, wishlist_id]);
  if (!idemLock) {
    return err(409, "in_flight", "An identical request is already being processed.", undefined, {
      requestId,
      retryAfterSeconds: 10,
    });
  }

  try {
    // ---- 4. Load wishlist (must be 'delivered') ---------------------
    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (e) {
      console.error("[escrow/release] Supabase admin client init failed:", e);
      return err(500, "server_misconfigured", "Supabase service env vars missing.", undefined, { requestId });
    }

    if (caller.userId !== family_id) {
      const { data: callerProfile, error: cpErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", caller.userId)
        .maybeSingle();
      if (cpErr) {
        console.error("[escrow/release] caller profile lookup failed:", cpErr);
        return err(500, "db_error", "Could not verify caller role.", undefined, { requestId });
      }
      if (callerProfile?.role !== "ofw") {
        return err(403, "forbidden", "Caller must be the family or an OFW.", undefined, { requestId });
      }
      const { data: familyProfile, error: fpErr } = await supabase
        .from("profiles")
        .select("sponsor_ofw_id")
        .eq("id", family_id)
        .maybeSingle();
      if (fpErr) {
        console.error("[escrow/release] family profile lookup failed:", fpErr);
        return err(500, "db_error", "Could not verify family sponsor link.", undefined, { requestId });
      }
      if (familyProfile?.sponsor_ofw_id !== caller.userId) {
        return err(403, "forbidden", "OFW is not linked to this family.", undefined, { requestId });
      }
    }

    const { data: wishlist, error: wErr } = await supabase
      .from("wishlist")
      .select("id, family_id, status, total_stroops, escrow_tx_hash, release_tx_hash, escrow_id")
      .eq("id", wishlist_id)
      .eq("family_id", family_id)
      .maybeSingle();

    if (wErr) {
      console.error("[escrow/release] wishlist load failed:", wErr);
      return err(500, "db_error", "Could not load wishlist.", undefined, { requestId });
    }
    if (!wishlist) {
      return err(404, "wishlist_not_found", undefined, undefined, { requestId });
    }
    if (wishlist.status !== "delivered") {
      return err(409, "invalid_status", undefined, {
        current: wishlist.status,
        expected: "delivered",
      }, { requestId });
    }
    if (wishlist.release_tx_hash) {
      return err(409, "already_released", "Wishlist already has a release tx hash.", {
        release_tx_hash: wishlist.release_tx_hash,
      }, { requestId });
    }
    if (!wishlist.escrow_tx_hash) {
      return err(409, "no_escrow", "Wishlist is marked delivered but has no escrow tx hash.", undefined, { requestId });
    }

    // ---- 5. Call the contract ---------------------------------------
    // The on-chain u32 escrow id is captured into wishlist.escrow_id by the
    // lock route. A NULL here means the lock either pre-dates this column or
    // failed to record the id — release cannot proceed without it (passing
    // the tx hash as a fallback would surface as an opaque contract_error).
    if (wishlist.escrow_id == null) {
      return err(409, "escrow_id_missing",
        "Lock recorded but escrow_id was not captured. Reconcile from settlement.",
        undefined, { requestId });
    }
    const escrowId: number = Number(wishlist.escrow_id);

    let txHash: string;
    try {
      const result = await releaseEscrow({ escrowId });
      txHash = result.txHash;
    } catch (e) {
      if (e instanceof ContractNotConfiguredError) {
        console.error("[escrow/release]", e.message);
        return err(503, "contract_not_configured", e.message, undefined, {
          requestId,
          retryAfterSeconds: 30,
        });
      }
      if (e instanceof ContractCallError) {
        console.error("[escrow/release] contract call failed:", e.reason, e.detail);
        return err(400, "contract_error", e.reason, undefined, { requestId });
      }
      console.error("[escrow/release] unexpected contract error:", e);
      return err(500, "contract_error", "Unexpected error invoking contract.", undefined, { requestId });
    }

    // ---- 6. Persist Supabase state ---------------------------------
    const { error: updErr } = await supabase
      .from("wishlist")
      .update({
        status: "released",
        release_tx_hash: txHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wishlist_id);

    if (updErr) {
      console.error("[escrow/release] wishlist update failed AFTER successful contract call:", updErr);
      return err(500, "db_error", "Funds released on-chain but DB update failed. Reconcile from settlement.", {
        tx_hash: txHash,
      }, { requestId });
    }

    const { error: setErr } = await supabase.from("settlement").insert({
      wishlist_id,
      event_type: "release",
      tx_hash: txHash,
      amount_stroops: (wishlist.total_stroops ?? 0).toString(),
    });

    if (setErr) {
      console.error("[escrow/release] settlement insert failed:", setErr);
    }

    // ---- 6b. Decrement inventory via P4's finalize_wishlist RPC -----
    let inventoryFinalized = true;
    const { error: rpcErr } = await supabase.rpc("finalize_wishlist", {
      p_wishlist_id: wishlist_id,
    });
    if (rpcErr) {
      inventoryFinalized = false;
      console.error("[escrow/release] finalize_wishlist RPC failed:", rpcErr);
    }

    // ---- 7. Respond -------------------------------------------------
    return ok({
      release_tx_hash: txHash,
      status: "released",
      inventory_finalized: inventoryFinalized,
      message: inventoryFinalized
        ? "Payment released to store. Thank you!"
        : "Payment released, but inventory decrement failed. P4 audit job will reconcile.",
    }, { requestId });
  } finally {
    await idemLock.release();
  }
}
