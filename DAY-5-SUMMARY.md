# InternStellar — Day 5 Summary (2026-05-21)

**Audience:** the whole team.
**What this is:** a snapshot of everything that landed on `main` today, who
owns each piece, and what's still open for Day 5 / Day 6.

> Day 5's stated outcome (per [`DAY-5-TASKS.md`](DAY-5-TASKS.md)) is: demo
> is reset-able with one command, errors are human-readable, pitch deck is
> near-final, two rehearsals run. Status of each item is in §3 below.

---

## 1. What landed on `main` today

Today was the big integration day — Day 1-4 work from `Rene`, `Prince`, and
`Charles` branches got merged in alongside the `Frontend` branch and P4's
own Day 5 reset work. `main` now contains the end-to-end stack for the
first time.

Today's commits (`git log --since="2026-05-21"`):

| Commit | Author | What it brought in |
|---|---|---|
| `1a6ce56` | CDGYu | **Frontend** — all three role pages, settings, auth flow, shared UI components |
| `3e27594` | CDGYu | Merge `Prince` — Day 1-4 Soroban contract source + 22 snapshot tests + docs reorg |
| `a80fad9` | CDGYu | Merge `Charles` — initial pitch deck + handoff docs |
| `e342e50` | CDGYu | Merge `Rene` — 5 API routes, contract bridge, auth + error envelope, wiring smoke test |
| `254ab47` | CDGYu | **Functions and Wiring** — `finalize_wishlist` RPC + release route inventory decrement + bills feature + reset script |
| `bda3e5e` | CDGYu | Merge `Charles` — Day 5 pitch + rehearsal docs |
| `57f5f2c` | Rene Cosme | `DAY-5-TASKS.md` plan |

Net: **101 files changed, ~19.7k insertions** since the previous tip.

---

## 2. By team member — what shipped

### P1 (Prince) — Contract layer

Days 1-4 source landed via `internstellar-contract/`.

- `contracts/internstellar/src/lib.rs` — `deposit_and_split`,
  `get_balances`, `lock_escrow(family, store, amount)`, `release_escrow`.
- `contracts/internstellar/src/test.rs` — 22 unit tests, all green
  locally (snapshots committed under `test_snapshots/test/`).
- Day 4 contract id (testnet):
  `CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF`.
- On-chain events: `deposit` / `esc_lock` / `esc_rel`.
- Live smoke txs recorded in `docs/handoffs/p2-rene.md`.

### P2 (Rene) — API + chain bridge

Five HTTP routes, all under `app/api/`, all sharing the
`{ error, reason?, ...context? }` envelope from `lib/api/errors.ts`.

| Route | File |
|---|---|
| `POST /api/deposit` | `app/api/deposit/route.ts` |
| `POST /api/wishlist` | `app/api/wishlist/route.ts` |
| `POST /api/escrow/lock` | `app/api/escrow/lock/route.ts` |
| `POST /api/escrow/release` | `app/api/escrow/release/route.ts` |
| `GET /api/balances/[user_id]` | `app/api/balances/[user_id]/route.ts` |
| `POST /api/bills/pay` *(today, Day 5+)* | `app/api/bills/pay/route.ts` |

Supporting libs:

- `lib/stellar/contract.ts` — `depositAndSplit`, `lockEscrow`,
  `releaseEscrow`, `getBalances`, `ContractCallError` /
  `ContractNotConfiguredError`, panic-string mapping.
- `lib/stellar/bills.ts` — bills payment helper (new today).
- `lib/api/auth.ts` — `requireUser(req)` Bearer JWT verification.
- `lib/api/client.ts` — shared API helper for the UI.
- `scripts/_test-escrow-wiring.ts` — 11/11 pass.

### P3 (Gerardo/Charles) — Frontend

All three role views are present with real components (no longer empty
shells):

- **OFW (`app/(app)/ofw/`)** — `SendFundsForm`, `BillsPanel`,
  `OfwWishlistRow`, `TransactionHistory`, `actions.ts`, page.
- **Family (`app/(app)/family/`)** — `BalanceBreakdown`,
  `WishlistBuilder`, `ConfirmDeliveryButton`, page.
- **Store (`app/(app)/store/`)** — `MarkDeliveredButton`,
  `OrdersRealtimeRefresher`, `ReceiptCard`, page.
- **Auth (`app/(auth)/`)** — `login/`, `register/`, plus
  `app/auth/actions.ts`, `confirm/`, `confirmed/`, `role-routes.ts`.
- **Settings (`app/settings/`)** — account, contact, data-privacy,
  help, privacy, report-bug, terms.
- **Shared UI (`components/ui/`)** — `Button`, `Card`, `Input`,
  `DashboardHeader`, `Stat`, `StatusPill`, `ThemeToggle`, icons, etc.
- **Dashboard server helpers (`lib/dashboard/`)** — `ofw.ts`,
  `family.ts`, `store.ts`.

### P4 (Charles) — Data layer + Day 5 ownership

Schema is unchanged from the Day-2 lock; everything below is additive
or operational.

**SQL (`db/`):**
- `schema.sql` — 5 tables (LOCKED Day 2).
- `policies.sql` — RLS read policies per role + open `dev_write_*`.
- `realtime.sql` — `wishlist` / `wishlist_item` / `settlement` in the
  realtime publication, `replica identity full`.
- `grants.sql` — `service_role` granted on all 5 tables + default
  privileges for future tables.
- `functions.sql` — `finalize_wishlist(p_wishlist_id)` RPC for
  inventory decrement (called from `/api/escrow/release`).
- `bills.sql` *(new today)* — `biller` / `bill` / `bill_payment`
  tables for the OFW Bills panel.
- `reset.sql` *(new today)* — `reset_demo()` RPC: truncates
  settlement + wishlist_item + wishlist, resets `inventory.stock = 50`.
  `SECURITY DEFINER`, `service_role` only.
- `seed.sql` + `seed-ofw-demo.sql` — 3 demo users + 8 inventory rows,
  fixed UUIDs (`1111…`/`2222…`/`3333…`), password `demo123456`.

**Scripts (`scripts/`):**
- `reset-demo.ts` *(new today)* — Node runner: calls `reset_demo()`
  RPC, optionally tops up the demo signer via Friendbot.
- `setup-billers.ts` *(new today)* — generates Meralco/Maynilad
  Stellar testnet keypairs, Friendbots them, INSERTs biller rows +
  demo bills.

**package.json scripts (new today):**
- `npm run reset` — full reset (DB + Friendbot top-up).
- `npm run reset:db-only` — DB reset only.
- `npm run setup-billers` — one-shot biller bootstrap.

**Docs:**
- `docs/pitch/pitch-deck-outline.md` — 10-slide run-of-show with
  speaker notes (still needs real OFW stats, screenshots, diagram).
- `docs/pitch/rehearsal.md` — rehearsal script + post-mortem template.
- `DAY1-4-SUMMARY-OF-NEEDED-UPDATES.md` — closing audit + UI
  integration contract for P3.
- `DAY-5-TASKS.md` — this week's plan (authored by Rene).

---

## 3. Day 5 task gate — current status

Cross-referenced against [`DAY-5-TASKS.md`](DAY-5-TASKS.md).

### P1 (Prince) — ❌ Edge cases + demo script

| Item | Status |
|---|---|
| `n_deposits_accumulate_without_overflow` | ❌ not added |
| `deposit_max_safe_total_does_not_panic` | ❌ not added |
| `lock_escrow_twice_creates_two_distinct_escrows` | ❌ not added |
| `release_escrow_on_balance_only_credits_store_no_underflow` | ❌ not added |
| `get_balances_on_store_with_zero_credit_returns_zeroes` | ❌ not added |
| `internstellar-contract/scripts/demo.sh` | ❌ not created |

22 existing tests still green; the four Day-5 additions are the gap.

### P2 (Rene) — ✅ Friendly errors + hardening

| Item | Status |
|---|---|
| `scripts/_test-no-stacktrace-leak.ts` + `npm run test:no-leaks` | ✅ done (12 probes, 0 leaks) |
| `GET /api/health` route | ✅ done (`app/api/health/route.ts`) |
| `Retry-After` header on `503 contract_not_configured` | ✅ done (deposit, escrow/lock, escrow/release, balances, bills/pay all set `Retry-After: 30`; health sets `15`) |
| `request_id` field on every response | ✅ done (`lib/api/request-id.ts` + every `ok()`/`err()` carries it; `X-Request-Id` response header set; inbound `X-Request-Id` is honored if UUID v4) |
| `AbortSignal`-based timeout (replace `Date.now()` polling) | ✅ done (`lib/stellar/contract.ts` `invokeContract` uses `AbortController` + `setTimeout(abort, POLL_TIMEOUT_MS)`; `sleep()` honors the signal) |
| Idempotency hash on `(family_id, wishlist_id, route)` | ✅ done (`lib/api/idempotency.ts` sha256-keyed in-memory tracker, 60s TTL; lock/release/deposit/bills/pay all wrapped) |

Reference plan: [`DAY5-P2-TASKS.md`](DAY5-P2-TASKS.md). Verification: `npm run test:stellar-lib` (4/4) + `npm run test:escrow-wiring` (11/11) + `npm run test:no-leaks` (12/12).

### P4 (Charles) — ✅🟡 Reset + pitch + rehearsal

| Item | Status |
|---|---|
| `db/reset.sql` (`reset_demo()` RPC) | ✅ done |
| `scripts/reset-demo.ts` | ✅ done |
| `npm run reset` / `npm run reset:db-only` in `package.json` | ✅ done |
| 3× reset reliability test | 🟡 needs to be run by an operator |
| Pitch deck near-final — structure + speaker notes | ✅ done |
| Pitch deck — real OFW stats (Worldbank/BSP citation) | 🟡 placeholder |
| Pitch deck — real screenshots of OFW/Family/Store views | 🟡 placeholder |
| Pitch deck — clean diagram (Excalidraw/Mermaid) | 🟡 placeholder |
| Two timed rehearsals, < 3 min each | ❌ not run yet |

### Cross-cutting — ❌ open

| Item | Owner | Status |
|---|---|---|
| Drop `dev_write_*` RLS policies (or replace narrowly) | P4 | ❌ not done |
| Rotate Supabase `service_role` key | P4 (operator) | ❌ unverified |
| Fill `STELLAR_DEMO_SECRET_KEY` in `.env.local` | P4 (operator) | ❌ unverified |
| `golden-path-v1` git tag (Day 4 carry-over) | All | ❌ not tagged |
| `day-5-reset-ready` git tag | P4 | ❌ not tagged |

---

## 4. Suggested order for the next pass

1. **P4 operator step (5 min):** paste `STELLAR_DEMO_SECRET_KEY` into
   `.env.local`, rotate `service_role`. Without this, every chain call
   returns `503 contract_not_configured` and rehearsals can't run.
2. **P4 reliability check (5 min):** `npm run reset` three times in a
   row, confirm zero-warning output each time.
3. **P1 (45-60 min):** add the four edge-case tests to
   `internstellar-contract/contracts/internstellar/src/test.rs`,
   `cargo test`, then write `internstellar-contract/scripts/demo.sh`
   per the spec in `DAY-5-TASKS.md` §"Demo script".
4. **P2 (60-90 min):** ship `GET /api/health` first (gates UI's
   pre-flight check), then `npm run test:no-leaks`, then
   `request_id` / `AbortSignal` / idempotency in one commit.
5. **All hands (30 min):** first timed rehearsal with P1 driving the
   UI + P1 falling back to `demo.sh` if anything breaks. `npm run reset`
   between runs.
6. **P4 close-out:** drop `dev_write_*` policies (P3 now writes via
   Supabase anon-key reads + P2's routes only). Tag
   `day-5-reset-ready`.

---

## 5. Open questions for the team

- Does P3's "Mark delivered" button go through P2's API or stay on
  direct anon-key writes? Answer decides whether `dev_write_wishlist`
  is dropped or replaced with the narrow `store_marks_delivered`
  policy from `DAY-5-TASKS.md` §"Tighten RLS".
- Bills feature: scoped for the demo or a stretch? `db/bills.sql` +
  `lib/stellar/bills.ts` + `app/api/bills/pay` are all built; needs a
  call-out on whether the live demo includes it.
- Stretch ideas (cancellation route, Soroban event replay timeline,
  `getEvents` from RPC) — defer to Day 6 or drop entirely?

---

## Cross-references

- [`DAY-5-TASKS.md`](DAY-5-TASKS.md) — the per-role Day 5 plan.
- [`DAY1-4-SUMMARY-OF-NEEDED-UPDATES.md`](DAY1-4-SUMMARY-OF-NEEDED-UPDATES.md) — Day 1-4 audit + UI integration contract.
- [`docs/pitch/pitch-deck-outline.md`](docs/pitch/pitch-deck-outline.md) — pitch deck content.
- [`docs/pitch/rehearsal.md`](docs/pitch/rehearsal.md) — rehearsal script.
- [`docs/handoffs/p2-rene.md`](docs/handoffs/p2-rene.md) — P1 → P2 contract handoff with live smoke txs.
- [`docs/handoffs/p4-charles.md`](docs/handoffs/p4-charles.md) — P1 → P4 handoff.
- [`internstellar-contract/contracts/internstellar/src/lib.rs`](internstellar-contract/contracts/internstellar/src/lib.rs) — the contract.
- [`lib/stellar/contract.ts`](lib/stellar/contract.ts) — chain bridge.
- [`db/*.sql`](db/) — data layer.
