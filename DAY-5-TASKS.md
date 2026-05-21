# Day 5 — Tasks (Harden + Reset + Pitch)

**Prereq:** Day 1-4 work landed and the UI is functional end-to-end
(P3 finishes UI integration before this doc kicks in). See
[`DAY1-4-SUMMARY-OF-NEEDED-UPDATES.md`](DAY1-4-SUMMARY-OF-NEEDED-UPDATES.md)
for the state P3 builds on top of.

**Day 5 outcome:** demo is reset-able with one command, errors are
human-readable everywhere, pitch deck is near-final, and the team has
rehearsed at least twice with P1 driving.

> This doc lists **everything Day 5 needs** based on what the repo
> already has (commit `b3605c6`). UI-specific items (e.g. loading
> spinners on buttons) are flagged because P3 is mid-integration —
> Day 5 will revisit them when the UI is live.

---

## ⏱️ Status as of 2026-05-21 EOD

Today (2026-05-21) the Day 1-4 work from `Rene`, `Prince`, `Charles`,
and `Frontend` branches all merged into `main` — `main` now carries
the full end-to-end stack for the first time. See
[`DAY-5-SUMMARY.md`](DAY-5-SUMMARY.md) for the full integration log.

Day 5 task gate at end of 2026-05-21:

| Owner | Item | Status |
|---|---|---|
| P1 | 4 new edge-case tests in `src/test.rs` | ✅ done (5 added, `cargo test` 27/27 green) |
| P1 | `internstellar-contract/scripts/demo.sh` | ✅ done (syntax-checked; testnet run is operator step) |
| P2 | `GET /api/health` route | ✅ done |
| P2 | `scripts/_test-no-stacktrace-leak.ts` + `npm run test:no-leaks` | ✅ done (run against a live `next dev`) |
| P2 | `request_id` / `Retry-After` / `AbortSignal` / idempotency | ✅ done |
| P4 | `db/reset.sql` (`reset_demo()` RPC) | ✅ done |
| P4 | `scripts/reset-demo.ts` + `npm run reset` | ✅ done |
| P4 | 3× reset reliability run | 🟡 operator step (not run yet) |
| P4 | Pitch deck structure + speaker notes | ✅ done (`docs/pitch/pitch-deck-outline.md`) |
| P4 | Pitch deck — real stats, screenshots, diagram | 🟡 placeholders |
| All | Two timed rehearsals (< 3 min each) | ❌ not run yet |
| P4 | Drop / replace `dev_write_*` RLS policies | ✅ done |
| P4 | Rotate Supabase `service_role` key | ✅ done |
| P4 | Fill `STELLAR_DEMO_SECRET_KEY` in `.env.local` | ✅ done (filled + Protocol-23 SDK fix + profile pubkey resync, 2026-05-21) |
| All | `golden-path-v1` git tag (Day 4 carry-over) | ❌ not tagged |
| P4 | `day-5-reset-ready` git tag | ❌ not tagged |

**Net:** P4 reset/pitch work is in; P1 contract edges + P2 API
hardening + operator steps are the blockers before rehearsal #1.

**Bonus shipped today (not in the original Day 5 plan but landed
anyway):** `db/bills.sql` + `lib/stellar/bills.ts` +
`app/api/bills/pay/route.ts` + `scripts/setup-billers.ts` +
`npm run setup-billers`. Bills payment is wired end-to-end; team needs
to decide on Day 6 whether to include it in the live demo or hide it.

---

## P1 (Prince) — Contract edge cases + demo script

### Already covered (22 tests pass on `internstellar-contract/`)

Don't redo these — they're green:

| Edge case | Test |
|---|---|
| Two deposits accumulate correctly | `second_deposit_accumulates_running_balance` |
| Uneven split keeps total exact | `remainder_trick_preserves_total_for_uneven_split` |
| Reject `total <= 0` | `rejects_zero_total`, `rejects_negative_total` |
| Reject percentages ≠ 100 | `rejects_percentages_summing_above_100`, `_below_100` |
| `get_balances` returns 0 for new user | `get_balances_returns_zeroes_for_new_user` |
| Lock without funds | `lock_escrow_rejects_amount_above_grocery_balance` |
| Lock with zero amount | `lock_escrow_rejects_zero_amount` |
| Lock when family == store | `lock_escrow_rejects_family_equals_store` |
| Release credits store bucket | `release_escrow_credits_store_grocery_bucket` |
| Multiple releases to one store accumulate | `release_escrow_credits_accumulate_when_store_serves_multiple_families` |
| Double release blocked | `release_escrow_rejects_double_release` |
| Release unknown id | `release_escrow_rejects_unknown_id` |
| All three events emit exactly once | `*_emits_exactly_one_event_from_our_contract` |

### Day 5 additions (the task language → concrete tests)

**"Re-deposit (no panic)"** — currently only 2 deposits tested. Add:
- `n_deposits_accumulate_without_overflow` — loop 5+ deposits at sensible
  amounts, assert running balance is sum.
- `deposit_max_safe_total_does_not_panic` — pick a total close to
  `i128::MAX / 100` so the `total * pct` multiply is at the edge but
  safe; assert no panic.

**"Double-confirm (no panic)"** — release-side covered, lock-side gap:
- `lock_escrow_twice_creates_two_distinct_escrows` — same family, same
  store, two locks: assert IDs are 1 and 2, both stored, family's groc
  bucket debited twice.

**"Zero balance (no panic)"** — partially covered, add the reverse:
- `release_escrow_on_balance_only_credits_store_no_underflow` — release
  one escrow back-to-back from a fresh family (groc is already moved to
  escrow at lock time, so this proves the release path doesn't touch
  family's groc).
- `get_balances_on_store_with_zero_credit_returns_zeroes` — call
  `get_balances(store)` before any release fires.

**Demo script (`internstellar-contract/scripts/demo.sh` — new):**

A runnable bash script that drives the Golden Path on testnet via
`stellar contract invoke`. One file, one command. Steps:

```
1. stellar identity ensure-funded internstellar (Friendbot if balance == 0)
2. deposit_and_split 60/30/10 of 1000 XLM (= 10_000_000_000 stroops)
3. get_balances → assert returns (6e9, 3e9, 1e9)
4. lock_escrow family=internstellar store=<demo-store-pubkey> amount=2e9
5. get_balances family → assert groc dropped to 1e9
6. release_escrow escrow_id=1
7. get_balances store → assert returns (0, 2e9, 0)
8. Print all 3 tx hashes with stellar.expert URLs
```

Goal: when P1 demos live and the UI breaks, P1 can fall back to
running `./scripts/demo.sh` and walk judges through the chain side
purely via CLI + explorer.

### P1 Day 5 gate
- All new tests pass (`cd internstellar-contract && cargo test`).
- `./scripts/demo.sh` runs clean end-to-end against testnet from a
  fresh shell, no hidden setup.
- Push to `Prince` branch.

---

## P2 (Rene) — Friendly errors + chain-call hardening

### Already in place

- Standardised `{ error, reason?, ...context? }` envelope on every route.
- `ContractCallError` vs `ContractNotConfiguredError` distinguished.
- Panic-string mapping for all 11 known contract panics (in
  `lib/stellar/contract.ts` → `KNOWN_PANIC_STRINGS`).
- `console.error` for internals; no XDR / stack-trace leaks to clients.
- `POLL_TIMEOUT_MS = 30_000` on chain submissions.
- `503 contract_not_configured` when env is missing (no mocks).

### Day 5 additions (the task language → concrete work)

**"Friendly error states everywhere (no stack traces)"** — audit pass.
Confirm none of these 5 routes leak SDK internals:

| File | Audit checklist |
|---|---|
| `app/api/deposit/route.ts` | catch blocks return `{ error, reason }`; `e.detail` never serialised |
| `app/api/wishlist/route.ts` | DB errors clean; `e.message` never returned |
| `app/api/escrow/lock/route.ts` | contract errors filtered through `extractPanicReason`; supabase errors logged not returned |
| `app/api/escrow/release/route.ts` | same; `finalize_wishlist` RPC failure soft-warns (`inventory_finalized: false`) |
| `app/api/balances/[user_id]/route.ts` | balances tuple decode failure mapped to `balances_return_unexpected` |

Action: a one-shot grep test that fails on regressions —
`scripts/_test-no-stacktrace-leak.ts` — POSTs malformed bodies and
broken JWTs to each route and asserts no response field matches
`/at .* \(.*:\d+:\d+\)|TypeError:|node_modules/`. Add as
`npm run test:no-leaks`.

**"Loading spinners on every chain call"** — UI-side (P3), BUT P2 can:
- Add `Retry-After: <seconds>` header on `503 contract_not_configured`
  so the UI can back off cleanly.
- Add `GET /api/health` — returns `{ chain: "ok"|"unconfigured", db: "ok"|"err" }`
  so the UI can disable buttons proactively before chain calls fail.
- Confirm Next.js Server Action handlers never block on chain calls
  longer than the existing 30s poll timeout — they already don't.

**Chain-call hardening (Day 5 stretch, low effort):**
- Replace `Date.now()`-based polling deadline with an `AbortSignal` so
  the SDK call is actually cancelled at timeout (currently it just
  stops polling — the in-flight HTTP request keeps running).
- Add a `request_id` (`crypto.randomUUID()`) to every response — both
  success AND error — so support requests are traceable in logs.
- Idempotency: hash `(family_id, wishlist_id, route)` and reject a
  second concurrent identical request with `409 in_flight` while the
  first is mid-chain. Prevents double-click double-locks.

### P2 Day 5 gate
- `npm run test:no-leaks` passes.
- `GET /api/health` returns `200` when env is filled, `503` when not.
- `npm run test:escrow-wiring` still 11/11.
- All Day-5 additions ship in one commit with a `feat(api)` prefix.

---

## P4 (Charles) — Reset script + pitch + rehearsal

### Existing data state (verified just now via Supabase)

- 5 tables RLS-on, with seed data + 4 residual wishlists + 8 residual
  settlement rows from earlier P1/P2 testing.
- `db/seed.sql` is current and idempotent for profiles + inventory.
- `finalize_wishlist` RPC is live.

### Day 5 additions (the task language → concrete work)

**`db/reset.sql` (new) — one-shot truncate + reseed sequence:** ✅ **shipped 2026-05-21** as `reset_demo()` Postgres RPC (idempotent, `SECURITY DEFINER`, `service_role` only). The actual file diverges from the snippet below — it uses an RPC wrapper instead of inline SQL so `npm run reset` is one round-trip. See current `db/reset.sql`.

```sql
-- Clean transactional state (keeps schema/policies/grants)
truncate public.settlement,
         public.wishlist_item,
         public.wishlist cascade;

-- Reset inventory stock to seed values without re-running seed.sql
update public.inventory set stock = 50;

-- profiles + auth.users + auth.identities stay — they're the demo logins.
-- stellar_public_key seed lives in seed.sql; re-run if profiles get nuked.
```

Idempotent. Re-runnable many times during rehearsals.

**`scripts/reset-demo.ts` (new) — Node runner:** ✅ **shipped 2026-05-21** (161 lines, loads `.env.local`, calls `reset_demo()` RPC, best-effort Friendbot top-up unless `--db-only`). See current `scripts/reset-demo.ts`.

```ts
// Reads .env.local for SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL.
// Executes db/reset.sql via the admin client.
// Optionally checks fund-test-account balance and tops up via Friendbot
//   if STELLAR_DEMO_SECRET_KEY is set.
// Prints: "Demo reset complete. {wishlists=0, settlements=0, stock=50}".
```

Add to `package.json`: ✅ **shipped 2026-05-21** — both scripts are in `package.json` (with the flag spelled `--db-only` rather than `--skip-funding`). Also shipped: `"setup-billers"` for the new bills feature.
```
"reset":               "npx tsx scripts/reset-demo.ts",
"reset:db-only":       "npx tsx scripts/reset-demo.ts --db-only"
```

Test it 3× in a row. Must be boring and reliable. **TODO (operator):** run the 3× reliability check.

**Pitch deck near-final** — fill in
[`docs/pitch/pitch-deck-outline.md`](docs/pitch/pitch-deck-outline.md):
- Slide 2: real OFW remittance stats (Worldbank or BSP, cite source).
- Slide 4: real screenshots of OFW / Family / Store views (needs UI
  to be functional — coordinate with P3).
- Slide 6: clean diagram (Excalidraw / Mermaid), screenshot in.
- Slide 9: four faces, role labels per merged `README.md`.
- Slide 10: the ask (mentorship / pilot / grant).
- Speaker notes per slide.

Don't pick fonts. Don't theme-hunt. Headlines + bullets + visuals.

**Rehearse with P1** — two full runs:
- Time the live demo (target < 3 min for a 5-min slot).
- Run `npm run reset` between runs.
- P1 drives, P2 + P4 watch and note every moment that's confusing or slow.
- Decide what to fix Day 6 vs. accept-with-workaround.

### P4 Day 5 gate
- `npm run reset` returns to a clean state in < 5 seconds, run 3× in a row.
- Pitch deck has every slide filled (placeholders OK only on
  team-photos slide).
- Two rehearsals timed.
- Day 5 commit tagged optionally as `day-5-reset-ready`.

---

## Cross-cutting (all four)

### Tighten RLS (P4, optional but recommended)

`db/policies.sql` ships with `dev_write_*` policies that allow any
authenticated user to write anywhere. Once P3 finishes UI integration
and the store's "Mark delivered" button goes through either Supabase
direct write OR a P2 route, drop these policies:

```sql
drop policy dev_write_profiles      on public.profiles;
drop policy dev_write_inventory     on public.inventory;
drop policy dev_write_wishlist      on public.wishlist;
drop policy dev_write_wishlist_item on public.wishlist_item;
drop policy dev_write_settlement    on public.settlement;
```

If P3 keeps using anon-key writes for "Mark delivered", add a narrow
replacement policy:

```sql
create policy store_marks_delivered on public.wishlist
  for update using (auth.role() = 'authenticated' and status = 'locked')
  with check (status = 'delivered');
```

Otherwise drop all five — P2's routes use `service_role` which
bypasses RLS regardless.

### Service-role key rotation (P4, security carry-over)

Old leaked key is still live in earlier git history. Day 5 is the last
day to rotate cleanly:
1. Supabase Dashboard → Project Settings → API → Reset service_role.
2. Update local `.env.local`.
3. Out-of-band share with team.

### Operator-level env fill (carry-over)

`.env.local` needs `STELLAR_DEMO_SECRET_KEY` for chain calls to
actually fire. If still empty going into Day 5, the rehearsal will fail
on every chain call. Resolve before the first rehearsal.

### Tag the working commit (optional)

After the first clean reset + rehearsal:
```
git tag -a day-5-reset-ready -m "Day 5 — reset script + hardened errors verified"
```

Different from `golden-path-v1` (which Day 6 owns once the UI
demo is fully timed and recorded).

---

## What "done" looks like end-of-Day-5

| Gate | Owner | Acceptance criterion |
|---|---|---|
| Contract edge cases | P1 | All 22+N tests pass; `./scripts/demo.sh` runs clean on testnet from a fresh shell |
| API hardening | P2 | `npm run test:no-leaks` green; `GET /api/health` returns 200; `request_id` in every response |
| Reset script | P4 | `npm run reset` 3× in a row produces identical clean state |
| Pitch deck | P4 | Every slide has real content (one placeholder allowed) |
| Rehearsal | All | 2 timed runs, < 3 min each, post-mortem notes captured |
| Service-role rotation | P4 | Old key no longer accepted by Supabase |
| RLS tightening | P4 | `dev_write_*` policies either dropped or replaced |

If all seven are green, Day 5 closes and Day 6 (rehearsal + submission)
can start without backend or data risk.

---

## Cross-references

- [`DAY1-4-SUMMARY-OF-NEEDED-UPDATES.md`](DAY1-4-SUMMARY-OF-NEEDED-UPDATES.md) — what shipped through Day 4 + UI integration contract.
- [`docs/handoffs/p2-rene.md`](docs/handoffs/p2-rene.md) — P1's contract handoff to P2 (Day 4 final state).
- [`docs/handoffs/p4-charles.md`](docs/handoffs/p4-charles.md) — P1's outgoing to P4.
- [`docs/working-guide/`](docs/working-guide/) — P1's day-by-day plans (Day 5 not yet written here — this doc fills the gap).
- [`docs/pitch/pitch-deck-outline.md`](docs/pitch/pitch-deck-outline.md) — slides to fill on Day 5.
- [`internstellar-contract/contracts/internstellar/src/test.rs`](internstellar-contract/contracts/internstellar/src/test.rs) — 22 existing tests to extend.
- [`db/`](db/) — SQL files; `reset.sql` to be added.
- [`scripts/`](scripts/) — `reset-demo.ts` to be added.
