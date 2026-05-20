# Chain Bridge Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Next.js app at the repo root of `InternStellar-Hackathon` with a Stellar testnet bridge (Horizon client + network constants + Friendbot + verify scripts), respecting Charles's existing `lib/supabase.ts`, `.env.example`, and `db/` on `main`, and the team's per-person-branch workflow.

**Architecture:** Manual Next.js 14 scaffold (no `create-next-app` to avoid clobbering existing files on `main`). `lib/stellar/` exposes a Horizon Server factory and network constants. Two diagnostic scripts (`fund-test-account`, `verify-stellar-connection`) use `npx tsx` and the `@stellar/stellar-sdk`. No `dotenv`, no `axios`, no other runtime deps. Env var names follow Charles's existing convention (`STELLAR_HORIZON_URL`, no `NEXT_PUBLIC_` prefix — chain calls run server-side in this phase).

**Tech Stack:** Next.js 14 (App Router, TypeScript), React 18, `@stellar/stellar-sdk` v12+, Node 20.6+ (for built-in fetch + tsx).

**Plan revision note (during execution, 2026-05-19):** When Task 1 ran, `origin/main` had moved beyond what the spec was first drafted against. New on main: `.env.example` (Charles, server-side `STELLAR_*` vars), `db/schema.sql + policies.sql + seed.sql`, expanded `README.md`. Also, the `.env*` line was removed from `.gitignore`, leaving `.env.local` un-ignored. The plan was revised mid-execution: env vars switched from `NEXT_PUBLIC_STELLAR_*` to `STELLAR_*` to match Charles's convention; Task 7 (`add .env.example`) dropped; the gitignore fix (`.env*.local`) folded into Task 3 (Next.js scaffold). Final commit count: 5 (A–E) instead of 6 (A–F).

---

## Working Directory Convention

All commands in this plan run from the hackathon repo root:

```
C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon
```

The harness's CWD is the parent `STELLAR/` directory. Use absolute paths or `git -C 'C:/.../InternStellar-Hackathon'` and `--prefix 'C:/.../InternStellar-Hackathon'` for npm. **Do NOT prefix commands with `cd`** unless explicitly switching to the hackathon repo at the start of a step.

For brevity in this plan, the path `C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon` is abbreviated **`<REPO>`**. Substitute the full path when running commands.

---

## Pre-flight State Confirmation

Before Task 1, confirm starting conditions:

- [ ] **Verify branch & dirty state**

Run: `git -C '<REPO>' status --short && git -C '<REPO>' branch --show-current`

Expected output (or equivalent):
```
 D README.md
Rene
```

If `git status` shows files other than the README deletion, **stop and surface to the operator** before proceeding.

---

## Task 1: Sync `Rene` branch with `origin/main`

**Files:**
- Modify: `README.md` (restore via checkout — counter the pending deletion)
- Workspace: pulls in `.gitignore` and `lib/supabase.ts` from `origin/main` via merge

- [ ] **Step 1.1: Restore the deleted README**

Run: `git -C '<REPO>' checkout -- README.md`

Then confirm: `git -C '<REPO>' status --short`

Expected: empty output (working tree clean).

- [ ] **Step 1.2: Fetch latest refs**

Run: `git -C '<REPO>' fetch origin`

Expected: no errors. Possibly downloads new objects.

- [ ] **Step 1.3: Merge `origin/main` into `Rene`**

Run: `git -C '<REPO>' merge origin/main --no-edit -m "Merge branch 'main' into Rene"`

Expected: a merge commit is created. Output mentions `lib/supabase.ts` and `.gitignore` (and possibly other files) added.

**If there is a merge conflict**: STOP. Run `git -C '<REPO>' status` and surface the conflict to the operator. Do not attempt auto-resolution.

- [ ] **Step 1.4: Verify expected files now present**

Run: `ls -la '<REPO>/lib/' '<REPO>/.gitignore'`

Expected:
- `<REPO>/.gitignore` exists, non-empty
- `<REPO>/lib/supabase.ts` exists
- Working tree is clean: `git -C '<REPO>' status --short` returns empty.

- [ ] **Step 1.5: Verify `.gitignore` already covers `.env*`**

Run: `grep -n env '<REPO>/.gitignore'`

Expected: a line `.env*` or `.env*.local` is present. This means commit F (later) does NOT need to extend `.gitignore`.

**Note for executing agent:** This task produces a merge commit but no scaffold-specific commit. The merge commit is part of the Rene branch history; subsequent commits A–F will land on top of it.

---

## Task 2: Commit A — design spec doc

**Files:**
- Create (already written, untracked): `<REPO>/docs/specs/2026-05-19-chain-bridge-setup-design.md`

- [ ] **Step 2.1: Confirm the spec file is present and untracked**

Run: `git -C '<REPO>' status --short docs/`

Expected:
```
?? docs/specs/2026-05-19-chain-bridge-setup-design.md
```

If the file is missing, **STOP** — the brainstorming-phase artifact is gone and must be re-created from `docs/superpowers/specs/` of brainstorming output.

- [ ] **Step 2.2: Stage the spec doc**

Run: `git -C '<REPO>' add docs/specs/2026-05-19-chain-bridge-setup-design.md`

- [ ] **Step 2.3: Verify staging**

Run: `git -C '<REPO>' diff --cached --stat`

Expected: one file staged, +200 lines or so.

- [ ] **Step 2.4: Commit A**

Run:
```bash
git -C '<REPO>' commit -m "docs: add chain bridge bootstrap design spec

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

Expected: one commit created. SHA returned.

---

## Task 3: Commit B — manual Next.js scaffold + gitignore fix

This task creates the minimum Next.js scaffold by writing files directly. We do NOT use `npx create-next-app` because the repo root is non-empty (README, lib/, docs/, db/, .env.example, .gitignore) and create-next-app would conflict.

It also adds a single line to `.gitignore` (`.env*.local`). Charles dropped the `.env*` pattern from `main` when he started committing `.env.example`, but didn't add a narrower pattern back — so right now `.env.local` is **not** gitignored. This task fixes that.

**Files:**
- Create: `<REPO>/package.json`
- Create: `<REPO>/tsconfig.json`
- Create: `<REPO>/next.config.mjs`
- Create: `<REPO>/next-env.d.ts`
- Create: `<REPO>/app/layout.tsx`
- Create: `<REPO>/app/page.tsx`
- Modify: `<REPO>/.gitignore` (append `.env*.local`)

- [ ] **Step 3.1: Write `package.json`**

Path: `<REPO>/package.json`

Contents (exact):
```json
{
  "name": "internstellar-hackathon",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "fund-test-account": "npx tsx scripts/fund-test-account.ts",
    "verify-stellar": "npx tsx scripts/verify-stellar-connection.ts",
    "test:stellar-lib": "npx tsx scripts/_test-stellar-lib.ts"
  },
  "dependencies": {
    "next": "14.2.18",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/node": "20.12.12",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "typescript": "5.4.5"
  },
  "engines": {
    "node": ">=20.6.0"
  }
}
```

Rationale for pinned versions: hackathon reproducibility. Use exact versions (no `^`) so installs are deterministic.

- [ ] **Step 3.2: Write `tsconfig.json`**

Path: `<REPO>/tsconfig.json`

Contents (exact):
```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "lib/supabase.ts"]
}
```

**Why `exclude: ["lib/supabase.ts"]`:** Charles's file imports `@supabase/supabase-js`, which is NOT installed in this phase (per spec: only `@stellar/stellar-sdk`). Excluding it from tsc lets `npm run dev` and `npm run build` succeed. When Charles installs the Supabase package, this exclusion line can be removed.

- [ ] **Step 3.3: Write `next.config.mjs`**

Path: `<REPO>/next.config.mjs`

Contents (exact):
```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

- [ ] **Step 3.4: Write `next-env.d.ts`**

Path: `<REPO>/next-env.d.ts`

Contents (exact):
```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

(This file is normally regenerated by `next dev`, but committing the initial version means `npm run dev` won't fail on first boot looking for it. The Next.js `.gitignore` from `main` already ignores `next-env.d.ts`, so we untrack it after creation — see Step 3.10.)

- [ ] **Step 3.5: Write `app/layout.tsx`**

Path: `<REPO>/app/layout.tsx`

Contents (exact):
```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "InternStellar — Chain Bridge",
  description: "Smart remittance escrow on Stellar / Soroban",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3.6: Write `app/page.tsx`**

Path: `<REPO>/app/page.tsx`

Contents (exact):
```tsx
export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>InternStellar — Chain Bridge</h1>
      <p>
        Bridge bootstrap is up. See <code>docs/specs/</code> for scope and{" "}
        <code>scripts/</code> for diagnostics.
      </p>
    </main>
  );
}
```

- [ ] **Step 3.7: Install dependencies**

Run: `npm install --prefix '<REPO>'`

Expected: npm downloads packages, creates `<REPO>/node_modules/` and `<REPO>/package-lock.json`. No errors. (Warnings about peer deps are OK.)

If `npm install` fails: capture full output, surface to operator, do not proceed.

- [ ] **Step 3.8: Smoke-test `npm run dev`**

Run (in background): `npm --prefix '<REPO>' run dev`

Wait ~12 seconds for Next.js to compile.

Read background output. Expected to contain a line like:
```
   ▲ Next.js 14.2.18
   - Local:        http://localhost:3000
   - Ready in <N>s
```

Stop the background process (kill the shell).

If startup errors appear: capture output, surface to operator, do not proceed.

- [ ] **Step 3.9: Verify scaffold files written and `.next/` produced**

Run: `ls -la '<REPO>/app/' '<REPO>/.next/' 2>&1 | head -20`

Expected: `app/layout.tsx`, `app/page.tsx`, `.next/` directory present.

- [ ] **Step 3.10: Verify `.next/`, `node_modules/`, `next-env.d.ts` are gitignored**

Run: `git -C '<REPO>' status --short`

Expected: only NEW files are listed, and they are all ones we wrote in steps 3.1–3.6 plus `package-lock.json`. Specifically, **NONE of these should appear**: `.next/`, `node_modules/`, `next-env.d.ts`.

If any of those DO appear: the existing `.gitignore` from main is missing them. Surface to operator.

- [ ] **Step 3.10b: Add `.env*.local` to `.gitignore`**

Append two lines to the END of `<REPO>/.gitignore` (use the Edit tool — preserve everything currently in the file). The final lines should be:

```

# local env files (NEVER commit secrets; .env.example IS committed)
.env*.local
```

Verify with: `tail -3 '<REPO>/.gitignore'`

Expected: the comment + `.env*.local` line are present.

- [ ] **Step 3.11: Stage scaffold files**

Run:
```bash
git -C '<REPO>' add package.json package-lock.json tsconfig.json next.config.mjs app/layout.tsx app/page.tsx .gitignore
```

(Note: `next-env.d.ts` is gitignored — do not stage it.)

- [ ] **Step 3.12: Verify staging**

Run: `git -C '<REPO>' diff --cached --stat`

Expected: 7 files staged (package.json, package-lock.json, tsconfig.json, next.config.mjs, app/layout.tsx, app/page.tsx, .gitignore).

- [ ] **Step 3.13: Commit B**

Run:
```bash
git -C '<REPO>' commit -m "chore: scaffold Next.js 14 + ensure .env*.local is gitignored

- App Router with TypeScript, no Tailwind, no src/ folder
- Excludes lib/supabase.ts from tsc until @supabase/supabase-js is installed
- Engines pinned to Node >=20.6 for built-in fetch + --env-file support
- Re-adds .env*.local to .gitignore (the broader .env* pattern was removed
  from main when Charles committed .env.example; .env.local was un-ignored)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

Expected: commit created.

---

## Task 4: Commit C — install `@stellar/stellar-sdk`

**Files:**
- Modify: `<REPO>/package.json` (npm adds the dep)
- Modify: `<REPO>/package-lock.json` (npm updates lockfile)

- [ ] **Step 4.1: Install the SDK**

Run: `npm install --prefix '<REPO>' --save-exact @stellar/stellar-sdk@12.3.0`

Rationale for pinning: `@stellar/stellar-sdk` v12 introduced the `Horizon` namespace and is stable. Hackathon reproducibility benefits from exact pin.

Expected: package installs, `package.json` and `package-lock.json` updated. No errors.

- [ ] **Step 4.2: Verify the dep is in `package.json`**

Run: `grep -n stellar-sdk '<REPO>/package.json'`

Expected: a line like `"@stellar/stellar-sdk": "12.3.0"` in the `dependencies` section.

- [ ] **Step 4.3: Verify no other packages were added**

Run: `grep -E '"(dotenv|axios|firebase|@supabase|tsx)"' '<REPO>/package.json'`

Expected: NO matches. (If `tsx` appears, that violates the spec — surface to operator.)

- [ ] **Step 4.4: Stage and commit**

Run:
```bash
git -C '<REPO>' add package.json package-lock.json
git -C '<REPO>' commit -m "chore(stellar): install @stellar/stellar-sdk@12.3.0

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

Expected: commit created.

---

## Task 5: Commit D — `lib/stellar/` module (TDD)

This task adds the Horizon client factory and network constants. We use TDD: write a runnable test script first, watch it fail, then implement.

**Files:**
- Create: `<REPO>/scripts/_test-stellar-lib.ts` (test script)
- Create: `<REPO>/lib/stellar/network.ts`
- Create: `<REPO>/lib/stellar/client.ts`

- [ ] **Step 5.1: Write the failing test script**

Path: `<REPO>/scripts/_test-stellar-lib.ts`

Contents (exact):
```ts
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
```

- [ ] **Step 5.2: Run the test to verify it fails**

Run: `npm --prefix '<REPO>' run test:stellar-lib`

Expected: failure. The output should mention that `../lib/stellar/network` (or `../lib/stellar/client`) cannot be resolved.

This proves the test is wired correctly and that the module files genuinely do not exist yet.

- [ ] **Step 5.3: Create `lib/stellar/network.ts`**

Path: `<REPO>/lib/stellar/network.ts`

Contents (exact):
```ts
import { Networks } from "@stellar/stellar-sdk";

export const STELLAR_NETWORK = "testnet";
export const NETWORK_PASSPHRASE = Networks.TESTNET;
```

- [ ] **Step 5.4: Create `lib/stellar/client.ts`**

Path: `<REPO>/lib/stellar/client.ts`

Contents (exact):
```ts
import { Horizon } from "@stellar/stellar-sdk";

export function getHorizonServer(): Horizon.Server {
  const url = process.env.STELLAR_HORIZON_URL;
  if (!url) {
    throw new Error(
      "STELLAR_HORIZON_URL is not set. Copy .env.example to .env.local and fill it in.",
    );
  }
  return new Horizon.Server(url);
}
```

- [ ] **Step 5.5: Run the test again — expect pass**

Run: `npm --prefix '<REPO>' run test:stellar-lib`

Expected output (or equivalent):
```
lib/stellar/network
  ok   STELLAR_NETWORK is 'testnet'
  ok   NETWORK_PASSPHRASE equals Networks.TESTNET
lib/stellar/client
  ok   getHorizonServer() throws when env var is missing
  ok   getHorizonServer() returns a Horizon.Server when env is set

4 passed, 0 failed
```

Exit code: 0.

If any test fails: do not commit. Debug, fix, re-run.

- [ ] **Step 5.6: Type-check passes**

Run: `npx --prefix '<REPO>' tsc --noEmit -p '<REPO>/tsconfig.json'`

Expected: no errors.

(This step is a belt-and-suspenders check. Some Horizon SDK type imports can be subtle; if this surfaces an error, fix the import in `lib/stellar/client.ts` before committing.)

- [ ] **Step 5.7: Stage and commit D**

Run:
```bash
git -C '<REPO>' add lib/stellar/network.ts lib/stellar/client.ts scripts/_test-stellar-lib.ts
git -C '<REPO>' commit -m "feat(stellar): add Horizon client factory + network constants

- lib/stellar/network.ts: STELLAR_NETWORK + NETWORK_PASSPHRASE
- lib/stellar/client.ts: getHorizonServer() reads env, throws on missing
- scripts/_test-stellar-lib.ts: assertion-based test (node:assert, no test runner)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

Expected: commit created.

---

## Task 6: Commit E — diagnostic scripts (Friendbot + verify)

**Files:**
- Create: `<REPO>/scripts/fund-test-account.ts`
- Create: `<REPO>/scripts/verify-stellar-connection.ts`

- [ ] **Step 6.1: Write `scripts/fund-test-account.ts`**

Path: `<REPO>/scripts/fund-test-account.ts`

Contents (exact):
```ts
import { Keypair } from "@stellar/stellar-sdk";

const FRIENDBOT_URL = "https://friendbot.stellar.org";

async function main() {
  const kp = Keypair.random();
  const url = `${FRIENDBOT_URL}/?addr=${encodeURIComponent(kp.publicKey())}`;

  console.log(`Requesting Friendbot funding for ${kp.publicKey()} ...`);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    console.error(`Friendbot returned HTTP ${res.status}: ${body}`);
    process.exit(1);
  }

  console.log("\n=== Stellar testnet keypair funded ===");
  console.log(`Public key: ${kp.publicKey()}`);
  console.log(`Secret key: ${kp.secret()}`);
  console.log("\nAdd this line to .env.local (matches .env.example on main):");
  console.log(`STELLAR_DEMO_SECRET_KEY=${kp.secret()}`);
  console.log("\nThe secret stays on your machine. .env*.local is gitignored.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 6.2: Write `scripts/verify-stellar-connection.ts`**

This script needs to read `.env.local` to get `NEXT_PUBLIC_STELLAR_HORIZON_URL`. We inline a tiny parser instead of adding `dotenv` as a dependency.

Path: `<REPO>/scripts/verify-stellar-connection.ts`

Contents (exact):
```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getHorizonServer } from "../lib/stellar/client";
import { NETWORK_PASSPHRASE, STELLAR_NETWORK } from "../lib/stellar/network";

function loadEnvLocal(): void {
  let content: string;
  try {
    content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  } catch {
    return;
  }
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();

  const horizonUrl = process.env.STELLAR_HORIZON_URL ?? "(unset)";
  const server = getHorizonServer();
  const page = await server.ledgers().order("desc").limit(1).call();
  const latest = page.records[0];

  console.log(JSON.stringify(
    {
      network: STELLAR_NETWORK,
      passphrase: NETWORK_PASSPHRASE,
      horizon: horizonUrl,
      latest_ledger: latest?.sequence,
      closed_at: latest?.closed_at,
    },
    null,
    2,
  ));
}

main().catch((err) => {
  console.error("Verification failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 6.3: Type-check passes**

Run: `npx --prefix '<REPO>' tsc --noEmit -p '<REPO>/tsconfig.json'`

Expected: no errors.

- [ ] **Step 6.4: Smoke-test the verify script with a temporary inline env**

Run (one line, sets env for the duration of the command):
- Bash: `STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org npx --prefix '<REPO>' tsx '<REPO>/scripts/verify-stellar-connection.ts'`
- PowerShell: `$env:STELLAR_HORIZON_URL='https://horizon-testnet.stellar.org'; npx --prefix '<REPO>' tsx '<REPO>/scripts/verify-stellar-connection.ts'; Remove-Item Env:STELLAR_HORIZON_URL`

Expected: JSON output containing `"network": "testnet"`, `"horizon": "https://horizon-testnet.stellar.org"`, a numeric `latest_ledger`, and an ISO timestamp.

If the request fails (network error, Horizon down): note it, but the scaffold is still committable. The point of this smoke test is that the SDK initialised and the code path compiled.

- [ ] **Step 6.5: Do NOT run `fund-test-account.ts`**

Per spec section 11: the agent does not run the funding script. It produces a secret that the operator must handle. Operator will run it themselves during the verification gate (Task 8).

- [ ] **Step 6.6: Stage and commit E**

Run:
```bash
git -C '<REPO>' add scripts/fund-test-account.ts scripts/verify-stellar-connection.ts
git -C '<REPO>' commit -m "feat(scripts): add fund-test-account + verify-stellar-connection

- fund-test-account.ts: generates keypair, calls Friendbot, prints keys
- verify-stellar-connection.ts: prints latest testnet ledger via Horizon
- Inline .env.local parser avoids adding dotenv as a dependency

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

Expected: commit created.

---

## Task 7: DROPPED during execution

The original Task 7 ("add `.env.example`, allowlist it") was dropped on
2026-05-19 after discovering Charles had committed `.env.example` to `main` in
a commit that happened between spec drafting and Task 1 execution. Charles's
file uses server-side `STELLAR_*` variables (no `NEXT_PUBLIC_` prefix). The
plan was revised to adopt those names — see the revision note at the top.

The gitignore fix that was bundled with old Task 7 (`.env.local` was no longer
covered after Charles modified `.gitignore`) is now folded into Task 3, step
3.10b. There is no commit F.

Continue to Task 8.

---

## Task 8: Verification gate (final, operator-facing)

This is the gate before any push or PR. Every check must pass and be shown to the operator.

- [ ] **Step 8.1: Working tree is clean**

Run: `git -C '<REPO>' status`

Expected: `nothing to commit, working tree clean`.

- [ ] **Step 8.2: Commit history matches revised plan**

Run: `git -C '<REPO>' log --oneline -10`

Expected: top of log shows 5 commits in this order (newest first), on top of the fast-forwarded `origin/main` baseline (no dedicated merge commit because Task 1's merge was a fast-forward):

```
<sha>  feat(scripts): add fund-test-account + verify-stellar-connection
<sha>  feat(stellar): add Horizon client factory + network constants
<sha>  chore(stellar): install @stellar/stellar-sdk@12.3.0
<sha>  chore: scaffold Next.js 14 + ensure .env*.local is gitignored
<sha>  docs: add chain bridge bootstrap design spec
0452577  Update Supabase anon key in .env.example   ← origin/main tip
<earlier main history>
```

- [ ] **Step 8.3: Operator creates `.env.local`**

Operator (not the agent) runs the following from the hackathon repo root:

```bash
cp .env.example .env.local
```

`.env.local` then needs the `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `STELLAR_DEMO_SECRET_KEY` placeholders filled in. The Supabase ones come from Charles / the Supabase dashboard. The Stellar one is produced by Step 8.4.

- [ ] **Step 8.4: Operator runs the Friendbot funding script ONCE**

Operator runs: `npm run fund-test-account`

Expected output:
```
Requesting Friendbot funding for G... ...

=== Stellar testnet keypair funded ===
Public key: G...
Secret key: S...

Add this line to .env.local (matches .env.example on main):
STELLAR_DEMO_SECRET_KEY=S...

The secret stays on your machine. .env*.local is gitignored.
```

Operator copies the `STELLAR_DEMO_SECRET_KEY=...` line into `.env.local`.

- [ ] **Step 8.5: Run verification script**

Run: `npm --prefix '<REPO>' run verify-stellar`

Expected: JSON output with a numeric `latest_ledger` field. If this fails, the bridge is not actually live — surface error, do not declare done.

- [ ] **Step 8.6: Boot the dev server**

Run (in background): `npm --prefix '<REPO>' run dev`

Wait ~12 seconds. Read background output.

Expected: contains `Ready in <N>s` and a `http://localhost:3000` URL.

Stop the background process.

- [ ] **Step 8.7: Print PR command for operator**

Output to operator (do NOT run):

```
To push and open PR (run yourself when ready):

  git -C '<REPO>' push origin Rene
  gh -R CDGYu/InternStellar-Hackathon pr create --base main --head Rene \
     --title "Chain bridge bootstrap (Person 2)" \
     --body "Implements docs/specs/2026-05-19-chain-bridge-setup-design.md"
```

**The agent does NOT run these commands.** PR is operator's call.

- [ ] **Step 8.8: Final status print**

Print summary to operator:

```
Chain bridge bootstrap complete.

Local state:
  - 6 commits ahead of origin/Rene
  - Working tree clean
  - npm run dev:    ✓ boots
  - npm run verify-stellar:  ✓ prints latest ledger
  - npm run fund-test-account:  ✓ funded (operator ran)
  - .env.local:     ✓ exists with STELLAR_TEST_SECRET

Not pushed. Not PR'd. Operator decides when.
```

---

## Out-of-Scope Notes (do NOT do as part of this plan)

1. Do NOT install `@supabase/supabase-js`. Charles owns that file.
2. Do NOT touch `lib/supabase.ts`. The `tsconfig.json` excludes it to make build green.
3. Do NOT run the Friendbot fund script as the agent. Operator runs it.
4. Do NOT push to `origin/Rene` or open the PR. Operator decides timing.
5. Do NOT add CI workflows, Tailwind, ESLint config, Vitest, Jest, Playwright, dotenv, axios, or any other package beyond `@stellar/stellar-sdk`.
6. Do NOT touch other team members' files (`origin/Charles`, `origin/Prince`, `origin/Thirdy`).

---

## Self-Review (completed during plan authoring)

**Spec coverage check:**

- Spec §1 Goal — covered by Tasks 3, 5, 6 (Next.js + bridge + scripts).
- Spec §2 Non-Goals — preserved (no Freighter, no API routes, no Supabase wiring, no contract, no CI).
- Spec §3 Constraints — preserved: only `@stellar/stellar-sdk` is installed (Task 4), `tsx` is via `npx` (package.json scripts use `npx tsx`), Supabase not Firebase.
- Spec §4 Architecture file tree — every file listed has a task: spec doc (Task 2), Next.js core (Task 3), lib/stellar/* (Task 5), scripts/* (Task 6), .env.example (Task 7).
- Spec §4.1 Component responsibilities — `getHorizonServer()` factory (Task 5), `STELLAR_NETWORK`/`NETWORK_PASSPHRASE` constants (Task 5), `fund-test-account.ts` printing only — never writing `.env.local` (Task 6), `verify-stellar-connection.ts` printing latest ledger (Task 6).
- Spec §5 Data flows — funding flow and verification flow match Task 6 + Task 8.
- Spec §6 Error handling — explicit throws on missing env, exit 1 on Friendbot non-2xx, no retries: all in Task 5/6 code blocks.
- Spec §7 Trust boundaries — `.env.local` gitignored (verified Step 1.5 + 7.3), `.env.example` is template-only (Task 7).
- Spec §8 Env vars — Task 7's `.env.example` lists all three vars exactly as in spec.
- Spec §9 Branching & commits — Task 1 does the merge, Tasks 2–7 produce commits A–F in the documented order.
- Spec §10 Verification gate — Task 8 covers all 5 items (clean tree, dev boots, verify-stellar runs, .env.local exists with vars, log shows commits A–F + merge).
- Spec §11 Non-actions — restated in "Out-of-Scope Notes" section above.

**Placeholder scan:** No "TBD", "TODO", "implement later", or vague handling instructions. Every code block is complete.

**Type consistency:** `getHorizonServer()` named identically across `lib/stellar/client.ts`, test script, and verify script. `STELLAR_NETWORK` and `NETWORK_PASSPHRASE` named identically across `lib/stellar/network.ts`, test script, and verify script. `Horizon.Server` (v12+ namespace) used consistently.

**Deviation from spec called out:**
- Spec §9 commit F said "extend .gitignore for .env.local" — main's `.gitignore` already covers it; Task 7 only adds `.env.example` + allowlist line. Documented in Task 7's preamble.
- `tsconfig.json` adds `"exclude": ["node_modules", "lib/supabase.ts"]` to handle Charles's file with unresolvable import; documented in Step 3.2.
