/**
 * One-time biller setup for the demo.
 *
 *   npm run setup-billers
 *
 * What it does:
 *   1. Loads .env.local (.env fallback) for Supabase service_role + family id.
 *   2. For each demo biller (Meralco, Maynilad), either:
 *        a) Uses the existing biller row's stellar_address if non-empty, or
 *        b) Generates a fresh testnet keypair, Friendbots it for 10k XLM,
 *           and upserts the biller row with the new pubkey.
 *   3. Creates two demo bills for the family (Cora) — one per biller —
 *      with realistic-looking account numbers and amounts.
 *
 * Re-runnable: each step is idempotent. Already-funded billers don't get
 * re-Friendbotted. Demo bills are upserted by a deterministic id so the
 * second run doesn't pile up duplicates.
 *
 * Why this is a Node script rather than a SQL seed: testnet accounts have
 * to be Friendbot-funded *before* they can receive a payment op. We need
 * to interleave key generation + funding + DB writes, which is awkward
 * to express in pure SQL.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { Keypair } from "@stellar/stellar-sdk";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

// ---- 0. Env -------------------------------------------------------------
const localPath = resolve(process.cwd(), ".env.local");
if (existsSync(localPath)) loadEnv({ path: localPath });
loadEnv();

const FRIENDBOT_URL = "https://friendbot.stellar.org";
const HORIZON_URL =
  process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

// The Day-5 demo's single family (Cora). Same constant as the OFW page —
// kept here too so the script is standalone-runnable.
const FAMILY_DEMO_ID = "22222222-2222-2222-2222-222222222222";

// Deterministic biller ids → safe to re-run the script without dup rows.
const BILLERS = [
  {
    id: "c1111111-1111-1111-1111-111111111111",
    name: "Meralco",
    category: "electricity",
    // ~30 XLM ≈ a small monthly electric bill at demo scale
    demo_amount_stroops: 300_000_000n,
    demo_account_number: "4567-8901-2345",
    days_until_due: 5,
  },
  {
    id: "c2222222-2222-2222-2222-222222222222",
    name: "Maynilad",
    category: "water",
    demo_amount_stroops: 120_000_000n, // ~12 XLM
    demo_account_number: "1234-5678",
    days_until_due: 10,
  },
] as const;

// Deterministic bill ids so re-runs upsert in place.
const BILL_IDS = {
  Meralco: "d1111111-1111-1111-1111-111111111111",
  Maynilad: "d2222222-2222-2222-2222-222222222222",
} as const;

function envOrDie(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ Missing required env var: ${name}`);
    console.error(`  Copy .env.example to .env.local and fill it in.`);
    process.exit(1);
  }
  return v;
}

async function friendbot(pub: string): Promise<void> {
  const res = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(pub)}`);
  if (res.ok) return;
  const body = await res.text();
  if (body.includes("createAccountAlreadyExist")) return; // fine
  throw new Error(`Friendbot HTTP ${res.status}: ${body.slice(0, 200)}`);
}

async function accountExists(pub: string): Promise<boolean> {
  try {
    const r = await fetch(`${HORIZON_URL}/accounts/${pub}`);
    return r.ok;
  } catch {
    return false;
  }
}

async function main() {
  const url = envOrDie("NEXT_PUBLIC_SUPABASE_URL");
  const key = envOrDie("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("InternStellar — bill setup");
  console.log("──────────────────────────");

  for (const b of BILLERS) {
    console.log(`\n· ${b.name} (${b.category})`);

    // 1) Find existing biller row, if any.
    const { data: existing } = await admin
      .from("biller")
      .select("id, stellar_address")
      .eq("id", b.id)
      .maybeSingle();

    let stellarAddress = existing?.stellar_address as string | undefined;

    // 2) Generate + fund a keypair if none stored OR the stored account
    //    isn't on chain yet (e.g. testnet wiped, db restored from a
    //    different env).
    if (!stellarAddress || !(await accountExists(stellarAddress))) {
      const kp = Keypair.random();
      stellarAddress = kp.publicKey();
      console.log(`  generating new keypair → ${stellarAddress.slice(0, 8)}…`);
      await friendbot(stellarAddress);
      console.log(`  ✓ Friendbot-funded with 10,000 XLM`);
      // We deliberately don't save the SECRET key anywhere — InternStellar
      // doesn't need to spend FROM the biller account, only TO it.
    } else {
      console.log(`  ✓ already configured → ${stellarAddress.slice(0, 8)}… (funded on chain)`);
    }

    // 3) Upsert the biller row.
    const { error: upErr } = await admin.from("biller").upsert(
      {
        id: b.id,
        name: b.name,
        category: b.category,
        stellar_address: stellarAddress,
      },
      { onConflict: "id" },
    );
    if (upErr) {
      console.error(`  ✗ biller upsert failed:`, upErr.message);
      process.exit(1);
    }

    // 4) Upsert a demo bill for the family.
    const due = new Date();
    due.setDate(due.getDate() + b.days_until_due);
    const billId = BILL_IDS[b.name as keyof typeof BILL_IDS];

    const { error: billErr } = await admin.from("bill").upsert(
      {
        id: billId,
        family_id: FAMILY_DEMO_ID,
        biller_id: b.id,
        account_number: b.demo_account_number,
        amount_stroops: b.demo_amount_stroops.toString(),
        due_date: due.toISOString().slice(0, 10),
        status: "due",
        autopay_enabled: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (billErr) {
      console.error(`  ✗ bill upsert failed:`, billErr.message);
      process.exit(1);
    }
    console.log(
      `  ✓ demo bill: ${b.demo_account_number} · ${(Number(b.demo_amount_stroops) / 10_000_000).toFixed(2)} XLM · due in ${b.days_until_due}d`,
    );
  }

  console.log("\nDone. Sign in as the OFW and head to /ofw — Bills panel is live.");
}

main().catch((err) => {
  console.error("Setup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
