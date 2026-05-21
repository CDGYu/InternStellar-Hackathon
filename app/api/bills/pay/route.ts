import { NextResponse } from "next/server";

import { requireUser } from "../../../../lib/api/auth";
import { err, ok, parseJsonBody } from "../../../../lib/api/errors";
import { beginIdempotent } from "../../../../lib/api/idempotency";
import { newRequestId } from "../../../../lib/api/request-id";
import {
  BillPaymentError,
  BillsNotConfiguredError,
  payBill,
} from "../../../../lib/stellar/bills";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bills/pay — pay one bill.
 *
 * Body: { ofw_id, bill_id }
 *
 * Auth: caller must be the OFW (role='ofw'). The demo's OFW-on-behalf
 * posture mirrors /api/escrow/lock + release — any OFW can pay any
 * household's bill on testnet. Tighten when the schema gains
 * `family.sponsor_ofw_id`.
 *
 * Steps:
 *   1. Verify caller is the OFW (also matches body's ofw_id).
 *   2. Load the bill + biller's stellar_address.
 *   3. Refuse if the bill is already paid.
 *   4. Submit the Stellar payment op via lib/stellar/bills.payBill.
 *   5. Insert a bill_payment row.
 *   6. Flip bill.status to 'paid'.
 */

interface PayBillBody {
  ofw_id: string;
  bill_id: string;
}

function validateBody(body: Record<string, unknown>): PayBillBody | string {
  const ofw_id = body.ofw_id;
  const bill_id = body.bill_id;
  if (typeof ofw_id !== "string" || !ofw_id) return "ofw_id is required";
  if (typeof bill_id !== "string" || !bill_id) return "bill_id is required";
  return { ofw_id, bill_id };
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = newRequestId(req);

  // ---- 1. Auth ------------------------------------------------------
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;

  // ---- 2. Body + ownership check -----------------------------------
  const parsed = await parseJsonBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const validation = validateBody(parsed);
  if (typeof validation === "string") {
    return err(400, "invalid_body", validation, undefined, { requestId });
  }
  const { ofw_id, bill_id } = validation;

  if (caller.userId !== ofw_id) {
    return err(403, "forbidden", "Authenticated user does not match ofw_id.", undefined, { requestId });
  }

  // ---- 3. Idempotency guard ---------------------------------------
  // (ofw, bill) — same OFW paying the same bill twice in flight = blocked.
  const idemLock = await beginIdempotent(["bills/pay", ofw_id, bill_id]);
  if (!idemLock) {
    return err(409, "in_flight", "An identical payment is already being processed.", undefined, {
      requestId,
      retryAfterSeconds: 10,
    });
  }

  try {
    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (e) {
      console.error("[bills/pay] Supabase admin init failed:", e);
      return err(500, "server_misconfigured", "Supabase service env vars missing.", undefined, { requestId });
    }

    // Caller must be an OFW.
    const { data: callerProfile, error: cpErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", caller.userId)
      .maybeSingle();
    if (cpErr) {
      console.error("[bills/pay] caller profile lookup failed:", cpErr);
      return err(500, "db_error", "Could not verify caller role.", undefined, { requestId });
    }
    if (callerProfile?.role !== "ofw") {
      return err(403, "wrong_role", "Only OFW callers can pay bills.", {
        current_role: callerProfile?.role,
      }, { requestId });
    }

    // ---- 4. Load bill + biller --------------------------------------
    const { data: bill, error: bErr } = await supabase
      .from("bill")
      .select(
        "id, family_id, biller_id, amount_stroops, status, biller:biller_id (id, name, stellar_address)",
      )
      .eq("id", bill_id)
      .maybeSingle();
    if (bErr) {
      console.error("[bills/pay] bill load failed:", bErr);
      return err(500, "db_error", "Could not load bill.", undefined, { requestId });
    }
    if (!bill) return err(404, "bill_not_found", undefined, undefined, { requestId });
    if (bill.status === "paid") {
      return err(409, "already_paid", "This bill has already been settled.", undefined, { requestId });
    }

    const biller = Array.isArray((bill as any).biller)
      ? (bill as any).biller[0]
      : (bill as any).biller;
    if (!biller?.stellar_address) {
      return err(
        409,
        "biller_not_configured",
        "Biller's Stellar address is missing. Run `npm run setup-billers`.",
        { biller_id: bill.biller_id },
        { requestId },
      );
    }

    // ---- 5. Submit the Stellar payment ------------------------------
    let txHash: string;
    try {
      const result = await payBill({
        billerAddress: biller.stellar_address as string,
        amountStroops: BigInt(bill.amount_stroops as string | number),
      });
      txHash = result.txHash;
    } catch (e) {
      if (e instanceof BillsNotConfiguredError) {
        console.error("[bills/pay]", e.message);
        return err(503, "stellar_not_configured", e.message, undefined, {
          requestId,
          retryAfterSeconds: 30,
        });
      }
      if (e instanceof BillPaymentError) {
        console.error("[bills/pay] payment failed:", e.reason, e.detail);
        return err(400, "payment_error", e.reason, undefined, { requestId });
      }
      console.error("[bills/pay] unexpected error:", e);
      return err(500, "payment_error", "Unexpected error submitting payment.", undefined, { requestId });
    }

    // ---- 6. Append bill_payment row ---------------------------------
    const { data: payment, error: payErr } = await supabase
      .from("bill_payment")
      .insert({
        bill_id,
        paid_by: caller.userId,
        amount_stroops: bill.amount_stroops,
        tx_hash: txHash,
      })
      .select("id, paid_at")
      .single();
    if (payErr || !payment) {
      console.error("[bills/pay] bill_payment insert failed AFTER successful tx:", payErr);
      return err(
        500,
        "db_error",
        "Payment submitted on-chain but audit row failed. Reconcile from tx.",
        { tx_hash: txHash },
        { requestId },
      );
    }

    // ---- 7. Flip bill.status to paid --------------------------------
    const { error: updErr } = await supabase
      .from("bill")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", bill_id);
    if (updErr) {
      console.error("[bills/pay] bill status update failed:", updErr);
      return err(
        500,
        "db_error",
        "Payment recorded but bill status didn't flip. Reconcile from bill_payment.",
        { tx_hash: txHash, bill_payment_id: payment.id },
        { requestId },
      );
    }

    // ---- 8. Respond -------------------------------------------------
    return ok({
      tx_hash: txHash,
      bill_id,
      biller_name: biller.name as string,
      amount_stroops: bill.amount_stroops?.toString() ?? "0",
      paid_at: payment.paid_at as string,
      message: `Bill paid to ${biller.name}.`,
    }, { requestId });
  } finally {
    await idemLock.release();
  }
}
