import { NextResponse } from "next/server";

import { requireUser } from "../../../../lib/api/auth";
import { err, ok, parseJsonBody } from "../../../../lib/api/errors";
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

// Pulls back whatever lockEscrow stashed in the wishlist.notes column. See
// the "__escrow_ret__:..." tag added by /api/escrow/lock. If nothing tagged,
// we fall back to the escrow_tx_hash itself — P1 may use either.
function extractStashedEscrowId(notes: string | null): unknown {
  if (!notes) return null;
  const match = notes.match(/__escrow_ret__:(.+)$/m);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return match[1].trim();
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  // ---- 1. Auth -----------------------------------------------------
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;

  // ---- 2. Parse + validate body -----------------------------------
  const parsed = await parseJsonBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const validation = validateBody(parsed);
  if (typeof validation === "string") {
    return err(400, "invalid_body", validation);
  }
  const { family_id, wishlist_id } = validation;

  if (caller.userId !== family_id) {
    return err(403, "forbidden", "Authenticated user does not match family_id.");
  }

  // ---- 3. Load wishlist (must be 'delivered') ---------------------
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error("[escrow/release] Supabase admin client init failed:", e);
    return err(500, "server_misconfigured", "Supabase service env vars missing.");
  }

  const { data: wishlist, error: wErr } = await supabase
    .from("wishlist")
    .select("id, family_id, status, total_stroops, escrow_tx_hash, release_tx_hash, notes")
    .eq("id", wishlist_id)
    .eq("family_id", family_id)
    .maybeSingle();

  if (wErr) {
    console.error("[escrow/release] wishlist load failed:", wErr);
    return err(500, "db_error", "Could not load wishlist.");
  }
  if (!wishlist) {
    return err(404, "wishlist_not_found");
  }
  if (wishlist.status !== "delivered") {
    return err(409, "invalid_status", undefined, {
      current: wishlist.status,
      expected: "delivered",
    });
  }
  if (wishlist.release_tx_hash) {
    return err(409, "already_released", "Wishlist already has a release tx hash.", {
      release_tx_hash: wishlist.release_tx_hash,
    });
  }
  if (!wishlist.escrow_tx_hash) {
    return err(409, "no_escrow", "Wishlist is marked delivered but has no escrow tx hash.");
  }

  // ---- 4. Call the contract ---------------------------------------
  const stashed = extractStashedEscrowId(wishlist.notes);
  const escrowId = stashed ?? wishlist.escrow_tx_hash;

  let txHash: string;
  try {
    const result = await releaseEscrow({ escrowId });
    txHash = result.txHash;
  } catch (e) {
    if (e instanceof ContractNotConfiguredError) {
      console.error("[escrow/release]", e.message);
      return err(503, "contract_not_configured", e.message);
    }
    if (e instanceof ContractCallError) {
      console.error("[escrow/release] contract call failed:", e.reason, e.detail);
      return err(400, "contract_error", e.reason);
    }
    console.error("[escrow/release] unexpected contract error:", e);
    return err(500, "contract_error", "Unexpected error invoking contract.");
  }

  // ---- 5. Persist Supabase state ---------------------------------
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
    });
  }

  const { error: setErr } = await supabase.from("settlement").insert({
    wishlist_id,
    event_type: "release",
    tx_hash: txHash,
    amount_stroops: (wishlist.total_stroops ?? 0).toString(),
  });

  if (setErr) {
    console.error("[escrow/release] settlement insert failed:", setErr);
    // Same posture as lock: don't fail the request. P4's audit job can backfill.
  }

  // ---- 5b. Decrement inventory via P4's finalize_wishlist RPC -----
  // Idempotency is enforced by the already_released guard above — if we got
  // here, this is the first (and only) release call for this wishlist. The
  // RPC clamps at zero so even out-of-sync demo data can't go negative.
  let inventoryFinalized = true;
  const { error: rpcErr } = await supabase.rpc("finalize_wishlist", {
    p_wishlist_id: wishlist_id,
  });
  if (rpcErr) {
    inventoryFinalized = false;
    console.error("[escrow/release] finalize_wishlist RPC failed:", rpcErr);
    // Chain truth + wishlist row + settlement are correct; we just couldn't
    // decrement inventory. Surface in the response so P3 can show a soft
    // warning, but DO NOT fail the request — funds have already moved.
  }

  // ---- 6. Respond -------------------------------------------------
  return ok({
    release_tx_hash: txHash,
    status: "released",
    inventory_finalized: inventoryFinalized,
    message: inventoryFinalized
      ? "Payment released to store. Thank you!"
      : "Payment released, but inventory decrement failed. P4 audit job will reconcile.",
  });
}
