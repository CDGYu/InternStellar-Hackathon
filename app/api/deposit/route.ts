import { NextResponse } from "next/server";

import { requireUser } from "../../../lib/api/auth";
import { err, ok, parseJsonBody } from "../../../lib/api/errors";
import { beginIdempotent } from "../../../lib/api/idempotency";
import { newRequestId } from "../../../lib/api/request-id";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import {
  ContractCallError,
  ContractNotConfiguredError,
  depositAndSplit,
} from "../../../lib/stellar/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DepositBody {
  ofw_id: string;
  total_stroops: string;
  pct_util: number;
  pct_groc: number;
  pct_emerg: number;
}

function validateBody(body: Record<string, unknown>): DepositBody | string {
  const ofw_id = body.ofw_id;
  const total_stroops = body.total_stroops;
  const pct_util = body.pct_util;
  const pct_groc = body.pct_groc;
  const pct_emerg = body.pct_emerg;

  if (typeof ofw_id !== "string" || !ofw_id) return "ofw_id is required";

  let parsedTotal: bigint;
  if (typeof total_stroops === "string") {
    if (!/^\d+$/.test(total_stroops)) return "total_stroops must be a non-negative integer string";
    parsedTotal = BigInt(total_stroops);
  } else if (typeof total_stroops === "number" && Number.isFinite(total_stroops)) {
    if (!Number.isInteger(total_stroops) || total_stroops < 0) {
      return "total_stroops must be a non-negative integer";
    }
    parsedTotal = BigInt(total_stroops);
  } else {
    return "total_stroops is required (string or integer)";
  }
  if (parsedTotal <= 0n) return "total_stroops must be positive";

  if (
    typeof pct_util !== "number" || !Number.isInteger(pct_util) || pct_util < 0 ||
    typeof pct_groc !== "number" || !Number.isInteger(pct_groc) || pct_groc < 0 ||
    typeof pct_emerg !== "number" || !Number.isInteger(pct_emerg) || pct_emerg < 0
  ) {
    return "pct_util, pct_groc, pct_emerg must be non-negative integers";
  }
  if (pct_util + pct_groc + pct_emerg !== 100) {
    return "pct_util + pct_groc + pct_emerg must equal 100";
  }

  return {
    ofw_id,
    total_stroops: parsedTotal.toString(),
    pct_util,
    pct_groc,
    pct_emerg,
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
  const { ofw_id, total_stroops, pct_util, pct_groc, pct_emerg } = validation;

  if (caller.userId !== ofw_id) {
    return err(403, "forbidden", "Authenticated user does not match ofw_id.", undefined, { requestId });
  }

  // ---- 3. Idempotency guard ---------------------------------------
  // Keys on (ofw, total) — the same OFW sending the same exact amount within
  // the 60s TTL is treated as a double-submission. If the OFW intentionally
  // wants to deposit the same amount twice they can wait out the TTL.
  const idemLock = await beginIdempotent(["deposit", ofw_id, total_stroops]);
  if (!idemLock) {
    return err(409, "in_flight", "An identical deposit is already being processed.", undefined, {
      requestId,
      retryAfterSeconds: 10,
    });
  }

  try {
    // ---- 4. Load OFW's stellar address ------------------------------
    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (e) {
      console.error("[deposit] Supabase admin client init failed:", e);
      return err(500, "server_misconfigured", "Supabase service env vars missing.", undefined, { requestId });
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, role, stellar_public_key")
      .eq("id", ofw_id)
      .maybeSingle();

    if (pErr) {
      console.error("[deposit] profile load failed:", pErr);
      return err(500, "db_error", "Could not load OFW profile.", undefined, { requestId });
    }
    if (!profile) {
      return err(404, "ofw_not_found", "OFW profile does not exist.", undefined, { requestId });
    }
    if (profile.role !== "ofw") {
      return err(403, "wrong_role", "Only OFW profiles can deposit.", {
        current_role: profile.role,
      }, { requestId });
    }
    if (!profile.stellar_public_key) {
      return err(400, "ofw_address_not_set", "OFW profile is missing stellar_public_key.", undefined, { requestId });
    }

    // ---- 5. Call the contract ---------------------------------------
    let txHash: string;
    let shares: { util: bigint; groc: bigint; emerg: bigint };
    try {
      const result = await depositAndSplit({
        fromAddress: profile.stellar_public_key,
        totalStroops: BigInt(total_stroops),
        pctUtil: pct_util,
        pctGroc: pct_groc,
        pctEmerg: pct_emerg,
      });
      txHash = result.txHash;
      shares = result.shares;
    } catch (e) {
      if (e instanceof ContractNotConfiguredError) {
        console.error("[deposit]", e.message);
        return err(503, "contract_not_configured", e.message, undefined, {
          requestId,
          retryAfterSeconds: 30,
        });
      }
      if (e instanceof ContractCallError) {
        console.error("[deposit] contract call failed:", e.reason, e.detail);
        return err(400, "contract_error", e.reason, undefined, { requestId });
      }
      console.error("[deposit] unexpected contract error:", e);
      return err(500, "contract_error", "Unexpected error invoking contract.", undefined, { requestId });
    }

    // ---- 6. Respond -------------------------------------------------
    return ok({
      tx_hash: txHash,
      shares: {
        util_stroops: shares.util.toString(),
        groc_stroops: shares.groc.toString(),
        emerg_stroops: shares.emerg.toString(),
      },
      total_stroops,
      percentages: { util: pct_util, groc: pct_groc, emerg: pct_emerg },
      message: "Deposit split successfully across utilities, groceries, and emergency buckets.",
    }, { requestId });
  } finally {
    await idemLock.release();
  }
}
