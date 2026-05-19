import { strict as assert } from "node:assert";
import { Networks } from "@stellar/stellar-sdk";

import { NETWORK_PASSPHRASE, STELLAR_NETWORK } from "../lib/stellar/network";
import { getHorizonServer } from "../lib/stellar/client";

let passed = 0;
let failed = 0;

function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok   ${label}`);
    passed += 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  FAIL ${label}\n       ${message}`);
    failed += 1;
  }
}

console.log("lib/stellar/network");
check("STELLAR_NETWORK is 'testnet'", () => {
  assert.equal(STELLAR_NETWORK, "testnet");
});
check("NETWORK_PASSPHRASE equals Networks.TESTNET", () => {
  assert.equal(NETWORK_PASSPHRASE, Networks.TESTNET);
});

console.log("lib/stellar/client");
check("getHorizonServer() throws when env var is missing", () => {
  const saved = process.env.STELLAR_HORIZON_URL;
  delete process.env.STELLAR_HORIZON_URL;
  try {
    assert.throws(
      () => getHorizonServer(),
      /STELLAR_HORIZON_URL/,
      "expected throw mentioning the env var name",
    );
  } finally {
    if (saved !== undefined) process.env.STELLAR_HORIZON_URL = saved;
  }
});
check("getHorizonServer() returns a Horizon.Server when env is set", () => {
  process.env.STELLAR_HORIZON_URL = "https://horizon-testnet.stellar.org";
  const server = getHorizonServer();
  assert.ok(server, "expected a server instance");
  assert.equal(typeof (server as { ledgers: unknown }).ledgers, "function");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
