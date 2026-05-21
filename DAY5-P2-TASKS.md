# Day 5 — P2 (Rene) Implementation Plan

> **For execution:** This plan is bite-sized (2–5 min per step) and TDD-where-applicable. Work top-to-bottom, commit at every "Commit" step. Don't batch. If you skip ahead, you lose the per-step verification gates.

**Goal:** Close all six P2 hardening items from `DAY-5-TASKS.md` §P2: friendly-error audit + leak test, `GET /api/health`, `Retry-After` header, `request_id` on every response, `AbortSignal`-based timeout, and idempotency for chain-modifying routes.

**Architecture:** Surface-level additions to the existing `{ error, reason?, ...context? }` envelope in `lib/api/errors.ts`, plus three small new modules (`request-id.ts`, `idempotency.ts`, plus the `/api/health` route). The chain-call timeout change is a single function rewrite in `lib/stellar/contract.ts`. No schema changes, no breaking changes to existing route response shapes — only **additive** fields and headers.

**Tech Stack:** Next.js 14 App Router (`runtime: "nodejs"`, `dynamic: "force-dynamic"`), `@stellar/stellar-sdk` 12.3.0, `@supabase/supabase-js` 2.45.4, `tsx` for scripts, Node 20.

---

## Status as of 2026-05-21

### ✅ Local setup (done today)
- `npm install` → 83 packages added, `dotenv` resolved.
- `npm run fund-test-account` → keypair generated.
- `.env` filled: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STELLAR_DEMO_SECRET_KEY=SDGVA5PB...PLSJ` (public `GAOZASZ4...G45Y`).
- `npm run setup-billers` → Meralco + Maynilad funded and idempotent.

### ⚠️ Setup blockers to resolve **before** rehearsals
1. **Demo signer pubkey doesn't match seeded `profiles.stellar_public_key`.** The `.env.example` note says the demo signer must match the address seeded for OFW + Family rows — currently `GAC3WCB5...PYUK` (P1's `internstellar` identity). Our freshly-generated `GAOZASZ4...G45Y` won't satisfy `family.require_auth()` in `lock_escrow` / `release_escrow`.
   - **Fix path A (preferred):** get P1's matching secret out-of-band and replace `STELLAR_DEMO_SECRET_KEY` with it.
   - **Fix path B:** re-seed `profiles.stellar_public_key` for the OFW (`1111…`) and Family (`2222…`) rows to `GAOZASZ4...G45Y` — write `update public.profiles set stellar_public_key = 'GAOZASZ4...G45Y' where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');` and run via Supabase SQL editor or `supabase.rpc`.
   - Without one of these, every chain call returns `contract_error` with reason `family cannot be store` or an auth panic — independent of P2 work below.

### ✅ Already-done P2 surface (don't rewrite)
- `{ error, reason?, ...context? }` envelope (`lib/api/errors.ts`).
- `ContractCallError` / `ContractNotConfiguredError` split (`lib/stellar/contract.ts`).
- All 13 known panic strings mapped in `KNOWN_PANIC_STRINGS`.
- `console.error` for internals; no XDR / stack-trace leaks observed by inspection.
- `POLL_TIMEOUT_MS = 30_000` on chain submissions (uses `Date.now()` — replaced in Task 4).
- `503 contract_not_configured` when env is missing.
- `requireUser()` Bearer JWT verification (`lib/api/auth.ts`).
- 11/11 smoke tests pass (`npm run test:escrow-wiring`).

### ❌ Day 5 gap (this plan closes)
1. `request_id` on every response.
2. `Retry-After` header on `503 contract_not_configured`.
3. `GET /api/health` route.
4. `AbortSignal`-based chain timeout.
5. Idempotency guard on chain-modifying routes.
6. `scripts/_test-no-stacktrace-leak.ts` + `npm run test:no-leaks`.

---

## File structure

### New files
- `lib/api/request-id.ts` — `newRequestId()` + `RequestIdHeader` constant. ~15 lines.
- `lib/api/idempotency.ts` — in-memory `(family_id, wishlist_id, route)` lock with auto-expiry. ~40 lines.
- `app/api/health/route.ts` — `GET` returning `{ chain, db, request_id }`. ~80 lines.
- `scripts/_test-no-stacktrace-leak.ts` — runs the dev server in-process? No — assumes `npm run dev` is running on `localhost:3000`, POSTs malformed bodies + broken JWTs, greps each response for stack-trace patterns. ~150 lines.

### Modified files
- `lib/api/errors.ts` — `ok()` and `err()` add `request_id`; `err()` accepts optional `Retry-After`. ~30 lines added.
- `lib/stellar/contract.ts` — `invokeContract` swaps `Date.now()` polling for `AbortSignal.timeout(POLL_TIMEOUT_MS)`. ~25 lines changed.
- `app/api/escrow/lock/route.ts` — wrap handler in `withRequestId()` + `withIdempotency()`. ~10 lines.
- `app/api/escrow/release/route.ts` — same. ~10 lines.
- `app/api/deposit/route.ts` — wrap in `withRequestId()` + `withIdempotency()`. ~10 lines.
- `app/api/bills/pay/route.ts` — wrap in `withRequestId()` + `withIdempotency()`. ~10 lines.
- `app/api/wishlist/route.ts` — wrap in `withRequestId()` (no idempotency — pure DB write). ~5 lines.
- `app/api/balances/[user_id]/route.ts` — wrap in `withRequestId()` (read-only). ~5 lines.
- `package.json` — add `"test:no-leaks"` script.

### Out of scope
- Refactoring routes into a shared higher-order wrapper module (would touch every route at once — too risky for Day 5). Inline wrapping is fine for 6 routes.
- Persisting idempotency state to Redis/DB — in-memory is correct for the demo's lifetime.
- Replacing `console.error` with a structured logger.

---

## Task 1: Add `request_id` to the response envelope

**Files:**
- Create: `lib/api/request-id.ts`
- Modify: `lib/api/errors.ts:1-37`
- Test via existing: `npm run test:escrow-wiring`

- [ ] **Step 1.1: Write the request-id module**

Create `lib/api/request-id.ts`:

```ts
import { randomUUID } from "node:crypto";

// Header the UI and curl users can echo back for log correlation.
export const RequestIdHeader = "X-Request-Id";

/**
 * Returns the inbound X-Request-Id if the caller supplied one (UUID v4
 * format) so request chains are traceable across the UI → API → contract
 * boundary. Falls back to a fresh UUID v4 otherwise.
 */
export function newRequestId(req: Request): string {
  const incoming = req.headers.get(RequestIdHeader);
  if (incoming && /^[0-9a-f-]{36}$/i.test(incoming)) return incoming;
  return randomUUID();
}
```

- [ ] **Step 1.2: Extend `ok()` and `err()` to include `request_id`**

Replace the current `lib/api/errors.ts` body (keeping the same export surface, callers don't change):

```ts
import { NextResponse } from "next/server";

import { RequestIdHeader } from "./request-id";

// Success → { ...payload, request_id }
// Error   → { error, reason?, request_id, ...context? }

export interface EnvelopeOptions {
  requestId?: string;
  /** Sets Retry-After header (seconds). Use on 503 contract_not_configured. */
  retryAfterSeconds?: number;
  headers?: HeadersInit;
}

export function ok<T extends object>(
  payload: T,
  options: EnvelopeOptions = {},
  init?: ResponseInit,
): NextResponse {
  const body = options.requestId
    ? { ...payload, request_id: options.requestId }
    : payload;
  const res = NextResponse.json(body, init);
  if (options.requestId) res.headers.set(RequestIdHeader, options.requestId);
  if (options.headers) {
    new Headers(options.headers).forEach((v, k) => res.headers.set(k, v));
  }
  return res;
}

export function err(
  status: number,
  code: string,
  reason?: string,
  context?: Record<string, unknown>,
  options: EnvelopeOptions = {},
): NextResponse {
  const body: Record<string, unknown> = { error: code };
  if (reason) body.reason = reason;
  if (context) Object.assign(body, context);
  if (options.requestId) body.request_id = options.requestId;
  const res = NextResponse.json(body, { status });
  if (options.requestId) res.headers.set(RequestIdHeader, options.requestId);
  if (options.retryAfterSeconds !== undefined) {
    res.headers.set("Retry-After", String(options.retryAfterSeconds));
  }
  if (options.headers) {
    new Headers(options.headers).forEach((v, k) => res.headers.set(k, v));
  }
  return res;
}

export async function parseJsonBody(req: Request): Promise<Record<string, unknown> | NextResponse> {
  try {
    const json = await req.json();
    if (json === null || typeof json !== "object" || Array.isArray(json)) {
      return err(400, "invalid_body", "Request body must be a JSON object.");
    }
    return json as Record<string, unknown>;
  } catch {
    return err(400, "invalid_body", "Request body is not valid JSON.");
  }
}
```

> **Note:** `parseJsonBody`'s internal `err()` calls don't pass `requestId` — those errors fire before the route assigns one, so callers re-wrap if they want it. For demo scope, the lack of `request_id` on a malformed-body 400 is acceptable.

- [ ] **Step 1.3: Run smoke test — existing routes still compile and respond correctly**

```
npm run test:escrow-wiring
```

Expected: `11 passed, 0 failed`. The `err()` shape test in that script still asserts `{ error: 'wishlist_not_found' }` exactly — that passes because the test calls `err()` without options, so no `request_id` is added.

- [ ] **Step 1.4: Commit**

```
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" add lib/api/request-id.ts lib/api/errors.ts
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" commit -m "feat(api): add request_id and Retry-After support to response envelope"
```

---

## Task 2: Wire `request_id` into all six API routes

**Files:**
- Modify: `app/api/escrow/lock/route.ts`
- Modify: `app/api/escrow/release/route.ts`
- Modify: `app/api/deposit/route.ts`
- Modify: `app/api/wishlist/route.ts`
- Modify: `app/api/balances/[user_id]/route.ts`
- Modify: `app/api/bills/pay/route.ts`
- Test via: `npm run test:escrow-wiring`

- [ ] **Step 2.1: Pattern — top of each route's exported `POST`/`GET`**

Add `const requestId = newRequestId(req);` immediately after the function signature, then thread it through every `ok()` / `err()` call as a final `options` arg.

Example diff for `app/api/escrow/lock/route.ts` (`POST`):

```diff
 import { requireUser } from "../../../../lib/api/auth";
 import { err, ok, parseJsonBody } from "../../../../lib/api/errors";
+import { newRequestId } from "../../../../lib/api/request-id";

 export async function POST(req: Request): Promise<NextResponse> {
+  const requestId = newRequestId(req);
   // ---- 1. Auth -----------------------------------------------------
   const caller = await requireUser(req);
   if (caller instanceof NextResponse) return caller;
```

Then every `err(...)` and `ok(...)` call in the same function gets `, {}, { requestId }` — but our new signature already takes options as the 5th arg on `err()` and 2nd arg on `ok()`, so it's cleaner:

For `err()` calls already passing context (`err(409, "code", "reason", { current, expected })`):

```diff
-    return err(409, "invalid_status", undefined, {
-      current: wishlist.status,
-      expected: ["draft", "pending_approval"],
-    });
+    return err(409, "invalid_status", undefined, {
+      current: wishlist.status,
+      expected: ["draft", "pending_approval"],
+    }, { requestId });
```

For `err()` calls with reason only (`err(404, "wishlist_not_found")`):

```diff
-    return err(404, "wishlist_not_found");
+    return err(404, "wishlist_not_found", undefined, undefined, { requestId });
```

For `ok()`:

```diff
-  return ok({
+  return ok({
     escrow_id: escrowId ?? null,
     wishlist_id,
     tx_hash: txHash,
     status: "locked",
     amount_stroops: grocery_stroops.toString(),
     store_id: storeId,
     message: "Escrow locked successfully. Store can now prepare delivery.",
-  });
+  }, { requestId });
```

Apply this pattern to **every** `ok()` and `err()` call in:
- `app/api/escrow/lock/route.ts`
- `app/api/escrow/release/route.ts`
- `app/api/deposit/route.ts`
- `app/api/wishlist/route.ts`
- `app/api/balances/[user_id]/route.ts` (GET, not POST)
- `app/api/bills/pay/route.ts`

> **Important:** Don't touch `parseJsonBody`'s internal `err()` calls — they fire before `requestId` exists. The downstream `if (parsed instanceof NextResponse) return parsed;` forwards them as-is. Acceptable for Day 5.

- [ ] **Step 2.2: Verify all routes still compile**

```
npm run test:escrow-wiring
```

Expected: `11 passed, 0 failed`. All five route handlers still export the right HTTP verb.

- [ ] **Step 2.3: Spot-check one route via dev server**

In one terminal:

```
npm run dev
```

In another terminal (or via the in-skill `! curl ...` prefix):

```
curl -i -X POST http://localhost:3000/api/wishlist -H "content-type: application/json" -d '{}'
```

Expected: `HTTP/1.1 401` with body `{"error":"unauthorized","reason":"Missing Bearer token in Authorization header.","request_id":"<uuid>"}` AND header `X-Request-Id: <same uuid>`.

- [ ] **Step 2.4: Commit**

```
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" add app/api
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" commit -m "feat(api): thread request_id through every route response"
```

---

## Task 3: `GET /api/health` route

**Files:**
- Create: `app/api/health/route.ts`
- Test via: dev server + curl

- [ ] **Step 3.1: Write the route**

Create `app/api/health/route.ts`:

```ts
import { NextResponse } from "next/server";

import { err, ok } from "../../../lib/api/errors";
import { newRequestId } from "../../../lib/api/request-id";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight pre-flight check the UI hits on dashboard load so it can
 * disable chain-call buttons before they fail. Never throws.
 *
 *   200 → both legs are live.
 *   503 → at least one leg is unreachable. Body still parses; UI inspects
 *         `chain` and `db` fields to decide what to gate.
 *
 * Body shape (success and degraded both):
 *   { chain: "ok" | "unconfigured", db: "ok" | "err", request_id, contract_id? }
 */
export async function GET(req: Request): Promise<NextResponse> {
  const requestId = newRequestId(req);

  // --- chain config check (no actual network call — env presence only) -----
  const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID;
  const rpcUrl = process.env.STELLAR_RPC_URL;
  const secret = process.env.STELLAR_DEMO_SECRET_KEY;
  const chain: "ok" | "unconfigured" =
    contractId && rpcUrl && secret ? "ok" : "unconfigured";

  // --- db check: cheap query, capped wait -----------------------------------
  let db: "ok" | "err" = "ok";
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("inventory")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (error) {
      console.error("[health] supabase probe failed:", error);
      db = "err";
    }
  } catch (e) {
    console.error("[health] supabase init failed:", e);
    db = "err";
  }

  const payload = {
    chain,
    db,
    ...(contractId ? { contract_id: contractId } : {}),
  };

  // 503 + Retry-After if chain is unconfigured — UI can back off.
  if (chain === "unconfigured" || db === "err") {
    return err(503, "degraded", undefined, payload, {
      requestId,
      retryAfterSeconds: 15,
    });
  }
  return ok(payload, { requestId });
}
```

- [ ] **Step 3.2: Verify locally — env filled (expect 200)**

In one terminal:

```
npm run dev
```

In another:

```
curl -i http://localhost:3000/api/health
```

Expected: `HTTP/1.1 200`, body contains `"chain":"ok","db":"ok"`, header `X-Request-Id` present.

- [ ] **Step 3.3: Verify locally — env stripped (expect 503 + Retry-After)**

```
$env:STELLAR_DEMO_SECRET_KEY=""; npm run dev   # PowerShell
```

(Or temporarily blank `STELLAR_DEMO_SECRET_KEY` in `.env`, restart dev.)

```
curl -i http://localhost:3000/api/health
```

Expected: `HTTP/1.1 503`, header `Retry-After: 15`, body `{"error":"degraded","chain":"unconfigured","db":"ok","request_id":"..."}`. Restore env after.

- [ ] **Step 3.4: Commit**

```
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" add app/api/health/route.ts
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" commit -m "feat(api): add GET /api/health for UI pre-flight gating"
```

---

## Task 4: `Retry-After` header on `503 contract_not_configured`

**Files:**
- Modify: `app/api/escrow/lock/route.ts:189-191`
- Modify: `app/api/escrow/release/route.ts:122-125`
- Modify: `app/api/deposit/route.ts` (the catch block for `ContractNotConfiguredError`)
- Modify: `app/api/bills/pay/route.ts` (same)

- [ ] **Step 4.1: Find every `503 contract_not_configured`**

```
grep -n "contract_not_configured" app/api -r
```

Expected: four matches (`escrow/lock`, `escrow/release`, `deposit`, `bills/pay`).

- [ ] **Step 4.2: Add `retryAfterSeconds: 30` to each call**

For each match, transform:

```diff
-      return err(503, "contract_not_configured", e.message);
+      return err(503, "contract_not_configured", e.message, undefined, {
+        requestId,
+        retryAfterSeconds: 30,
+      });
```

30s matches the dev's typical "I'll fix the env and restart" window. Tune later if `npm run dev` cold-start is faster.

- [ ] **Step 4.3: Verify header is present**

(With `STELLAR_DEMO_SECRET_KEY` blanked, dev server running, and a valid Bearer token for the family seed.)

```
curl -i -X POST http://localhost:3000/api/escrow/lock -H "authorization: Bearer <jwt>" -H "content-type: application/json" -d '{"family_id":"22222222-2222-2222-2222-222222222222","wishlist_id":"<id>"}'
```

Expected: `HTTP/1.1 503`, header `Retry-After: 30`, body `{"error":"contract_not_configured",...,"request_id":"..."}`.

- [ ] **Step 4.4: Commit**

```
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" add app/api
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" commit -m "feat(api): set Retry-After on 503 contract_not_configured"
```

---

## Task 5: Replace polling deadline with `AbortSignal`

**Files:**
- Modify: `lib/stellar/contract.ts:113-187` (the `invokeContract` function)
- Test via: `npm run test:escrow-wiring`

- [ ] **Step 5.1: Replace the polling loop**

In `lib/stellar/contract.ts`, replace the existing `// PENDING or DUPLICATE → poll` block (lines ~165-186) with:

```ts
  // PENDING or DUPLICATE → poll until SUCCESS, FAILED, or the AbortSignal fires.
  // Why AbortSignal vs Date.now(): Date.now() only stops the next iteration —
  // a slow in-flight `getTransaction` keeps running for tens of seconds and
  // wedges a Next.js server action. AbortSignal cancels at the network layer.
  const ac = new AbortController();
  const timeoutHandle = setTimeout(() => ac.abort(), POLL_TIMEOUT_MS);
  try {
    while (!ac.signal.aborted) {
      const result = await server.getTransaction(send.hash);
      if (result.status === "SUCCESS") {
        return {
          txHash: send.hash,
          returnValue: result.returnValue
            ? scValToNative(result.returnValue)
            : undefined,
        };
      }
      if (result.status === "FAILED") {
        throw new ContractCallError("contract_call_failed", result);
      }
      await sleep(POLL_INTERVAL_MS, ac.signal);
    }
  } finally {
    clearTimeout(timeoutHandle);
  }

  throw new ContractCallError(
    "contract_call_timeout",
    `Did not see SUCCESS or FAILED for tx ${send.hash} within ${POLL_TIMEOUT_MS}ms`,
  );
}
```

> **SDK note:** `@stellar/stellar-sdk` 12.3.0's `rpc.Server.getTransaction` does not accept an `AbortSignal` directly. The cancel above is best-effort at the JS layer — `ac.signal.aborted` short-circuits the loop on the next tick. If the SDK call itself is mid-flight when timeout fires, the in-flight call still runs to completion, then the next loop iteration sees `aborted` and exits. That's still better than `Date.now()` because we never start a fresh `getTransaction` after timeout. To cancel the in-flight HTTP request itself, we'd need to wrap the SDK's internal fetch — out of scope for Day 5.

- [ ] **Step 5.2: Update `sleep` to honor the signal**

Replace the existing `sleep` function (line ~237) with:

```ts
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const handle = setTimeout(() => {
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(handle);
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
```

- [ ] **Step 5.3: Verify nothing regressed**

```
npm run test:escrow-wiring
```

Expected: `11 passed, 0 failed`. None of those tests trigger the polling loop, so they should be unaffected.

- [ ] **Step 5.4: Commit**

```
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" add lib/stellar/contract.ts
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" commit -m "feat(contract): replace Date.now() polling with AbortSignal timeout"
```

---

## Task 6: Idempotency guard for chain-modifying routes

**Files:**
- Create: `lib/api/idempotency.ts`
- Modify: `app/api/escrow/lock/route.ts`
- Modify: `app/api/escrow/release/route.ts`
- Modify: `app/api/deposit/route.ts`
- Modify: `app/api/bills/pay/route.ts`

- [ ] **Step 6.1: Write the idempotency module**

Create `lib/api/idempotency.ts`:

```ts
import { createHash } from "node:crypto";

/**
 * Server-process-local "is this exact request already in flight?" tracker.
 *
 * Use case: family double-clicks "Confirm Delivery". First click hits
 * /api/escrow/release and starts a 5-10s chain call. Second click MUST
 * NOT also call release_escrow — the contract would either error
 * ("escrow already released") OR succeed against the next escrow id if
 * a race window opens. Either way, the UI shows confusion.
 *
 * This module gives every chain-modifying route a single line at the top:
 *
 *     const lock = beginIdempotent(["release", family_id, wishlist_id]);
 *     if (!lock) return err(409, "in_flight", "...", undefined, { requestId });
 *     try { ... do work ... } finally { lock.release(); }
 *
 * Storage is in-memory and per-process — fine for the demo's single Node
 * instance. The Map self-trims via the TTL sweep below so a crashed
 * handler doesn't deadlock subsequent calls (60s TTL > 30s chain poll
 * timeout = safe).
 */

const inFlight = new Map<string, number>();
const TTL_MS = 60_000;

function key(parts: ReadonlyArray<string>): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export interface IdempotencyLock {
  release(): void;
}

/** Returns a lock object on success, or null when the key is already locked. */
export function beginIdempotent(parts: ReadonlyArray<string>): IdempotencyLock | null {
  const k = key(parts);
  const now = Date.now();

  // Lazy sweep: drop stale entries on each call. O(n) but n is tiny.
  for (const [otherK, expiresAt] of inFlight) {
    if (expiresAt <= now) inFlight.delete(otherK);
  }

  if (inFlight.has(k)) return null;
  inFlight.set(k, now + TTL_MS);

  return {
    release() {
      inFlight.delete(k);
    },
  };
}
```

- [ ] **Step 6.2: Wrap `app/api/escrow/lock/route.ts`**

After body validation, before "load wishlist":

```ts
import { beginIdempotent } from "../../../../lib/api/idempotency";

// ... inside POST, after const { family_id, wishlist_id } = validation;
const lock = beginIdempotent(["escrow/lock", family_id, wishlist_id]);
if (!lock) {
  return err(409, "in_flight", "An identical request is already being processed.", undefined, {
    requestId,
    retryAfterSeconds: 10,
  });
}
try {
  // ... existing handler body from supabase init through `return ok(...)`
} finally {
  lock.release();
}
```

> Pragmatic note: wrapping the entire body in `try { ... } finally` means every existing `return` inside is reached *before* `finally` runs, which is exactly what we want — the lock releases the moment the response is built. No restructuring of returns needed.

- [ ] **Step 6.3: Apply the same wrap to release, deposit, bills/pay**

For each:
- `app/api/escrow/release/route.ts` — key parts: `["escrow/release", family_id, wishlist_id]`
- `app/api/deposit/route.ts` — key parts: `["deposit", from_user_id, request_dedupe_id ?? "<no-dedupe>"]` (deposit doesn't have a `wishlist_id`; pass any caller-supplied dedupe id or fall back — for the demo, use `from_user_id` + the deposit amount as the discriminator: `["deposit", from_user_id, String(amount_stroops)]`)
- `app/api/bills/pay/route.ts` — key parts: `["bills/pay", family_id, bill_id]`

Use the exact field names from each route's body. If unsure, `cat` the route file and copy.

- [ ] **Step 6.4: Verify all routes still compile**

```
npm run test:escrow-wiring
```

Expected: `11 passed, 0 failed`.

- [ ] **Step 6.5: Verify idempotency by hand (dev server running)**

Two terminals. Terminal A (need a slow request — easiest is to point at a contract that doesn't exist by temporarily setting an invalid `NEXT_PUBLIC_CONTRACT_ID`, then firing a request):

```
curl -X POST http://localhost:3000/api/escrow/lock -H "authorization: Bearer <jwt>" -H "content-type: application/json" -d '{"family_id":"22222222-2222-2222-2222-222222222222","wishlist_id":"<id>"}' &
```

Within ~1 second, terminal B (same body):

```
curl -i -X POST http://localhost:3000/api/escrow/lock -H "authorization: Bearer <jwt>" -H "content-type: application/json" -d '{"family_id":"22222222-2222-2222-2222-222222222222","wishlist_id":"<id>"}'
```

Expected on B: `HTTP/1.1 409`, body `{"error":"in_flight","reason":"...","request_id":"..."}`, header `Retry-After: 10`. Restore the contract id after.

- [ ] **Step 6.6: Commit**

```
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" add lib/api/idempotency.ts app/api
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" commit -m "feat(api): add in-flight idempotency guard on chain-modifying routes"
```

---

## Task 7: `scripts/_test-no-stacktrace-leak.ts` + `npm run test:no-leaks`

**Files:**
- Create: `scripts/_test-no-stacktrace-leak.ts`
- Modify: `package.json` (add `"test:no-leaks"` script)

- [ ] **Step 7.1: Write the test script**

Create `scripts/_test-no-stacktrace-leak.ts`:

```ts
/**
 * Regression test: every error response must be human-readable. No SDK
 * internals, no `node_modules/` paths, no `TypeError:`, no JS stack frames.
 *
 * Assumes the dev server is running on http://localhost:3000.
 *
 * Run:  npm run test:no-leaks
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

// All probes are designed to PRODUCE an error response. We're auditing that
// the error response stays clean.
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

  // Health route — should always respond cleanly, even degraded.
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
      console.log(`  FAIL  ${p.label}  →  leaked ${label}`);
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
      // A fetch-level failure (server not running, etc.) is its own kind of
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

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 7.2: Add the npm script**

Modify `package.json` `"scripts"` block — insert the new line after `"test:escrow-wiring"`:

```diff
     "test:stellar-lib": "npx tsx scripts/_test-stellar-lib.ts",
     "test:escrow-wiring": "npx tsx scripts/_test-escrow-wiring.ts",
+    "test:no-leaks": "npx tsx scripts/_test-no-stacktrace-leak.ts",
```

- [ ] **Step 7.3: Run the test (dev server must be running)**

Terminal A:

```
npm run dev
```

Terminal B (once Terminal A says "Ready in <ms>"):

```
npm run test:no-leaks
```

Expected: every probe `ok`, final line `12 passed, 0 failed`. If any probe reports `FAIL ... leaked <pattern>`, copy the body excerpt and fix the leaking route before continuing.

- [ ] **Step 7.4: Commit**

```
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" add scripts/_test-no-stacktrace-leak.ts package.json package-lock.json
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" commit -m "test(api): add no-leaks regression test for error responses"
```

---

## Task 8: Final gate — verify P2 Day 5 acceptance criteria

**Files:** none (verification only)

- [ ] **Step 8.1: Re-run all three smoke suites**

```
npm run test:stellar-lib
npm run test:escrow-wiring
npm run test:no-leaks
```

Expected: all green.

- [ ] **Step 8.2: Cross-check against `DAY-5-TASKS.md` §P2 acceptance**

The plan satisfies all four §P2 gate criteria:
- ✅ `npm run test:no-leaks` passes (Task 7).
- ✅ `GET /api/health` returns `200` when env is filled, `503` when not (Task 3).
- ✅ `npm run test:escrow-wiring` still 11/11 (re-verified Tasks 2, 5, 6).
- ✅ All Day-5 additions ship in commits with a `feat(api)` / `test(api)` / `feat(contract)` prefix (every "Commit" step).

- [ ] **Step 8.3: Update `DAY-5-SUMMARY.md` table**

Find the §3 P2 (Rene) table in `DAY-5-SUMMARY.md` (lines 156-168) and flip each ❌ to ✅. Commit:

```
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" add DAY-5-SUMMARY.md
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" commit -m "docs: mark P2 Day 5 hardening items complete"
```

- [ ] **Step 8.4: Push to `Rene` branch**

```
git -C "C:/Users/Rene Vincent/OneDrive/Desktop/hello/HACKATHON/STELLAR/InternStellar-Hackathon" push origin Rene
```

> **Hold before pushing if:** any test from Step 8.1 failed, OR the `STELLAR_DEMO_SECRET_KEY` ↔ `profiles.stellar_public_key` mismatch from the setup-blockers section above isn't resolved AND you need to verify a real chain call before the rehearsal.

---

## What "done" looks like for P2

After all 8 tasks:

| Item | File / evidence |
|---|---|
| `request_id` on every response | `lib/api/request-id.ts` + every `ok()` / `err()` call wires it |
| `Retry-After` on `503 contract_not_configured` | All four catch blocks in chain routes |
| `GET /api/health` | `app/api/health/route.ts` returns 200 / 503 with cause |
| `AbortSignal` chain timeout | `lib/stellar/contract.ts` `invokeContract` polling loop |
| Idempotency on chain routes | `lib/api/idempotency.ts` + 4 route wraps |
| `npm run test:no-leaks` | `scripts/_test-no-stacktrace-leak.ts` + package.json script |

**Time estimate (focused):** 90–120 min for the code, +15 min for verification + commits + push. The biggest variable is Task 2 (`request_id` thread-through across 6 routes) — pure mechanical edits, no new logic.

---

## Cross-references

- [`DAY-5-TASKS.md`](DAY-5-TASKS.md) §"P2 (Rene)" — the source spec this plan implements.
- [`DAY-5-SUMMARY.md`](DAY-5-SUMMARY.md) §3 P2 — current status table to update on close-out.
- [`lib/api/errors.ts`](lib/api/errors.ts) — existing envelope contract this plan extends.
- [`lib/stellar/contract.ts`](lib/stellar/contract.ts) — `invokeContract` polling loop (Task 5).
- [`scripts/_test-escrow-wiring.ts`](scripts/_test-escrow-wiring.ts) — existing smoke suite; pattern for Task 7.
- [`docs/handoffs/p2-rene.md`](docs/handoffs/p2-rene.md) — P1's contract handoff with live smoke txs.
