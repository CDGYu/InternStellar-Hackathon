/**
 * Wire-up smoke test for the Day 3-4 escrow + deposit + balances layer.
 *
 * Verifies modules load and that the contract functions THROW the right
 * errors when env / args are wrong. Does NOT submit a real transaction
 * (that's the operator's end-to-end gate, not a unit test).
 *
 * Run:  npm run test:escrow-wiring
 */
import { strict as assert } from "node:assert";

import {
  ContractCallError,
  ContractNotConfiguredError,
  depositAndSplit,
  lockEscrow,
} from "../lib/stellar/contract";

let passed = 0;
let failed = 0;

async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ok   ${label}`);
    passed += 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  FAIL ${label}\n       ${message}`);
    failed += 1;
  }
}

function withEnv() {
  process.env.STELLAR_RPC_URL = "https://soroban-testnet.stellar.org";
  process.env.NEXT_PUBLIC_CONTRACT_ID =
    process.env.NEXT_PUBLIC_CONTRACT_ID ?? "C".padEnd(56, "A");
  process.env.STELLAR_DEMO_SECRET_KEY =
    process.env.STELLAR_DEMO_SECRET_KEY ?? "S".padEnd(56, "A");
}

async function main() {
  console.log("lib/stellar/contract");

  await check("lockEscrow rejects amountStroops <= 0", async () => {
    withEnv();
    await assert.rejects(
      () =>
        lockEscrow({
          familyAddress: "G".padEnd(56, "A"),
          storeAddress: "G".padEnd(56, "B"),
          amountStroops: 0n,
        }),
      ContractCallError,
    );
  });

  await check("lockEscrow rejects family == store (no round trip)", async () => {
    withEnv();
    const same = "G".padEnd(56, "C");
    await assert.rejects(
      () =>
        lockEscrow({
          familyAddress: same,
          storeAddress: same,
          amountStroops: 100n,
        }),
      (e: unknown) => {
        return (
          e instanceof ContractCallError &&
          e.reason === "family cannot be store"
        );
      },
    );
  });

  await check(
    "lockEscrow throws ContractNotConfiguredError when contract id missing",
    async () => {
      const savedId = process.env.NEXT_PUBLIC_CONTRACT_ID;
      const savedSec = process.env.STELLAR_DEMO_SECRET_KEY;
      delete process.env.NEXT_PUBLIC_CONTRACT_ID;
      delete process.env.STELLAR_DEMO_SECRET_KEY;
      try {
        await assert.rejects(
          () =>
            lockEscrow({
              familyAddress: "G".padEnd(56, "A"),
              storeAddress: "G".padEnd(56, "B"),
              amountStroops: 100n,
            }),
          ContractNotConfiguredError,
        );
      } finally {
        if (savedId !== undefined) process.env.NEXT_PUBLIC_CONTRACT_ID = savedId;
        if (savedSec !== undefined) process.env.STELLAR_DEMO_SECRET_KEY = savedSec;
      }
    },
  );

  await check("depositAndSplit rejects pct sum != 100", async () => {
    withEnv();
    await assert.rejects(
      () =>
        depositAndSplit({
          fromAddress: "G".padEnd(56, "A"),
          totalStroops: 10_000_000n,
          pctUtil: 50,
          pctGroc: 30,
          pctEmerg: 10, // sums to 90
        }),
      (e: unknown) => {
        return (
          e instanceof ContractCallError &&
          e.reason === "percentages must sum to 100"
        );
      },
    );
  });

  await check("depositAndSplit rejects totalStroops <= 0", async () => {
    withEnv();
    await assert.rejects(
      () =>
        depositAndSplit({
          fromAddress: "G".padEnd(56, "A"),
          totalStroops: 0n,
          pctUtil: 50,
          pctGroc: 30,
          pctEmerg: 20,
        }),
      ContractCallError,
    );
  });

  console.log("lib/api/errors");
  await check("err() returns NextResponse with correct shape", async () => {
    const { err } = await import("../lib/api/errors");
    const res = err(404, "wishlist_not_found");
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.deepEqual(body, { error: "wishlist_not_found" });
  });

  console.log("\nroute handlers compile");
  await check("app/api/escrow/lock/route exports POST", async () => {
    const mod = await import("../app/api/escrow/lock/route");
    assert.equal(typeof mod.POST, "function");
  });
  await check("app/api/escrow/release/route exports POST", async () => {
    const mod = await import("../app/api/escrow/release/route");
    assert.equal(typeof mod.POST, "function");
  });
  await check("app/api/wishlist/route exports POST", async () => {
    const mod = await import("../app/api/wishlist/route");
    assert.equal(typeof mod.POST, "function");
  });
  await check("app/api/deposit/route exports POST", async () => {
    const mod = await import("../app/api/deposit/route");
    assert.equal(typeof mod.POST, "function");
  });
  await check("app/api/balances/[user_id]/route exports GET", async () => {
    const mod = await import("../app/api/balances/[user_id]/route");
    assert.equal(typeof mod.GET, "function");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
