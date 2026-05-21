/**
 * Regression test: every error response must be human-readable. No SDK
 * internals, no `node_modules/` paths, no `TypeError:`, no JS stack frames.
 *
 * Assumes the dev server is running on http://localhost:3000.
 *   $ npm run dev
 *   (in a separate terminal:)
 *   $ npm run test:no-leaks
 *
 * Override base URL via env:
 *   HEALTH_BASE_URL=http://localhost:3001 npm run test:no-leaks
 */
import { strict as assert } from "node:assert";

const BASE = process.env.HEALTH_BASE_URL ?? "http://localhost:3000";

// Patterns that, if found in any response body, fail the test.
// Each pattern is paired with a label so failures point at the leak class.
const LEAK_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/at\s+\S+\s+\(.*:\d+:\d+\)/, "stack frame: 'at fn (file:line:col)'"],
  [/TypeError:/i, "TypeError name"],
  [/ReferenceError:/i, "ReferenceError name"],
  [/SyntaxError:/i, "SyntaxError name"],
  [/node_modules[\/\\]/, "node_modules path"],
  [/[A-Z]:\\Users\\/, "absolute Windows path"],
  [/\/Users\/[^/]+\//, "absolute macOS path"],
  [/<!DOCTYPE html>/i, "Next.js error HTML page (should be JSON)"],
];

interface Probe {
  label: string;
  method: "GET" | "POST";
  path: string;
  headers?: Record<string, string>;
  body?: string;
}

// All probes are designed to PRODUCE an error response (or be the only
// always-OK route). We're auditing that the error response stays clean.
const PROBES: Probe[] = [
  // Auth probes — every POST/GET that requires Bearer should 401 cleanly.
  { label: "wishlist no-auth", method: "POST", path: "/api/wishlist", headers: { "content-type": "application/json" }, body: "{}" },
  { label: "deposit no-auth", method: "POST", path: "/api/deposit", headers: { "content-type": "application/json" }, body: "{}" },
  { label: "escrow/lock no-auth", method: "POST", path: "/api/escrow/lock", headers: { "content-type": "application/json" }, body: "{}" },
  { label: "escrow/release no-auth", method: "POST", path: "/api/escrow/release", headers: { "content-type": "application/json" }, body: "{}" },
  { label: "balances no-auth", method: "GET", path: "/api/balances/22222222-2222-2222-2222-222222222222" },
  { label: "bills/pay no-auth", method: "POST", path: "/api/bills/pay", headers: { "content-type": "application/json" }, body: "{}" },

  // Bad Bearer — should 401, never 500.
  { label: "wishlist bad-bearer", method: "POST", path: "/api/wishlist", headers: { "authorization": "Bearer not-a-jwt", "content-type": "application/json" }, body: "{}" },
  { label: "escrow/lock bad-bearer", method: "POST", path: "/api/escrow/lock", headers: { "authorization": "Bearer not-a-jwt", "content-type": "application/json" }, body: "{}" },
  { label: "escrow/release bad-bearer", method: "POST", path: "/api/escrow/release", headers: { "authorization": "Bearer not-a-jwt", "content-type": "application/json" }, body: "{}" },

  // Malformed JSON body — should 400 invalid_body, never 500.
  { label: "wishlist malformed-json", method: "POST", path: "/api/wishlist", headers: { "authorization": "Bearer ignored", "content-type": "application/json" }, body: "{not-json" },
  { label: "deposit empty-body", method: "POST", path: "/api/deposit", headers: { "authorization": "Bearer ignored", "content-type": "application/json" }, body: "" },

  // Health route — should always respond cleanly, even when degraded.
  { label: "health", method: "GET", path: "/api/health" },
];

let passed = 0;
let failed = 0;

async function probe(p: Probe): Promise<void> {
  const res = await fetch(`${BASE}${p.path}`, {
    method: p.method,
    headers: p.headers,
    body: p.body,
  });
  const text = await res.text();

  for (const [re, label] of LEAK_PATTERNS) {
    if (re.test(text)) {
      console.log(`  FAIL  ${p.label}  →  status ${res.status}, leaked ${label}`);
      console.log(`        body[0..400]: ${text.slice(0, 400)}`);
      failed += 1;
      return;
    }
  }
  console.log(`  ok    ${p.label}  →  ${res.status}`);
  passed += 1;
}

async function main() {
  console.log(`Probing ${BASE} for stack-trace leaks…`);
  console.log(`${PROBES.length} probes; ${LEAK_PATTERNS.length} leak patterns`);
  console.log("");

  for (const p of PROBES) {
    try {
      await probe(p);
    } catch (e) {
      // fetch-level failure (server not running, etc.) is its own kind of
      // failure — surface clearly without claiming a "leak".
      console.log(`  FAIL  ${p.label}  →  fetch error: ${e instanceof Error ? e.message : e}`);
      console.log(`        is the dev server running on ${BASE}?`);
      failed += 1;
    }
  }

  console.log("");
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

// Silence the assert import warning if assert never ends up used. The import
// keeps the file's intent visible: this is a test, not a probe utility.
void assert;

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
