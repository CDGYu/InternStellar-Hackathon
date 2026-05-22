/**
 * One-time biller setup for the demo.
 *
 *   npm run setup-billers
 *
 * Network-aware:
 *   - Testnet: generate a keypair per biller and Friendbot-fund it (10k XLM).
 *     The secret is discarded — we only ever pay TO the biller.
 *   - Mainnet/public: there is no Friendbot, so each biller account is created
 *     with a real `create_account` op signed by the organizer
 *     (STELLAR_DEMO_SECRET_KEY) and seeded with BILLER_STARTING_BALANCE_XLM
 *     (default 1.5 XLM). Because real XLM is involved, the generated SECRETS
 *     ARE SAVED (printed + written to .biller-secrets.local.json, gitignored)
 *     so the funds stay recoverable.
 *
 * Network is detected from STELLAR_NETWORK ("public"/"mainnet") or the Horizon
 * URL. Re-runnable: a biller whose stored address already exists on-chain is
 * left untouched (no double-funding).
 *
 * Mainnet run:
 *   1. In .env.local set STELLAR_NETWORK=public, the mainnet Horizon URL, and
 *      STELLAR_DEMO_SECRET_KEY = the organizer's MAINNET secret.
 *   2. npm run setup-billers
 *   3. Move the printed biller secrets into your password manager. The
 *      .biller-secrets.local.json backup is gitignored — don't commit it.
 *
 * Why a Node script rather than a SQL seed: accounts must exist on-chain
 * (Friendbot on testnet, create_account on mainnet) BEFORE they can receive a
 * payment op. We interleave key generation + funding + DB writes.
 */
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

// ---- 0. Env -------------------------------------------------------------
const localPath = resolve(process.cwd(), ".env.local");
if (existsSync(localPath)) loadEnv({ path: localPath });
loadEnv();

const FRIENDBOT_URL = "https://friendbot.stellar.org";
const HORIZON_URL =
  process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

const networkLabel = (process.env.STELLAR_NETWORK ?? "").toLowerCase();
const IS_MAINNET =
  networkLabel === "public" ||
  networkLabel === "mainnet" ||
  (HORIZON_URL.includes("horizon.stellar.org") &&
    !HORIZON_URL.includes("testnet"));

const NETWORK_PASSPHRASE = IS_MAINNET ? Networks.PUBLIC : Networks.TESTNET;
// Inclusion fee (max bid). The SDK BASE_FEE (100) is the network minimum and
// is routinely outbid on mainnet, so use a generous default there. It is a max
// bid — only the clearing fee is charged. Override with STELLAR_BASE_FEE.
const INCLUSION_FEE =
  process.env.STELLAR_BASE_FEE ?? (IS_MAINNET ? "1000000" : BASE_FEE);
const STARTING_BALANCE_XLM = process.env.BILLER_STARTING_BALANCE_XLM ?? "1.5";

// The Day-5 demo's single family (Cora).
const FAMILY_DEMO_ID = "22222222-2222-2222-2222-222222222222";

// Deterministic biller ids → safe to re-run. Demo bill amounts are small on
// mainnet (real XLM) and demo-scale on testnet.
const BILLERS = [
  {
    id: "c1111111-1111-1111-1111-111111111111",
    name: "Meralco",
    category: "electricity",
    demo_amount_stroops: IS_MAINNET ? 5_000_000n : 300_000_000n, // 0.5 vs 30 XLM
    demo_account_number: "4567-8901-2345",
    days_until_due: 5,
  },
  {
    id: "c2222222-2222-2222-2222-222222222222",
    name: "Maynilad",
    category: "water",
    demo_amount_stroops: IS_MAINNET ? 2_000_000n : 120_000_000n, // 0.2 vs 12 XLM
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

// Mainnet: create + fund a biller account with a real create_account op signed
// by the organizer. Returns the tx hash.
async function createAndFund(
  organizer: Keypair,
  destinationPub: string,
): Promise<string> {
  const server = new Horizon.Server(HORIZON_URL);
  const source = await server.loadAccount(organizer.publicKey());
  const tx = new TransactionBuilder(source, {
    fee: INCLUSION_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.createAccount({
        destination: destinationPub,
        startingBalance: STARTING_BALANCE_XLM,
      }),
    )
    .setTimeout(120)
    .build();
  tx.sign(organizer);
  const res = await server.submitTransaction(tx);
  return res.hash;
}

async function main() {
  const url = envOrDie("NEXT_PUBLIC_SUPABASE_URL");
  const key = envOrDie("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Organizer signer is only needed on mainnet (testnet uses Friendbot).
  let organizer: Keypair | null = null;
  if (IS_MAINNET) {
    organizer = Keypair.fromSecret(envOrDie("STELLAR_DEMO_SECRET_KEY"));
  }

  console.log(`InternStellar — bill setup (${IS_MAINNET ? "MAINNET" : "testnet"})`);
  console.log("──────────────────────────");

  const savedSecrets: { biller: string; public_key: string; secret: string }[] =
    [];

  for (const b of BILLERS) {
    console.log(`\n· ${b.name} (${b.category})`);

    const { data: existing } = await admin
      .from("biller")
      .select("id, stellar_address")
      .eq("id", b.id)
      .maybeSingle();

    let stellarAddress = existing?.stellar_address as string | undefined;

    // (Re)create the account if there's no stored address OR the stored one
    // isn't on the *current* network (e.g. a testnet address after a mainnet
    // cutover).
    if (!stellarAddress || !(await accountExists(stellarAddress))) {
      const kp = Keypair.random();
      stellarAddress = kp.publicKey();
      if (IS_MAINNET) {
        console.log(
          `  creating mainnet account ${stellarAddress.slice(0, 8)}… (+${STARTING_BALANCE_XLM} XLM)`,
        );
        const hash = await createAndFund(organizer!, stellarAddress);
        console.log(`  ✓ created + funded · tx ${hash.slice(0, 12)}…`);
        // Real XLM lives here — keep the secret so the funds are recoverable.
        savedSecrets.push({
          biller: b.name,
          public_key: stellarAddress,
          secret: kp.secret(),
        });
      } else {
        console.log(`  generating keypair → ${stellarAddress.slice(0, 8)}…`);
        await friendbot(stellarAddress);
        console.log(`  ✓ Friendbot-funded with 10,000 XLM`);
        // testnet: secret discarded — we only ever pay TO the biller.
      }
    } else {
      console.log(
        `  ✓ already configured → ${stellarAddress.slice(0, 8)}… (on chain)`,
      );
    }

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
      `  ✓ demo bill: ${b.demo_account_number} · ${(Number(b.demo_amount_stroops) / 10_000_000).toFixed(4)} XLM · due in ${b.days_until_due}d`,
    );
  }

  if (savedSecrets.length > 0) {
    const outPath = resolve(process.cwd(), ".biller-secrets.local.json");
    writeFileSync(outPath, JSON.stringify(savedSecrets, null, 2));
    console.log(
      "\n‼  SAVE THESE BILLER SECRETS — real XLM is recoverable only with them:",
    );
    for (const s of savedSecrets) {
      console.log(`   ${s.biller}: ${s.public_key}`);
      console.log(`       secret: ${s.secret}`);
    }
    console.log(
      `   Backup written to ${outPath} (gitignored). Move it to your password manager, then delete the file.`,
    );
  }

  console.log("\nDone. Sign in as the OFW and head to /ofw — Bills panel is live.");
}

main().catch((err) => {
  console.error("Setup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
