import { NextResponse } from "next/server";

import { requireUser } from "../../../../lib/api/auth";
import { err, ok, parseJsonBody } from "../../../../lib/api/errors";
import { beginIdempotent } from "../../../../lib/api/idempotency";
import { newRequestId } from "../../../../lib/api/request-id";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bills/add — family creates a new bill against a seeded biller.
 *
 * Body: { family_id, biller_id, account_number, amount_stroops, due_date }
 *
 * Auth: caller must be the family (role='family' AND caller.userId ===
 * family_id). We deliberately scope this to the family rather than the OFW —
 * the demo's framing is "family knows their bills, OFW funds them," so the
 * OFW-side BillsPanel stays read+pay only.
 *
 * Biller selection is constrained to existing rows in the `biller` table
 * (Meralco / Maynilad / etc., seeded by `npm run setup-billers`). We don't
 * accept a free-form biller_name here — testnet payouts need an existing
 * Friendbot-funded stellar_address, and creating one on the fly belongs in
 * a setup script, not a user-facing form.
 */

interface AddBillBody {
  family_id: string;
  biller_id: string;
  account_number: string;
  /** Stringified bigint — wire-safe across the JSON boundary. */
  amount_stroops: string;
  /** ISO YYYY-MM-DD. */
  due_date: string;
}

function validateBody(body: Record<string, unknown>): AddBillBody | string {
  const family_id = body.family_id;
  const biller_id = body.biller_id;
  const account_number = body.account_number;
  const amount_stroops = body.amount_stroops;
  const due_date = body.due_date;

  if (typeof family_id !== "string" || !family_id) return "family_id is required";
  if (typeof biller_id !== "string" || !biller_id) return "biller_id is required";
  if (typeof account_number !== "string" || !account_number.trim()) {
    return "account_number is required";
  }

  // Accept string or number, normalize to a positive bigint string.
  let parsedAmount: bigint;
  if (typeof amount_stroops === "string") {
    if (!/^\d+$/.test(amount_stroops)) return "amount_stroops must be a non-negative integer string";
    parsedAmount = BigInt(amount_stroops);
  } else if (typeof amount_stroops === "number" && Number.isFinite(amount_stroops)) {
    if (!Number.isInteger(amount_stroops) || amount_stroops < 0) {
      return "amount_stroops must be a non-negative integer";
    }
    parsedAmount = BigInt(amount_stroops);
  } else {
    return "amount_stroops is required (string or integer)";
  }
  if (parsedAmount <= 0n) return "amount_stroops must be positive";

  if (typeof due_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
    return "due_date must be an ISO date (YYYY-MM-DD)";
  }
  // Cheap sanity check: reject obvious garbage like 2026-13-40.
  const probe = new Date(`${due_date}T00:00:00Z`);
  if (Number.isNaN(probe.getTime()) || probe.toISOString().slice(0, 10) !== due_date) {
    return "due_date is not a real calendar date";
  }

  return {
    family_id,
    biller_id,
    account_number: account_number.trim(),
    amount_stroops: parsedAmount.toString(),
    due_date,
  };
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
  const { family_id, biller_id, account_number, amount_stroops, due_date } = validation;

  if (caller.userId !== family_id) {
    return err(403, "forbidden", "Authenticated user does not match family_id.", undefined, { requestId });
  }

  // ---- 3. Idempotency guard ---------------------------------------
  // (family, biller, account, amount, due) — same family adding the same
  // bill twice in flight (double-click on "Add bill") is blocked.
  const idemLock = beginIdempotent([
    "bills/add",
    family_id,
    biller_id,
    account_number,
    amount_stroops,
    due_date,
  ]);
  if (!idemLock) {
    return err(409, "in_flight", "An identical bill is already being created.", undefined, {
      requestId,
      retryAfterSeconds: 5,
    });
  }

  try {
    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (e) {
      console.error("[bills/add] Supabase admin init failed:", e);
      return err(500, "server_misconfigured", "Supabase service env vars missing.", undefined, { requestId });
    }

    // Caller must be a family member.
    const { data: callerProfile, error: cpErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", caller.userId)
      .maybeSingle();
    if (cpErr) {
      console.error("[bills/add] caller profile lookup failed:", cpErr);
      return err(500, "db_error", "Could not verify caller role.", undefined, { requestId });
    }
    if (callerProfile?.role !== "family") {
      return err(403, "wrong_role", "Only family callers can add bills.", {
        current_role: callerProfile?.role,
      }, { requestId });
    }

    // ---- 4. Verify the biller exists --------------------------------
    // FK would catch this too, but we want a clean 404 instead of a
    // generic 500 from the constraint violation.
    const { data: biller, error: bErr } = await supabase
      .from("biller")
      .select("id, name")
      .eq("id", biller_id)
      .maybeSingle();
    if (bErr) {
      console.error("[bills/add] biller lookup failed:", bErr);
      return err(500, "db_error", "Could not verify biller.", undefined, { requestId });
    }
    if (!biller) {
      return err(404, "biller_not_found", "That biller doesn't exist.", undefined, { requestId });
    }

    // ---- 5. Insert the bill -----------------------------------------
    const { data: inserted, error: insErr } = await supabase
      .from("bill")
      .insert({
        family_id,
        biller_id,
        account_number,
        amount_stroops,
        due_date,
        status: "due",
        autopay_enabled: false,
      })
      .select("id, created_at")
      .single();
    if (insErr || !inserted) {
      console.error("[bills/add] bill insert failed:", insErr);
      return err(500, "db_error", "Could not create the bill.", undefined, { requestId });
    }

    // ---- 6. Respond -------------------------------------------------
    return ok({
      bill_id: inserted.id as string,
      biller_id,
      biller_name: biller.name as string,
      account_number,
      amount_stroops,
      due_date,
      status: "due",
      created_at: inserted.created_at as string,
      message: `Bill for ${biller.name} added. The OFW can now pay it from /ofw.`,
    }, { requestId });
  } finally {
    idemLock.release();
  }
}
