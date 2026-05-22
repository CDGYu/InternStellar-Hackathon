# UPDATED-CHANGES-FOR-FINALIZATION — Evidence Log

> **Companion to:** [`FINALIZATION-10AM.md`](./FINALIZATION-10AM.md)
> **Pass author:** Rene + Claude Opus 4.7 (max effort)
> **Pass date:** 2026-05-22 (10:00–11:00 AM)
> **Scope as confirmed:** Backend hardening only. No contract rewrite.
> **Live deployment:** https://internstellar-eight.vercel.app — `ok: true` before and after this pass.
> **Live Supabase project:** `xeaqcbskmzjkjrrlndan`.

This document records:
1. **What changed** — every file touched + every migration applied, with diff stats.
2. **Why it changed** — short reasoning, traceable to a plan section.
3. **Evidence** — before/after counts from Supabase advisors and the live health probe.
4. **Open items** — owner actions still required, plus the mainnet-blocking architectural items deliberately deferred.

---

## 1. Verification snapshot

### 1.1. Supabase Security Advisor

| Lint | Before | After | Resolved by |
|---|---|---|---|
| `authenticated_security_definer_function_executable` (WARN) — `finalize_wishlist` callable by signed-in users | 1 | **0** | Task 1 (migration: `revoke_finalize_wishlist_from_authenticated`) |
| `rls_enabled_no_policy` (INFO) — `request_lock` | 1 | **0** | Task 6 (migration: `request_lock_deny_all_policy`) |
| `auth_leaked_password_protection` (WARN) | 1 | 1 | **Owner action — Supabase dashboard toggle** (Task 10 doc-only) |
| **Total** | **3** | **1** | |

### 1.2. Supabase Performance Advisor

| Lint family | Before | After | Resolved by |
|---|---|---|---|
| `unindexed_foreign_keys` (INFO) | 7 | **0** | Task 5 (migration: `cover_foreign_key_indexes`) |
| `auth_rls_initplan` (WARN) | 8 | **0** | Tasks 3 + 4 (migrations: `rls_initplan_wraps_bills_inventory`, `consolidate_wishlist_permissive_policies`) |
| `multiple_permissive_policies` (WARN) | 9 | **0** | Task 4 (migration: `consolidate_wishlist_permissive_policies`) |
| `unused_index` (INFO) | 1 | 8 | Expected — the 7 new covering indexes have no traffic yet; they'll graduate as soon as queries hit them. |
| **Total** | **25** | **8** | (all remaining are INFO unused-index) |

### 1.3. Live `/api/health` (deployed app)

Probed at https://internstellar-eight.vercel.app/api/health after each migration. Every probe (env presence, supabase_admin, stellar_rpc, stellar_signer, stellar_contract_id) returned `ok` throughout. The DB-side changes did not affect the live response shape.

```json
{
  "ok": true,
  "chain": "ok",
  "db": "ok",
  "contract_id": "CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF",
  "checks": {
    "env":                 { "...": "ok" (all 9 vars green) },
    "supabase_admin":      { "status": "ok" },
    "stellar_rpc":         { "status": "ok", "passphrase_matches": true, "protocol_version": 26 },
    "stellar_signer":      { "status": "ok", "public_key": "GA5M…HC6H" },
    "stellar_contract_id": { "status": "ok", "contract_id": "CB3V…GRDF" }
  }
}
```

### 1.4. Direct DB sanity

```sql
-- finalize_wishlist privileges (Task 1)
select grantee, privilege_type
  from information_schema.role_routine_grants
 where routine_schema='public' and routine_name='finalize_wishlist';
```
Returned only `postgres` + `service_role`. `authenticated` is gone. ✓

```sql
-- RLS policies (Task 4) — one policy per (table, action)
select tablename, policyname, cmd from pg_policies
 where schemaname='public'
   and tablename in ('wishlist','wishlist_item')
 order by tablename, cmd, policyname;
```
Returned:
- `wishlist`: `wishlist_select` (SELECT), `wishlist_insert` (INSERT), `wishlist_update` (UPDATE), `wishlist_delete` (DELETE). One per action. ✓
- `wishlist_item`: `read_all_wishlist_item` (SELECT), `wishlist_item_insert/update/delete`. ✓

---

## 2. What changed (file by file)

Diff stat from `git diff --stat` against `origin/main` (`63f24c1`):

```
 README.md              |  17 ++++++-
 db/bills.sql           |  14 +++++-
 db/functions.sql       |  14 ++++--
 db/policies.sql        | 134 ++++++++++++++++++++++++++++++++++-----------
 db/schema.sql          |  34 +++++++++++++
 lib/api/errors.ts      |   4 ++
 lib/stellar/network.ts |  15 +++++-
 next.config.mjs        |  18 ++++++-
 package.json           |   5 +-
 9 files changed, 210 insertions(+), 45 deletions(-)
```
Plus new files: `.eslintrc.json` at repo root, and `docs/system-updates/FINALIZATION-10AM.md` (the plan) + `docs/system-updates/UPDATED-CHANGES-FOR-FINALIZATION.md` (this doc) under the new system-updates folder.

### 2.1. `db/functions.sql` — Lock down `finalize_wishlist` (Task 1)

**Before:**
```sql
revoke all on function public.finalize_wishlist(uuid) from public;
grant  execute on function public.finalize_wishlist(uuid) to service_role;
grant  execute on function public.finalize_wishlist(uuid) to authenticated;
```

**After:**
```sql
revoke all     on function public.finalize_wishlist(uuid) from public;
revoke execute on function public.finalize_wishlist(uuid) from authenticated;
grant  execute on function public.finalize_wishlist(uuid) to service_role;
```

Comment block updated to reflect "service_role only" intent. The only intended caller, `/api/escrow/release`, runs as `service_role` already — so this change has zero functional impact on the demo path but closes the `/rest/v1/rpc/finalize_wishlist` REST surface that signed-in users could otherwise hit.

### 2.2. `lib/stellar/network.ts` — Env-driven network (Task 2)

**Before:** hardcoded `STELLAR_NETWORK = "testnet"` + `NETWORK_PASSPHRASE = Networks.TESTNET`.

**After:** both constants now read from `process.env.STELLAR_NETWORK` and `process.env.STELLAR_NETWORK_PASSPHRASE`, falling back to testnet when unset. Mainnet flip is now an env-only change (per the inline comment).

Importers (`lib/stellar/contract.ts:13`, `lib/stellar/bills.ts:10`, `lib/health.ts:5`) all still pull the same exported name (`NETWORK_PASSPHRASE`), so this is a backwards-compatible change. Verified at audit time that nothing imports `Networks.TESTNET` directly.

### 2.3. `db/policies.sql` — RLS consolidation + initplan wrap (Tasks 3 + 4)

Largest diff in the pass. Key changes:
- `auth_reads_inventory` policy now uses `(select auth.role()) = 'authenticated'` instead of `auth.role() = 'authenticated'`. Same semantics, cached per query.
- `family_reads_own_wishlist` + `store_reads_wishlist` + `family_writes_own_wishlist`(SELECT half) + `store_updates_wishlist` + `family_writes_wishlist_item`(SELECT half) — all dropped.
- Replaced with four wishlist policies (one per action) and three wishlist_item write policies (SELECT stays on the existing `read_all_wishlist_item`).
- Every `auth.uid()` and `auth.role()` call inside the new policies is wrapped in `(select …)`.

Functional equivalence to the prior ruleset:
| Surface | Before | After |
|---|---|---|
| Family reads own wishlists | ✓ via `family_reads_own_wishlist` | ✓ via `wishlist_select` (uid = family_id branch) |
| Store reads all wishlists | ✓ via `store_reads_wishlist` (any authenticated) | ✓ via `wishlist_select` (role='store' branch). Tightened — `authenticated` ≠ store before, but the only authenticated callers with cookie-bound reads are families/stores, and the family branch covers families. |
| Family creates own wishlist | ✓ via `family_writes_own_wishlist` (FOR ALL) | ✓ via `wishlist_insert` |
| Family updates own wishlist | ✓ via `family_writes_own_wishlist` (FOR ALL) | ✓ via `wishlist_update` (uid = family_id branch) |
| Family deletes own wishlist | ✓ via `family_writes_own_wishlist` (FOR ALL) | ✓ via `wishlist_delete` |
| Store marks delivered | ✓ via `store_updates_wishlist` | ✓ via `wishlist_update` (store branch) |
| Family adds/removes items | ✓ via `family_writes_wishlist_item` | ✓ via `wishlist_item_insert/update/delete` |

**Caveat — tightening on store reads.** The new `wishlist_select` requires `role='store'` for non-family callers. The old `store_reads_wishlist` allowed any authenticated user. For the single-store demo nothing changes: every authenticated non-family caller is the store role anyway. Worth knowing if the system ever grows a non-store-non-family authenticated role (e.g. an admin view).

### 2.4. `db/bills.sql` — initplan wrap + FK indexes (Tasks 3 + 5)

- `read_all_bills` and `read_all_bill_payments` now use `(select auth.role())`.
- Two new covering indexes appended: `bill_biller_id_idx`, `bill_payment_paid_by_idx`. Both `create index if not exists`, idempotent.

### 2.5. `db/schema.sql` — FK indexes + request_lock policy (Tasks 5 + 6)

- 5 new covering indexes appended next to their parent tables (`inventory_store_id_idx`, `wishlist_family_id_idx`, `wishlist_item_wishlist_id_idx`, `wishlist_item_inventory_id_idx`, `settlement_wishlist_id_idx`).
- New deny-all RLS policy on `request_lock` (`request_lock_no_direct_access`). RLS was already enabled; the policy makes the intent explicit and clears the advisor INFO.

### 2.6. `lib/api/errors.ts` — `Cache-Control: no-store` on error envelopes (Task 11)

Single header added to `err()`. Success envelopes are unchanged. Routes already use `dynamic = "force-dynamic"` so the broader response isn't cacheable, but defense-in-depth at the response-builder layer means any future caller of `err()` inherits the protection without thinking about it.

### 2.7. `next.config.mjs` — Security headers (Task 9)

Empty config replaced with five headers applied to every route via `async headers()`:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

CSP intentionally **not** added — needs careful allowlisting of Supabase realtime + Soroban RPC origins. Logged as a follow-up.

### 2.8. `package.json` — Lint + engines (Tasks 7 + 8)

- Added `"lint": "next lint"` script.
- Added `eslint@^8.57.0` + `eslint-config-next@^15.5.18` to `devDependencies`.
- Loosened `"engines": { "node": "20.x" }` → `"engines": { "node": ">=20.6.0" }`.

`npm install` not run in this session (no shell access to network); a fresh clone + install will pick these up. Vercel's deploy will install them automatically.

### 2.9. `.eslintrc.json` — New file (Task 7)

```json
{ "extends": ["next/core-web-vitals"] }
```

### 2.10. `README.md` — Dashboard toggle reminder (Task 10)

New section "One-time Supabase dashboard toggles" added under "How to Run Locally," instructing the project owner to flip Leaked Password Protection on in Supabase Auth.

---

## 3. Live migrations applied

In order of application (via Supabase MCP `apply_migration`):

| # | Name | Effect |
|---|---|---|
| 7 | `20260522021936_revoke_finalize_wishlist_from_authenticated` | Drops the `authenticated` execute grant on `finalize_wishlist`; updates the function comment. |
| 8 | `20260522022236_cover_foreign_key_indexes` | Adds 7 `create index if not exists` covering FKs flagged by the advisor. |
| 9 | `20260522022242_request_lock_deny_all_policy` | Creates `request_lock_no_direct_access` (FOR ALL using false / with check false). |
| 10 | `20260522022248_rls_initplan_wraps_bills_inventory` | Drops & re-creates `auth_reads_inventory`, `read_all_bills`, `read_all_bill_payments` with `(select auth.role())`. |
| 11 | `20260522022309_consolidate_wishlist_permissive_policies` | Replaces the overlapping wishlist + wishlist_item policies with one-per-action policies; wraps every `auth.uid()` in `(select …)`. |

Prior migrations through `20260520214313_day5_rls_full_apply` are untouched.

---

## 4. What was NOT done in this pass (explicitly)

These items were flagged during the audit and **deliberately left for follow-up** per the user's "backend hardening only" scope decision.

### 4.1. Mainnet-blocking architecture (will not work for real money without these)

| # | Item | What's needed | Owner |
|---|---|---|---|
| MB-1 | **Contract uses internal-bucket accounting** (`internstellar-contract/contracts/internstellar/src/lib.rs:66-270`). `deposit_and_split` records balances in `env.storage().persistent()` but no XLM ever moves. `release_escrow` increments the store's bucket counter — a numeric promise, not a payment. | Rewrite to Option B (SAC). Add a SAC client field, call `client.transfer(&from, &env.current_contract_address(), &amount)` in `deposit_and_split`, and `client.transfer(&env.current_contract_address(), &store, &amount)` in `release_escrow`. Re-run unit tests; redeploy; rotate `NEXT_PUBLIC_CONTRACT_ID`. | P1 (Prince) + P2 (Rene) |
| MB-2 | **Custodial demo signer** (`lib/stellar/contract.ts:67-97`, `lib/stellar/bills.ts:68-81`). Server-held `STELLAR_DEMO_SECRET_KEY` signs every transaction. On mainnet this is custody of user funds. | Replace with Freighter (or another non-custodial wallet) signing from the OFW / family browser; server only **submits** the signed tx. `CLAUDE.md` currently labels Freighter as "stretch ONLY"; must become the primary path. | P2 + P3 |
| MB-3 | **Bill payouts are direct XLM payments** (`lib/stellar/bills.ts:101-160`). Real billers (Meralco, Maynilad, etc.) take PHP, not XLM. | Partner with a Stellar Anchor (Cebuana / Tempo / Coins.ph) that does XLM ↔ PHP off-ramp + pushes PHP into legacy biller rails. Code-side: replace the `Operation.payment` with a path-payment or anchor-deposit op. | Business team + P2 |
| MB-4 | **Friendbot funding script** (`scripts/fund-test-account.ts`). | Friendbot doesn't exist on mainnet; funding becomes a manual treasury op. Document the runbook. | P4 (Charles) |
| MB-5 | **Settlement reconciliation job.** Today the comment in `app/api/escrow/release/route.ts:202` says "P4 audit job will reconcile" — but there is no audit job. | Cron / scheduled task that fetches contract events via Soroban RPC `getEvents` and diffs them against `settlement` rows; flags drift to ops. | P4 |

### 4.2. Follow-up items (non-blocking but worth doing)

| # | Item | Why deferred |
|---|---|---|
| FU-1 | **Content-Security-Policy header.** | Needs careful allowlist of Supabase realtime + Soroban RPC origins; would need to be drafted per env. |
| FU-2 | **Rate limiting on `/api/escrow/*` and `/api/bills/pay`.** | Requires a Redis/Upstash dep + middleware. Out of a hardening pass. |
| FU-3 | **Lint baseline cleanup.** `npm run lint` will produce a baseline warning count on first run; CI gating should wait until those are addressed. |
| FU-4 | **`Rene` branch on origin is diverged** (per `Needed-Minor-Updates-for-System-4-30AM.md` §7). Either delete or merge `main` into it. | Git hygiene — coordination with branch owner required. |
| FU-5 | **`profiles_sponsor_ofw_idx` unused index.** Pre-existing; advisor still flags it. Keep until usage shows up (the sponsor link is queried in the lock/release routes). |
| FU-6 | **Contract `Error` enum codes are positionally coupled to `lib/stellar/contract.ts:49-58`.** Inserting a new variant shifts later codes. Worth a doc comment on the Rust enum, not a refactor. |

### 4.3. Owner actions still required

| # | Action | Where | Why |
|---|---|---|---|
| OA-1 | Toggle on **Leaked Password Protection** | Supabase Dashboard → Authentication → Providers → Email | Clears the last security WARN; cannot be done via SQL/MCP. |
| OA-2 | Commit + push the file changes from §2 | `git add` the modified files + new `.eslintrc.json` + new planning docs, push to `main` | Vercel will redeploy with the security headers + Cache-Control + env-driven network module. |
| OA-3 | Verify response headers in production after redeploy | `curl -I https://internstellar-eight.vercel.app/` | Expect HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy. |
| OA-4 | (Optional) Run `npm run lint` locally and log the baseline count | Local terminal | Useful to size the lint-cleanup follow-up. |

---

## 5. Definition of done — sign-off checklist

- [x] All 11 in-scope tasks from `FINALIZATION-10AM.md` are applied (code + DB migrations).
- [x] Security advisor: 1 WARN remaining (leaked-password — owner action OA-1).
- [x] Performance advisor: 0 WARNs; 8 INFO `unused_index` (7 freshly added covering indexes + the pre-existing `profiles_sponsor_ofw_idx`).
- [x] Live `/api/health` returns `ok: true` (DB changes did not regress chain probes).
- [x] All DB consolidation policies validated via direct `pg_policies` query.
- [x] `finalize_wishlist` execute grants validated via `information_schema.role_routine_grants`.
- [ ] Code changes pushed and Vercel redeployed (owner action OA-2 + OA-3).
- [ ] Leaked-password-protection dashboard toggle flipped (owner action OA-1).

---

## 6. How to roll back any single change (if needed)

Each DB migration is named and self-contained. To roll back via `mcp__claude_ai_Supabase__apply_migration`:

```sql
-- Roll back Task 1
grant execute on function public.finalize_wishlist(uuid) to authenticated;

-- Roll back Task 5 (covering indexes — safe to keep, but if needed)
drop index if exists public.inventory_store_id_idx;
drop index if exists public.wishlist_family_id_idx;
-- (etc. for the rest of the 7)

-- Roll back Task 6
drop policy if exists request_lock_no_direct_access on public.request_lock;

-- Roll back Tasks 3 + 4: re-apply db/policies.sql + db/bills.sql from origin/main commit 63f24c1.
```

Code-side changes are revertable via `git revert` against the commit that lands them.

---

## 7. References

- Plan: [`FINALIZATION-10AM.md`](./FINALIZATION-10AM.md)
- Prior audit (4:30 AM): [`Needed-Minor-Updates-for-System-4-30AM.md`](./Needed-Minor-Updates-for-System-4-30AM.md)
- Project-wide conventions: [`CLAUDE.md`](../../CLAUDE.md)
- Supabase advisor docs:
  - `auth_rls_initplan` — https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
  - `multiple_permissive_policies` — https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies
  - `unindexed_foreign_keys` — https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
  - `authenticated_security_definer_function_executable` — https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
  - Leaked-password protection — https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
