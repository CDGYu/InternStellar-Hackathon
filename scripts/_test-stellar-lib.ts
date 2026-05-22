import { strict as assert } from "node:assert";
import { Networks } from "@stellar/stellar-sdk";

import {
  NETWORK_PASSPHRASE,
  STELLAR_EXPLORER_BASE,
  STELLAR_NETWORK,
  resolveNetwork,
} from "../lib/stellar/network";
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

// Default branch — the cached constants reflect whatever env was present when
// the module loaded. In the dev shell neither var is set, so the module
// should fall back to testnet to keep existing rehearsal scripts working.
console.log("lib/stellar/network — module defaults (no env set)");
check("STELLAR_NETWORK defaults to 'testnet'", () => {
  assert.equal(STELLAR_NETWORK, "testnet");
});
check("NETWORK_PASSPHRASE defaults to Networks.TESTNET", () => {
  assert.equal(NETWORK_PASSPHRASE, Networks.TESTNET);
});
check("STELLAR_EXPLORER_BASE defaults to testnet explorer", () => {
  assert.equal(STELLAR_EXPLORER_BASE, "https://stellar.expert/explorer/testnet");
});

// Mainnet branch — exercised through resolveNetwork() with a synthetic env so
// the test does not have to spawn a subprocess just to invalidate the cached
// module-level constants.
console.log("lib/stellar/network — resolveNetwork() with synthetic envs");
check("STELLAR_NETWORK=public → mainnet label + passphrase + explorer", () => {
  const r = resolveNetwork({ STELLAR_NETWORK: "public" });
  assert.equal(r.label, "public");
  assert.equal(r.passphrase, Networks.PUBLIC);
});
check("STELLAR_NETWORK=mainnet (alias) also resolves to public", () => {
  const r = resolveNetwork({ STELLAR_NETWORK: "mainnet" });
  assert.equal(r.label, "public");
  assert.equal(r.passphrase, Networks.PUBLIC);
});
check("Empty env falls back to testnet", () => {
  const r = resolveNetwork({});
  assert.equal(r.label, "testnet");
  assert.equal(r.passphrase, Networks.TESTNET);
});
check("Explicit STELLAR_NETWORK_PASSPHRASE wins over STELLAR_NETWORK", () => {
  const r = resolveNetwork({
    STELLAR_NETWORK: "testnet",
    STELLAR_NETWORK_PASSPHRASE: Networks.PUBLIC,
  });
  assert.equal(r.label, "public");
  assert.equal(r.passphrase, Networks.PUBLIC);
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
