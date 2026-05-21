/* eslint-disable no-console */
//
// Regression test: HTTP responses from the API routes must NEVER contain
// stack-trace fragments, SDK internals, or other operator-debug strings that
// the user shouldn't see. The route layer is supposed to filter those into
// `console.error` and surface a clean `{ error, reason, request_id }` envelope
// instead — this script probes that contract by sending traffic the routes
// are likely to misbehave on (malformed JSON, broken JWTs, missing fields)
// and asserting the response bodies pass a leak-pattern regex.
//
// Run:
//   1. Start the API in another shell:   npm run dev
//   2. In this shell:                    npm run test:no-leaks
//
// Exit code 0 = no leaks, 1 = at least one leak (test failure).

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

// Patterns that, if found in a response body, indicate the route leaked
// server-side internals. Each is a known shape:
//   - `at func (file.ts:42:11)` — V8 stack trace frame
//   - `TypeError:` and friends — uncaught error names
//   - `node_modules/` — never belongs in a client-facing body
//   - `webpack-internal://` — Next dev runtime path
//   - `/Users/`, `C:\Users\` — local filesystem paths
const LEAK_PATTERNS: { name: string; rx: RegExp }[] = [
  { name: "v8 stack frame", rx: /at\s+\S+\s+\(.+?:\d+:\d+\)/ },
  { name: "raw error name", rx: /(TypeError|ReferenceError|SyntaxError|RangeError):/ },
  { name: "node_modules path", rx: /node_modules[\/\\]/ },
  { name: "webpack-internal path", rx: /webpack-internal:/ },
  { name: "unix home path", rx: /\/Users\/[^/\s"]+/ },
  { name: "windows home path", rx: /[A-Z]:\\Users\\[^\\\s"]+/i },
];

interface Probe {
  label: string;
  method: "GET" | "POST";
  path: string;
  body?: string;
  headers?: Record<string, string>;
}

const PROBES: Probe[] = [
  // Chain-call routes — each gets malformed body + broken JWT.
  ...buildBadInputProbesFor("POST", "/api/deposit"),
  ...buildBadInputProbesFor("POST", "/api/wishlist"),
  ...buildBadInputProbesFor("POST", "/api/escrow/lock"),
  ...buildBadInputProbesFor("POST", "/api/escrow/release"),
  ...buildBadInputProbesFor("POST", "/api/bills/pay"),
  // GET routes — broken JWT only (no body).
  {
    label: "GET /api/balances/abc with broken JWT",
    method: "GET",
    path: "/api/balances/abc",
    headers: { Authorization: "Bearer not-a-real-jwt" },
  },
  // Health probe — always reachable, asserts shape.
  { label: "GET /api/health (sanity, must not leak)", method: "GET", path: "/api/health" },
];

function buildBadInputProbesFor(method: "POST", path: string): Probe[] {
  return [
    {
      label: `${method} ${path} with malformed JSON`,
      method,
      path,
      body: "{not json",
      headers: { "Content-Type": "application/json" },
    },
    {
      label: `${method} ${path} with empty body`,
      method,
      path,
      body: "",
      headers: { "Content-Type": "application/json" },
    },
    {
      label: `${method} ${path} with wrong types`,
      method,
      path,
      body: JSON.stringify({ ofw_id: 42, total_stroops: true, family_id: [] }),
      headers: { "Content-Type": "application/json" },
    },
    {
      label: `${method} ${path} with broken JWT`,
      method,
      path,
      body: JSON.stringify({ family_id: "x", wishlist_id: "y", ofw_id: "z", total_stroops: "1", pct_util: 60, pct_groc: 30, pct_emerg: 10 }),
      headers: { "Content-Type": "application/json", Authorization: "Bearer this.is.not.real" },
    },
  ];
}

interface Result {
  label: string;
  status: number;
  bodySnippet: string;
  leak: string | null;
}

async function runProbe(p: Probe): Promise<Result> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${p.path}`, {
      method: p.method,
      body: p.body,
      headers: p.headers,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      label: p.label,
      status: 0,
      bodySnippet: `[fetch error] ${msg}`,
      leak: "server unreachable",
    };
  }

  const text = await res.text();
  for (const { name, rx } of LEAK_PATTERNS) {
    if (rx.test(text)) {
      return { label: p.label, status: res.status, bodySnippet: snippet(text), leak: name };
    }
  }
  return { label: p.label, status: res.status, bodySnippet: snippet(text), leak: null };
}

function snippet(s: string): string {
  if (s.length <= 200) return s;
  return s.slice(0, 200) + "…";
}

async function main(): Promise<void> {
  // Confirm the server is up before we run a battery of probes. The first
  // call's "ECONNREFUSED" is much more useful than 25 confusing failures.
  try {
    await fetch(`${BASE_URL}/api/health`);
  } catch {
    console.error(
      `Server not reachable at ${BASE_URL}. Start it first:\n` +
      `    npm run dev\n` +
      `Then re-run:\n` +
      `    npm run test:no-leaks`,
    );
    process.exit(1);
  }

  const results: Result[] = [];
  for (const probe of PROBES) {
    results.push(await runProbe(probe));
  }

  let leaks = 0;
  for (const r of results) {
    if (r.leak) {
      leaks += 1;
      console.log(`  LEAK ${r.label}  (status ${r.status})  pattern="${r.leak}"`);
      console.log(`       body: ${r.bodySnippet}`);
    } else {
      console.log(`  ok   ${r.label}  (status ${r.status})`);
    }
  }

  console.log(`\n${results.length - leaks} clean, ${leaks} leaked`);
  process.exit(leaks > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Unexpected runner failure:", e);
  process.exit(1);
});
