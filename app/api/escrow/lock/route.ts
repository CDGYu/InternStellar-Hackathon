import { NextResponse } from "next/server";

import { requireUser } from "../../../../lib/api/auth";
import { err, ok, parseJsonBody } from "../../../../lib/api/errors";
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

  // ---- 3. Load wishlist + items + family's stellar address --------
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error("[escrow/lock] Supabase admin client init failed:", e);
    return err(500, "server_misconfigured", "Supabase service env vars missing.");
  }

  const { data: wishlist, error: wErr } = await supabase
    .from("wishlist")
    .select("id, family_id, status, total_stroops, escrow_tx_hash, notes")
    .eq("id", wishlist_id)
    .eq("family_id", family_id)
    .maybeSingle();

  if (wErr) {
    console.error("[escrow/lock] wishlist load failed:", wErr);
    return err(500, "db_error", "Could not load wishlist.");
  }
  if (!wishlist) {
    return err(404, "wishlist_not_found");
  }
  if (wishlist.status !== "draft" && wishlist.status !== "pending_approval") {
    return err(409, "invalid_status", undefined, {
      current: wishlist.status,
      expected: ["draft", "pending_approval"],
    });
  }
  if (wishlist.escrow_tx_hash) {
    return err(409, "already_locked", "Wishlist already has an escrow tx hash.", {
      escrow_tx_hash: wishlist.escrow_tx_hash,
    });
  }

  const { data: items, error: iErr } = await supabase
    .from("wishlist_item")
    .select("quantity, price_stroops_at_add")
    .eq("wishlist_id", wishlist_id);

  if (iErr) {
    console.error("[escrow/lock] wishlist_item load failed:", iErr);
    return err(500, "db_error", "Could not load wishlist items.");
  }
  if (!items || items.length === 0) {
    return err(409, "wishlist_empty", "Wishlist has no items to escrow.");
  }

  const grocery_stroops = items.reduce<bigint>((sum, row) => {
    const price = BigInt(row.price_stroops_at_add as string | number);
    const qty = BigInt(row.quantity as number);
    return sum + price * qty;
  }, 0n);

  if (grocery_stroops <= 0n) {
    return err(409, "wishlist_total_zero", "Computed escrow amount is zero.");
  }

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("stellar_public_key")
    .eq("id", family_id)
    .maybeSingle();

  if (pErr) {
    console.error("[escrow/lock] profile load failed:", pErr);
    return err(500, "db_error", "Could not load family profile.");
  }
  if (!profile?.stellar_public_key) {
    return err(400, "family_address_not_set", "Family profile is missing stellar_public_key.");
  }

  // ---- 4. Call the contract ---------------------------------------
  let txHash: string;
  let escrowId: unknown;
  try {
    const result = await lockEscrow({
      familyAddress: profile.stellar_public_key,
      amountStroops: grocery_stroops,
    });
    txHash = result.txHash;
    escrowId = result.escrowId;
  } catch (e) {
    if (e instanceof ContractNotConfiguredError) {
      console.error("[escrow/lock]", e.message);
      return err(503, "contract_not_configured", e.message);
    }
    if (e instanceof ContractCallError) {
      console.error("[escrow/lock] contract call failed:", e.reason, e.detail);
      return err(400, "contract_error", e.reason);
    }
    console.error("[escrow/lock] unexpected contract error:", e);
    return err(500, "contract_error", "Unexpected error invoking contract.");
  }

  // ---- 5. Persist Supabase state (escrow_tx_hash + settlement) -----
  // Stash the escrow id alongside notes so release can read it back. See
  // DAY3-P2.md "Plan Revisions" #3 — this is temporary until P1 confirms
  // whether the tx hash is sufficient on its own.
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
    // Contract call succeeded but DB write didn't — surface loudly so P4 can
    // reconcile from on-chain state. We do NOT roll back the chain call.
    return err(500, "db_error", "Escrow locked on-chain but DB update failed. Reconcile from settlement.", {
      tx_hash: txHash,
    });
  }

  const { error: setErr } = await supabase.from("settlement").insert({
    wishlist_id,
    event_type: "lock",
    tx_hash: txHash,
    amount_stroops: grocery_stroops.toString(),
  });

  if (setErr) {
    console.error("[escrow/lock] settlement insert failed:", setErr);
    // Same posture: chain truth + wishlist row are good; we just lost the
    // audit row. Don't fail the request — log and continue. P4's audit job
    // can backfill from on-chain events.
  }

  // ---- 6. Respond -------------------------------------------------
  return ok({
    escrow_id: wishlist_id,
    tx_hash: txHash,
    status: "locked",
    amount_stroops: grocery_stroops.toString(),
    message: "Escrow locked successfully. Store can now prepare delivery.",
  });
}
