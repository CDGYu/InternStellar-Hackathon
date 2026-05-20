/**
 * Demo reset runner — Day 5 rehearsal companion.
 *
 *   npm run reset           # DB reset + best-effort Friendbot top-up
 *   npm run reset:db-only   # DB reset only (skips Friendbot)
 *
 * What it does:
 *   1. Loads `.env.local` (falling back to `.env`).
 *   2. Calls the `reset_demo()` Postgres RPC via the Supabase service-role
 *      key. That RPC is the one defined in db/reset.sql — it truncates
 *      settlement/wishlist_item/wishlist and resets inventory.stock = 50.
 *   3. (Unless --db-only) checks the Stellar demo signer's balance and
 *      fires Friendbot if the account doesn't exist on testnet.
 *
 * Reliability target: must succeed three runs in a row without manual
 * intervention. The reset_demo() RPC is idempotent by design; the
 * Friendbot step is best-effort and never fails the whole script — a
 * funded existing account just logs "already funded" and continues.
 *
 * Exit codes: 0 on success, 1 on a hard failure (env missing, RPC error).
 * Friendbot complaints are warnings, not failures.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { Keypair } from "@stellar/stellar-sdk";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

// ---- 1. Env --------------------------------------------------------------
// Load .env.local first (where the rotated keys live) and let .env fill
// in any keys it didn't define. dotenv does NOT overwrite existing process
// env, so the precedence is: existing > .env.local > .env.
const localPath = resolve(process.cwd(), ".env.local");
if (existsSync(localPath)) {
  loadEnv({ path: localPath });
}
loadEnv(); // .env fallback (no-op if file missing)

const FRIENDBOT_URL = "https://friendbot.stellar.org";
const HORIZON_URL =
  process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const MIN_BALANCE_XLM = 100; // below this we'll try to top up

function envOrDie(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ Missing required env var: ${name}`);
    console.error(`  Copy .env.example to .env.local and fill it in.`);
    process.exit(1);
  }
  return v;
}

// ---- 2. DB reset ---------------------------------------------------------
async function resetDb(): Promise<void> {
  const url = envOrDie("NEXT_PUBLIC_SUPABASE_URL");
  const key = envOrDie("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const start = Date.now();
  const { error } = await admin.rpc("reset_demo");
  const ms = Date.now() - start;

  if (error) {
    console.error(`✗ reset_demo() RPC failed: ${error.message}`);
    if (error.message.includes("function") && error.message.includes("does not exist")) {
      console.error(`  Run db/reset.sql in the Supabase SQL editor to install the function.`);
    }
    process.exit(1);
  }

  console.log(`  ✓ DB reset in ${ms}ms — settlement/wishlist_item/wishlist truncated, inventory.stock = 50`);
}

// ---- 3. Stellar demo signer top-up (best-effort) -------------------------
async function topUpDemoSigner(): Promise<void> {
  const secret = process.env.STELLAR_DEMO_SECRET_KEY;
  if (!secret) {
    console.log("  · STELLAR_DEMO_SECRET_KEY not set — skipping Friendbot top-up");
    return;
  }

  let kp;
  try {
    kp = Keypair.fromSecret(secret);
  } catch {
    console.log("  · STELLAR_DEMO_SECRET_KEY is malformed — skipping Friendbot top-up");
    return;
  }
  const pub = kp.publicKey();

  // Probe Horizon first. If the account exists and has enough XLM, we're
  // done — Friendbot won't top up an existing account anyway (it returns
  // createAccountAlreadyExist), so calling it would be wasted work.
  let exists = false;
  try {
    const res = await fetch(`${HORIZON_URL}/accounts/${pub}`);
    if (res.ok) {
      exists = true;
      const acct = (await res.json()) as { balances?: Array<{ asset_type: string; balance: string }> };
      const native = acct.balances?.find((b) => b.asset_type === "native");
      const balance = native ? parseFloat(native.balance) : 0;
      if (balance >= MIN_BALANCE_XLM) {
        console.log(`  ✓ Demo signer ${pub.slice(0, 8)}… already funded (${balance.toFixed(2)} XLM)`);
        return;
      }
      console.log(`  · Demo signer balance low (${balance.toFixed(2)} XLM); attempting Friendbot…`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  · Horizon check failed (${msg}); attempting Friendbot anyway`);
  }

  if (exists) {
    // Friendbot can't help here — surface the manual path.
    console.log(`  ! Account exists but balance is low. Friendbot cannot top up existing testnet accounts.`);
    console.log(`    Either:`);
    console.log(`      (a) Generate a new keypair via \`npm run fund-test-account\` and update STELLAR_DEMO_SECRET_KEY.`);
    console.log(`      (b) Send XLM to ${pub} from another funded testnet account.`);
    return;
  }

  // Account doesn't exist on testnet — Friendbot can create + fund.
  try {
    const res = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(pub)}`);
    if (res.ok) {
      console.log(`  ✓ Friendbot funded ${pub.slice(0, 8)}… with 10,000 XLM (testnet)`);
      return;
    }
    const body = await res.text();
    console.log(`  ! Friendbot HTTP ${res.status}: ${body.slice(0, 200)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ! Friendbot request failed: ${msg}`);
  }
}

// ---- 4. Main -------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const dbOnly = args.includes("--db-only");

  console.log("InternStellar — demo reset");
  console.log("───────────────────────────");
  await resetDb();
  if (!dbOnly) {
    await topUpDemoSigner();
  } else {
    console.log("  · --db-only flag set; skipping Friendbot");
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error("Reset failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
