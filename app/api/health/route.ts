import type { NextResponse } from "next/server";

import { err, ok } from "../../../lib/api/errors";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight readiness probe the UI can hit before showing a chain-call
// button. Returns 200 when every dependency the demo needs is wired up,
// 503 (with `Retry-After: 5`) when any of them is missing.
//
// Shape:
//   200  { chain: "ok",            db: "ok"  }
//   503  { error: "unconfigured",  chain: ..., db: ..., reason: ... }
//
// "chain" reads env only (no live RPC ping) — checking RPC liveness on every
// health poll would burn the rate limit. The chain HTTP call is verified at
// invoke time by the existing `verify-stellar` script + the route-level
// 503 `contract_not_configured` fallback.

interface HealthReport {
  chain: "ok" | "unconfigured";
  db: "ok" | "unconfigured" | "err";
}

function checkChain(): HealthReport["chain"] {
  const hasRpc = !!process.env.STELLAR_RPC_URL;
  const hasContract = !!process.env.NEXT_PUBLIC_CONTRACT_ID;
  const hasSigner = !!process.env.STELLAR_DEMO_SECRET_KEY;
  return hasRpc && hasContract && hasSigner ? "ok" : "unconfigured";
}

async function checkDb(): Promise<HealthReport["db"]> {
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return "unconfigured";
  }
  // `head: true, count: "exact"` skips returning rows but still validates the
  // connection + service-role key. `profiles` is the smallest seeded table so
  // the round-trip stays cheap.
  const { error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (error) {
    console.error("[health] db probe failed:", error);
    return "err";
  }
  return "ok";
}

export async function GET(): Promise<NextResponse> {
  const chain = checkChain();
  const db = await checkDb();

  const allGood = chain === "ok" && db === "ok";
  if (allGood) {
    return ok({ chain, db });
  }

  // 503 so the UI can disable buttons + back off cleanly. Retry-After matches
  // the rest of the API's "transient" responses (lib/api/errors.ts).
  return err(
    503,
    "unconfigured",
    db === "err"
      ? "Database probe returned an error."
      : "One or more required environment variables are missing.",
    { chain, db },
    { retryAfterSeconds: 5 },
  );
}
