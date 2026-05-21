import { NextResponse } from "next/server";

import { err, ok } from "../../../lib/api/errors";
import { newRequestId } from "../../../lib/api/request-id";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight pre-flight check the UI hits on dashboard load so it can
 * disable chain-call buttons before they fail. Never throws.
 *
 *   200 → both legs are live.
 *   503 → at least one leg is unreachable. Body still parses; UI inspects
 *         `chain` and `db` fields to decide what to gate.
 *
 * Body shape (success and degraded both):
 *   { chain: "ok" | "unconfigured", db: "ok" | "err", request_id, contract_id? }
 */
export async function GET(req: Request): Promise<NextResponse> {
  const requestId = newRequestId(req);

  // --- chain config check (env presence only — no network round trip) ------
  const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID;
  const rpcUrl = process.env.STELLAR_RPC_URL;
  const secret = process.env.STELLAR_DEMO_SECRET_KEY;
  const chain: "ok" | "unconfigured" =
    contractId && rpcUrl && secret ? "ok" : "unconfigured";

  // --- db check: cheap head query -----------------------------------------
  let db: "ok" | "err" = "ok";
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("inventory")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (error) {
      console.error("[health] supabase probe failed:", error);
      db = "err";
    }
  } catch (e) {
    console.error("[health] supabase init failed:", e);
    db = "err";
  }

  const payload = {
    chain,
    db,
    ...(contractId ? { contract_id: contractId } : {}),
  };

  // 503 + Retry-After if anything degraded — UI can back off.
  if (chain === "unconfigured" || db === "err") {
    return err(503, "degraded", undefined, payload, {
      requestId,
      retryAfterSeconds: 15,
    });
  }
  return ok(payload, { requestId });
}
