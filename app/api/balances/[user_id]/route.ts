import { NextResponse } from "next/server";

import { requireUser } from "../../../../lib/api/auth";
import { err, ok } from "../../../../lib/api/errors";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import {
  ContractCallError,
  ContractNotConfiguredError,
  getBalances,
} from "../../../../lib/stellar/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 1 XLM = 10_000_000 stroops. Format to at most 4 decimal places — anything
// smaller renders as "<0.0001 XLM" so the UI never has to show "0.0000003".
function stroopsToXlmDisplay(stroops: bigint): string {
  if (stroops === 0n) return "0.0000 XLM";
  const STROOPS_PER_XLM = 10_000_000n;
  const xlmWhole = stroops / STROOPS_PER_XLM;
  const xlmFrac = stroops % STROOPS_PER_XLM;
  if (xlmWhole === 0n && xlmFrac < 1000n) return "<0.0001 XLM";
  // 4 decimal places: scale fractional part to 4 digits.
  const fracStr = xlmFrac
    .toString()
    .padStart(7, "0")
    .slice(0, 4);
  return `${xlmWhole.toString()}.${fracStr} XLM`;
}

interface RouteContext {
  params: { user_id: string };
}

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  // ---- 1. Auth -----------------------------------------------------
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;

  const { user_id } = context.params;
  if (!user_id) {
    return err(400, "invalid_body", "user_id route param is required.");
  }
  if (caller.userId !== user_id) {
    // Could relax this for store users wanting to verify their grocery
    // bucket post-release, but for now stick to "you can only read your own".
    return err(403, "forbidden", "Authenticated user does not match user_id.");
  }

  // ---- 2. Load user's stellar address ------------------------------
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error("[balances] Supabase admin client init failed:", e);
    return err(500, "server_misconfigured", "Supabase service env vars missing.");
  }

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, role, stellar_public_key")
    .eq("id", user_id)
    .maybeSingle();

  if (pErr) {
    console.error("[balances] profile load failed:", pErr);
    return err(500, "db_error", "Could not load profile.");
  }
  if (!profile) {
    return err(404, "user_not_found", "Profile does not exist.");
  }
  if (!profile.stellar_public_key) {
    return err(400, "address_not_set", "Profile is missing stellar_public_key.");
  }

  // ---- 3. Call the contract ---------------------------------------
  let balances: { util: bigint; groc: bigint; emerg: bigint };
  try {
    balances = await getBalances({ userAddress: profile.stellar_public_key });
  } catch (e) {
    if (e instanceof ContractNotConfiguredError) {
      console.error("[balances]", e.message);
      return err(503, "contract_not_configured", e.message);
    }
    if (e instanceof ContractCallError) {
      console.error("[balances] contract call failed:", e.reason, e.detail);
      return err(400, "contract_error", e.reason);
    }
    console.error("[balances] unexpected contract error:", e);
    return err(500, "contract_error", "Unexpected error invoking contract.");
  }

  // ---- 4. Respond -------------------------------------------------
  return ok({
    user_id,
    role: profile.role,
    stellar_address: profile.stellar_public_key,
    balances_stroops: {
      utilities: balances.util.toString(),
      groceries: balances.groc.toString(),
      emergency: balances.emerg.toString(),
    },
    display: {
      utilities: stroopsToXlmDisplay(balances.util),
      groceries: stroopsToXlmDisplay(balances.groc),
      emergency: stroopsToXlmDisplay(balances.emerg),
    },
  });
}
