# FINALIZATION-10AM — Backend Hardening Pass

> **Author:** Rene (with Claude Opus 4.7, max-effort mode)
> **Date:** 2026-05-22, 10:00 AM
> **Scope:** Backend hardening (Supabase + Next.js API + minor repo polish). **No contract rewrite.**
> **Inputs:** `Needed-Minor-Updates-for-System-4-30AM.md`, live audit of the repo at commit `63f24c1` (origin/main), live Supabase project `xeaqcbskmzjkjrrlndan`, live deployment at https://internstellar-eight.vercel.app.

---

## 0. Status snapshot

| Surface | State at start of pass |
|---|---|
| Vercel deployment | **Healthy.** `/api/health` returns `ok:true`; every probe green (env, supabase_admin, stellar_rpc, stellar_signer, stellar_contract_id). |
| Live contract | `CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF` on Soroban testnet, protocol v26. |
| DB migrations | 6 applied through `day5_rls_full_apply` (2026-05-20). |
| Security advisors (live) | 1 WARN (`finalize_wishlist` executable by authenticated), 1 WARN (leaked-password protection off), 1 INFO (`request_lock` RLS no-policy). |
| Performance advisors (live) | 7× unindexed FK (INFO), 8× auth-RLS-initplan (WARN), 9× multiple-permissive-policies (WARN), 1× unused index (INFO). |
| Local git tree | Clean wrt code; 3 untracked planning markdowns at root; branch `main` 2 commits ahead of `origin/main` per uncommitted edits to `README.md` + `docs/handoffs/p4-charles.md` only. |

The system is shippable as-is on **testnet**. This pass tightens production-grade backend hygiene before any future mainnet flip.

---

## 1. Mainnet-readiness gap analysis (NOT in this pass — for the team)

These are **architectural blockers** for true mainnet deployment. The user explicitly chose "backend hardening only" for this pass — these items are recorded here as the handoff list and will be repeated in `UPDATED-CHANGES-FOR-FINALIZATION.md`.

### 1.1. Contract uses internal-bucket accounting, not real XLM transfers

`internstellar-contract/contracts/internstellar/src/lib.rs:66-145` (`deposit_and_split`) and `lib.rs:222-270` (`release_escrow`) store balances in `env.storage().persistent()` keyed by `DataKey::{Util,Groc,Emerg}(Address)` and `DataKey::Escrow(u32)`. **No native XLM ever moves.** `release_escrow` increments the store's grocery-bucket counter — a numeric promise, not a payment.

On mainnet this means: an OFW "depositing" 1000 XLM has 1000 XLM debited from nowhere and the store's "received" balance is just storage state. To make real money move, the contract must hold a SAC client for native XLM (or a stablecoin), call `client.transfer(&from, &env.current_contract_address(), &amount)` in `deposit_and_split`, and `client.transfer(&env.current_contract_address(), &store, &amount)` in `release_escrow`. This is Option B in `lib.rs:248`. It is a **non-trivial rewrite**: contract tests change, error variants grow (transfer-failed cases), and the bridge in `lib/stellar/contract.ts` needs to surface SAC errors.

### 1.2. Demo signer model is custodial — illegal posture for mainnet

`lib/stellar/contract.ts:67-97` (`loadConfig`) and `lib/stellar/bills.ts:68-81` both load `STELLAR_DEMO_SECRET_KEY` and sign **every** transaction with it. On testnet this is fine (Friendbot-funded throwaway). On mainnet this means the server holds and signs against everyone's funds — that is custody of user assets, regulated under PH BSP rules, and a massive incident-response risk if the env var leaks.

Mainnet posture: Freighter (or another non-custodial wallet) signs `deposit_and_split` and `release_escrow` from the OFW / family browser; the server only *submits* the signed tx. Today the repo treats Freighter as "stretch ONLY" per `CLAUDE.md`. It must become the only path.

### 1.3. Bill payments are direct XLM transfers, not PHP off-ramps

`lib/stellar/bills.ts:101-160` (`payBill`) builds a Stellar payment op in native XLM to `biller.stellar_address`. On testnet that lands at a Friendbot-funded throwaway pubkey we control. On mainnet, Meralco/Maynilad/etc. have no Stellar wallet — they take PHP via legacy biller rails. This requires a **Stellar Anchor partnership** (Cebuana / Tempo / Coins.ph) that does the XLM↔PHP off-ramp and pushes PHP into the legacy biller rail. This is a business deal, not a code change.

### 1.4. Friendbot-funded signer cannot exist on mainnet

`scripts/fund-test-account.ts` (used by `npm run fund-test-account`) calls Friendbot. Friendbot does not exist on mainnet. Funding becomes a manual treasury operation.

### 1.5. Audit + reconciliation tooling is absent

Settlements table is append-only audit ✓, but there is no script that: (a) lists on-chain events for the contract id, (b) cross-checks them against `settlement` rows, (c) flags drift. Today the only safety net is the comment "P4 audit job will reconcile" in the release route — there is no audit job. Mainnet must have one. Out of this pass, but logged for the team.

---

## 2. In-scope tasks (DO these now)

Tasks are ordered so each one can be tested in isolation. Numbering follows execution order.

### Task 1 — Lock down `finalize_wishlist` RPC

**Why:** Supabase Security Advisor WARN. The function is `SECURITY DEFINER` and grants `EXECUTE` to `authenticated`. Any signed-in user can call `/rest/v1/rpc/finalize_wishlist` with any wishlist id and decrement that store's inventory. The only intended caller is `/api/escrow/release` running under `service_role`, which bypasses RLS anyway and does not need the `authenticated` grant.

**Files:**
- Modify: `db/functions.sql:43-48` (drop `grant ... to authenticated`)
- Apply: new migration via `apply_migration` MCP tool against project `xeaqcbskmzjkjrrlndan`

**Steps:**

- [ ] **1.1** Edit `db/functions.sql` and remove the `grant execute on function public.finalize_wishlist(uuid) to authenticated;` line. Keep the `service_role` grant.

  Before (lines 45-47):
  ```sql
  revoke all on function public.finalize_wishlist(uuid) from public;
  grant  execute on function public.finalize_wishlist(uuid) to service_role;
  grant  execute on function public.finalize_wishlist(uuid) to authenticated;
  ```
  After:
  ```sql
  revoke all on function public.finalize_wishlist(uuid) from public;
  revoke execute on function public.finalize_wishlist(uuid) from authenticated;
  grant  execute on function public.finalize_wishlist(uuid) to service_role;
  ```
  Update the trailing comment on the function (lines 49-50) to remove the line about being callable by authenticated.

- [ ] **1.2** Apply the change to the live DB via `apply_migration`:
  ```sql
  revoke execute on function public.finalize_wishlist(uuid) from authenticated;
  ```
  Migration name: `2026-05-22-revoke-finalize-wishlist-from-authenticated`.

- [ ] **1.3** Re-run `mcp__claude_ai_Supabase__get_advisors(type=security)` and confirm the `authenticated_security_definer_function_executable` lint is gone.

### Task 2 — Make Stellar network env-driven

**Why:** `lib/stellar/network.ts:3-4` hardcodes `STELLAR_NETWORK = "testnet"` and `NETWORK_PASSPHRASE = Networks.TESTNET`. A future mainnet flip requires editing this file. The env already carries `STELLAR_NETWORK_PASSPHRASE` (visible in `/api/health` probes), and the health probe at `lib/health.ts:174-176` already falls back from env to `Networks.TESTNET`. Make the network module match that pattern so a single env change moves the whole app onto a different network.

**Files:**
- Modify: `lib/stellar/network.ts` (whole file)

**Steps:**

- [ ] **2.1** Rewrite `lib/stellar/network.ts` to read `STELLAR_NETWORK_PASSPHRASE` and `STELLAR_NETWORK` from env, falling back to testnet for back-compat. Export a `getNetworkPassphrase()` function (for code that runs late after env load) and keep `NETWORK_PASSPHRASE` as a top-level for current importers (`lib/stellar/contract.ts:13`, `lib/stellar/bills.ts:10`, `lib/health.ts:5`).

  Final file:
  ```ts
  import { Networks } from "@stellar/stellar-sdk";

  // Stellar network selection. Both vars come from .env.local / Vercel env;
  // we keep the testnet fallback so a freshly-cloned dev environment still
  // boots without these set. To flip to mainnet, set:
  //   STELLAR_NETWORK="mainnet"
  //   STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
  //   STELLAR_RPC_URL=<a mainnet Soroban RPC>
  //   STELLAR_HORIZON_URL="https://horizon.stellar.org"
  // and redeploy. No code change required.
  export const STELLAR_NETWORK: string =
    process.env.STELLAR_NETWORK ?? "testnet";

  export const NETWORK_PASSPHRASE: string =
    process.env.STELLAR_NETWORK_PASSPHRASE ?? Networks.TESTNET;
  ```

- [ ] **2.2** Verify no caller does `import { Networks }` AND expects the typed `Networks.TESTNET` literal; they all use the exported constant. Confirmed by grep at audit time — `contract.ts:13`, `bills.ts:10`, `health.ts:5` all import `NETWORK_PASSPHRASE` only.

### Task 3 — Wrap `auth.uid()` calls in RLS policies with `(select …)`

**Why:** Supabase Performance Advisor WARN (8 lints). Each call to `auth.uid()` inside a policy `USING`/`WITH CHECK` clause is re-evaluated **per row** by Postgres' planner. Wrapping in `(select auth.uid())` caches the value for the duration of the query, dropping per-row eval cost. Same fix for `auth.role()`. Affects `bill`, `bill_payment`, `inventory`, `wishlist`, `wishlist_item`.

**Files:**
- Modify: `db/policies.sql` (wishlist + wishlist_item + inventory policies — the ones owned by this file)
- Modify: `db/bills.sql` (bill + bill_payment policies)
- Apply: new migration

**Steps:**

- [ ] **3.1** Read `db/bills.sql` to confirm exact current policies on `bill` and `bill_payment` (audit showed `read_all_bills` and `read_all_bill_payments` exist).

- [ ] **3.2** In `db/policies.sql`, replace:
  - `auth.role() = 'authenticated'` → `(select auth.role()) = 'authenticated'`
  - `auth.uid() = family_id` → `(select auth.uid()) = family_id`
  - Inside the `exists (...)` subqueries that compare `p.id = auth.uid()` → `p.id = (select auth.uid())`
  - Inside the wishlist_item policy's join: `w.family_id = auth.uid()` → `w.family_id = (select auth.uid())`

- [ ] **3.3** In `db/bills.sql`, apply the same `(select auth.<fn>())` wrap to `read_all_bills` and `read_all_bill_payments` policies.

- [ ] **3.4** Apply via `apply_migration` as a single statement set named `2026-05-22-rls-initplan-wraps`. Each policy must be `drop policy if exists` then `create policy` (Postgres can't `alter` policies — drop+recreate is the supported form).

- [ ] **3.5** Re-run `get_advisors(type=performance)`. Confirm all 8 `auth_rls_initplan` lints are gone (the multiple_permissive lints in Task 4 are independent and may remain until Task 4).

### Task 4 — Consolidate multiple permissive policies on `wishlist` and `wishlist_item`

**Why:** Supabase Performance Advisor WARN (9 lints, hottest tables in the app). When two `permissive` policies fire for the same role + action, Postgres evaluates **both** for every row of every query. Today `wishlist` has three SELECT policies (`family_reads_own_wishlist`, `family_writes_own_wishlist`'s `FOR ALL` half, `store_reads_wishlist`) all triggering on `SELECT`, and `wishlist_item` has two (`family_writes_wishlist_item` FOR ALL + `read_all_wishlist_item`). Fix is to merge each role's SELECT path into one policy.

**Files:**
- Modify: `db/policies.sql`
- Apply: migration

**Steps:**

- [ ] **4.1** In `db/policies.sql`, restructure the wishlist policies so SELECT and UPDATE each have one policy per role, joined with `OR`:
  - Replace the existing `family_reads_own_wishlist` and `store_reads_wishlist` SELECT policies with one `wishlist_select` policy:
    ```sql
    create policy wishlist_select on wishlist
      for select
      using (
        (select auth.uid()) = family_id
        OR exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'store')
      );
    ```
  - Keep `family_writes_own_wishlist` but change `for all` → `for insert, update, delete` so it stops also firing on SELECT (the new `wishlist_select` covers reads).
  - Keep `store_updates_wishlist` as-is (only UPDATE, but `family_writes_own_wishlist` still UPDATEs the same row when the caller is the family — these two coexist deliberately so a family can update its own wishlist AND a store can update any wishlist).
  - Actually consolidate UPDATE the same way: one `wishlist_update` policy:
    ```sql
    create policy wishlist_update on wishlist
      for update
      using (
        (select auth.uid()) = family_id
        OR exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'store')
      )
      with check (
        (select auth.uid()) = family_id
        OR exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'store')
      );
    ```
  - Keep `family_writes_own_wishlist` ONLY for INSERT and DELETE then. (Or drop it entirely if INSERT/DELETE only happens server-side via service_role — at audit time `app/api/wishlist/route.ts` writes via service_role, but `WishlistBuilder.tsx` may write via the cookie-bound client. Verify before dropping.)

- [ ] **4.2** For `wishlist_item`, replace `family_writes_wishlist_item` (FOR ALL) + `read_all_wishlist_item` (SELECT) with:
  - `wishlist_item_select` — SELECT, `using (true)` (line items are demo-public)
  - `wishlist_item_write` — INSERT/UPDATE/DELETE, gated by the family-owns-parent check (existing logic)

- [ ] **4.3** Apply as migration `2026-05-22-consolidate-permissive-policies`.

- [ ] **4.4** Smoke test from the deployed app: log in as the demo family (`cora.family@internstellar.demo`), open `/wishlists`, confirm own wishlists list. Log in as `nena.store@internstellar.demo`, open `/store`, confirm orders queue loads. If either reads break, roll the migration back (statement-by-statement is fine).

- [ ] **4.5** Re-run `get_advisors(type=performance)`. Confirm `multiple_permissive_policies` lints on `wishlist` and `wishlist_item` are gone.

### Task 5 — Add covering indexes for unindexed foreign keys

**Why:** Supabase Performance Advisor INFO (7 FKs). Joins through these FKs do sequential scans. With small demo data this is invisible, but on mainnet inventory or wishlist growth this becomes the first noticeable slowdown. Adding `btree(fkey_col)` indexes is cheap and idempotent (`create index if not exists`).

**Files:**
- Modify: `db/schema.sql` (append the `create index` statements after the relevant table)
- Apply: migration

**Steps:**

- [ ] **5.1** Add to `db/schema.sql` (one per affected FK):
  ```sql
  create index if not exists bill_biller_id_idx        on bill (biller_id);
  create index if not exists bill_payment_paid_by_idx  on bill_payment (paid_by);
  create index if not exists inventory_store_id_idx    on inventory (store_id);
  create index if not exists settlement_wishlist_id_idx on settlement (wishlist_id);
  create index if not exists wishlist_family_id_idx    on wishlist (family_id);
  create index if not exists wishlist_item_inventory_id_idx on wishlist_item (inventory_id);
  create index if not exists wishlist_item_wishlist_id_idx  on wishlist_item (wishlist_id);
  ```
  (Place each index next to its parent `create table` so future edits stay co-located.)

- [ ] **5.2** Apply as migration `2026-05-22-cover-foreign-key-indexes`. Each `create index if not exists` is idempotent.

- [ ] **5.3** Re-run `get_advisors(type=performance)`. Confirm all 7 `unindexed_foreign_keys` lints are gone.

### Task 6 — Add no-op policy to `request_lock`

**Why:** Supabase Security Advisor INFO. The table has RLS enabled with zero policies, which means **nothing** can read or write it through PostgREST. The only callers are `try_idempotency_lock` + `release_idempotency_lock` RPCs, which are `SECURITY DEFINER` and run as the function owner (bypassing RLS). The current setup is *safe* — the lint is purely informational — but a one-line policy denying all direct REST access makes the intent explicit and clears the advisor.

**Files:**
- Modify: `db/schema.sql` (after the `request_lock` `create table` block)
- Apply: migration

**Steps:**

- [ ] **6.1** Append to `db/schema.sql` after the `create table request_lock` block:
  ```sql
  alter table request_lock enable row level security;
  drop policy if exists request_lock_no_direct_access on request_lock;
  create policy request_lock_no_direct_access on request_lock
    for all using (false) with check (false);
  ```

- [ ] **6.2** Apply as migration `2026-05-22-request-lock-deny-all`.

- [ ] **6.3** Re-run `get_advisors(type=security)`. Confirm `rls_enabled_no_policy` lint for `request_lock` is gone.

### Task 7 — ESLint configuration

**Why:** From the previous test (`Needed-Minor-Updates-for-System-4-30AM.md` §1). `next lint` is not wired up; nothing enforces `next/core-web-vitals`. Catches `<a>` instead of `<Link>`, missing `key` props, useless `<img>` etc. — the cheap wins. Easy to add; harder to retroactively fix every warning. Strategy: add the config + script, run lint once, log baseline warning count to the changes doc, and **don't** block CI on lint until the baseline is cleaned up.

**Files:**
- Create: `.eslintrc.json`
- Modify: `package.json` (add `lint` script + `eslint` + `eslint-config-next` to devDependencies)

**Steps:**

- [ ] **7.1** Create `.eslintrc.json` at the repo root:
  ```json
  { "extends": ["next/core-web-vitals"] }
  ```

- [ ] **7.2** In `package.json`, add `"lint": "next lint"` to `scripts` and `"eslint": "^8.57.0"` + `"eslint-config-next": "^15.5.18"` to `devDependencies`.

- [ ] **7.3** Run `npm install` to pull in eslint + eslint-config-next.

- [ ] **7.4** Run `npm run lint` once. Note the warning count in the changes doc. Do not auto-fix (we don't want a noisy diff in a hardening PR).

### Task 8 — Loosen `engines.node`

**Why:** From `Needed-Minor-Updates-for-System-4-30AM.md` §2. `"node": "20.x"` is stricter than Vercel's Node 22 default, producing an `EBADENGINE` warning on every install. Loosen to a range that accepts both.

**Files:**
- Modify: `package.json:40-42`

**Steps:**

- [ ] **8.1** Change `"engines": { "node": "20.x" }` → `"engines": { "node": ">=20.6.0" }`.

### Task 9 — Add security headers to Next.js config

**Why:** `next.config.mjs` currently exports an empty config. The deployment serves no `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, or `X-Frame-Options` headers. These are free, blanket hardening; they don't change app behavior, only how browsers treat the response.

**Files:**
- Modify: `next.config.mjs`

**Steps:**

- [ ] **9.1** Replace `next.config.mjs` with:
  ```js
  /** @type {import('next').NextConfig} */
  const securityHeaders = [
    // 2 years, includeSubDomains, preload-eligible. Safe because every
    // deploy origin (Vercel) is already HTTPS-only.
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options",    value: "nosniff" },
    { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options",           value: "DENY" },
    { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
  ];

  const nextConfig = {
    async headers() {
      return [
        { source: "/(.*)", headers: securityHeaders },
      ];
    },
  };

  export default nextConfig;
  ```

- [ ] **9.2** Skip CSP for now. A useful CSP for this app (Supabase realtime + Soroban RPC) needs more careful drafting than fits a hardening pass; defer to a follow-up.

### Task 10 — Document leaked-password protection toggle

**Why:** Supabase Security Advisor WARN. Dashboard-only setting; cannot enable via SQL/MCP. Add a step to the README's "first-time setup" section so a future re-deploy doesn't lose this.

**Files:**
- Modify: `README.md` (add a one-line setup step under environment configuration)

**Steps:**

- [ ] **10.1** Find the "environment" / "Supabase" section of `README.md` and append a bullet:
  > **One-time Supabase dashboard toggle:** Supabase Dashboard → Authentication → Providers → Email → toggle **on** "Leaked password protection." Required for production; the security advisor flags it otherwise.

- [ ] **10.2** Note: this is a *documentation* change. The actual toggle needs to be flipped by the project owner in the dashboard, and is recorded in `UPDATED-CHANGES-FOR-FINALIZATION.md` as a pending owner action.

### Task 11 — Add `Cache-Control: no-store` to error envelopes

**Why:** Minor robustness. `lib/api/errors.ts:35-54` (`err()`) returns plain JSON without a `Cache-Control` header. CDN/proxy caches between Vercel and the user could (theoretically) cache a 503 / 409 / 401 response and serve a stale "in_flight" or "contract_not_configured" body to a later, fresh request. Adding `no-store` to error responses costs nothing and removes the surprise. Success responses already pass through Next's `dynamic = "force-dynamic"` per-route flag, so they're fine.

**Files:**
- Modify: `lib/api/errors.ts:35-54`

**Steps:**

- [ ] **11.1** In the `err()` function, after the existing `headers.set("X-Request-Id", requestId)` line, add `headers.set("Cache-Control", "no-store");`.

---

## 3. Testing pass

Each task above includes its own validation step. This section is the end-to-end re-test after all tasks are applied. Run in this order:

### 3.1. Advisor re-scan (DB)

- [ ] Run `mcp__claude_ai_Supabase__get_advisors(project_id=xeaqcbskmzjkjrrlndan, type=security)`. Expect to see at most:
  - 1 WARN: `auth_leaked_password_protection` (Task 10 is documentation-only; owner action pending).
  - Everything else cleared.
- [ ] Run `mcp__claude_ai_Supabase__get_advisors(project_id=xeaqcbskmzjkjrrlndan, type=performance)`. Expect:
  - 0 `unindexed_foreign_keys` lints.
  - 0 `auth_rls_initplan` lints.
  - 0 `multiple_permissive_policies` lints.
  - `unused_index profiles_sponsor_ofw_idx` may remain (data too small for the planner to bother).

### 3.2. Live deployment smoke

- [ ] `WebFetch https://internstellar-eight.vercel.app/api/health` → expect HTTP 200, `ok: true`, every probe `ok`. (Note: this runs *before* code deploy, so will show the deployed state; after deploy, re-run.)
- [ ] After redeploy, fetch `/` and inspect response headers. Expect:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: DENY`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] Fetch `/api/escrow/lock` with a deliberately bad body (`{}`) and check the response carries `Cache-Control: no-store`.

### 3.3. Functional regression (golden path)

Run the existing scripts; they exercise the wire shape the routes guarantee.

- [ ] `npm install` (picks up new eslint deps)
- [ ] `npm run lint` (logs baseline warning count; not gating)
- [ ] `npm run verify-stellar` (talks to live testnet RPC; verifies the env-driven network module loads correctly)
- [ ] `npx tsx scripts/_test-escrow-wiring.ts` (exercises the family→lock→deliver→release path against the live deployment using demo creds)
- [ ] `npx tsx scripts/_test-no-stacktrace-leak.ts` (confirms error envelopes still don't leak XDR / stack traces — important now that we touched `lib/api/errors.ts`)

### 3.4. Manual UI sanity (browser)

- [ ] Open https://internstellar-eight.vercel.app/
- [ ] Sign in as `cora.family@internstellar.demo` / `demo123456` → reach `/family` → wishlists list still loads.
- [ ] Sign in as `nena.store@internstellar.demo` → reach `/store` → orders queue still loads.
- [ ] Sign in as `maria.ofw@internstellar.demo` → reach `/ofw` → balances panel still renders.
- [ ] (No need to execute a full deposit→lock→release cycle unless an earlier step failed; the wiring scripts cover the chain side.)

### 3.5. Lint-the-lints

After the advisor re-scan, paste the new clean-or-near-clean output into `UPDATED-CHANGES-FOR-FINALIZATION.md` as evidence-before-claims.

---

## 4. Out-of-pass items (for the handoff doc)

These get listed verbatim in `UPDATED-CHANGES-FOR-FINALIZATION.md` § "Open for next pass":

1. **Mainnet contract rewrite** (§1.1 above) — Option B / SAC integration.
2. **Replace demo signer with Freighter** (§1.2) — kill `STELLAR_DEMO_SECRET_KEY` from chain-modifying routes.
3. **Stellar Anchor partnership for bill payouts** (§1.3) — Cebuana / Tempo / Coins.ph.
4. **Settlement reconciliation job** (§1.5) — cron that diffs on-chain events vs `settlement` rows.
5. **`Rene` branch on origin** (`Needed-Minor-Updates-for-System-4-30AM.md` §7) — delete or merge `main` into it.
6. **Owner action**: flip on **Authentication → Providers → Email → Leaked password protection** in the Supabase Dashboard.
7. **CSP header** — drafted thoughtfully in a follow-up; needs to allowlist Supabase realtime + Soroban RPC origins.
8. **Rate limiting** on `/api/escrow/*` and `/api/bills/pay` — would need a Redis/Upstash dep; out of scope here.
9. **Sequence renumbering of contract errors** — the `Error` enum in `lib.rs:21-30` is matched by integer in `lib/stellar/contract.ts:49-58`. Any future variant insertion shifts later codes. Worth a doc comment, not a refactor.

---

## 5. Definition of done for this pass

- [ ] All 11 in-scope tasks above are applied (code + DB migrations).
- [ ] Security advisor: 1 WARN remaining (leaked password, owner action).
- [ ] Performance advisor: ≤ 1 INFO remaining (unused index).
- [ ] Live `/api/health` returns `ok: true` after redeploy.
- [ ] All response headers from §3.2 present.
- [ ] No regression in golden path (§3.3 + §3.4 pass).
- [ ] `UPDATED-CHANGES-FOR-FINALIZATION.md` written and contains every change applied + every advisor reading before/after + every owner action still pending.
