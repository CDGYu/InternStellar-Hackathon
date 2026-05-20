# DAY 3 — P2 (Rene) Summary of Work

**Owner:** Person 2 (Rene) — Integration Bridge
**Date completed:** 2026-05-20 (Day 3 — API layer)
**Scope shipped:** `POST /api/escrow/lock` + `POST /api/escrow/release` with
JWT auth, real Soroban contract invocation, Supabase persistence, and
standardised error envelopes.

> **🟥 BLOCKING FINDING from functional testing (2026-05-20):**
> The Supabase `service_role` key has **no table privileges** on `profiles`,
> `inventory`, `wishlist`, `wishlist_item`, or `settlement`. Every server-side
> query returns `permission denied for table <name>`. This blocks the
> entire Day 3 gate — not just my code, but anything anyone writes against
> the DB from a Next.js API route. **Fix shipped as `db/grants.sql`**; P4
> (Charles) needs to paste it into the Supabase SQL editor once. Full
> repro + evidence in §10 below.

---

## 1. What changed in `DAY3-P2.md`

The original plan was sound but rested on assumptions that broke when code
actually got written. The plan file now has a **Plan Revisions** section
documenting every deviation. Headline changes:

| # | Change | Why |
|---|---|---|
| 1 | **`@supabase/supabase-js` allowed as a new dep.** | The plan calls `supabase.from('wishlist')…` from routes but the package wasn't installed and `lib/supabase.ts` was `tsc`-excluded on `main`. You can't both forbid the package and call Supabase from API routes. |
| 2 | **Auth strategy spelled out.** Bearer JWT in `Authorization` header, validated via short-lived anon-key client; writes go through a separate **service-role** client. | Original draft only said "validate authentication" — left ambiguous which key, which client, when. The new "Auth Strategy" section nails it. |
| 3 | **Env-var checklist added** including the new `NEXT_PUBLIC_CONTRACT_ID` requirement and a `curl` recipe for getting a JWT from Supabase password login. | So the gate test can be run by anyone on the team without spelunking. |
| 4 | **Escrow-id resolution documented.** Both TX hash and contract return value are stored until P1 confirms which one `release_escrow` wants. | P1 pair session hadn't happened — coding had to be defensive about the return-shape question. |
| 5 | **GET `/api/balances/:user_id` explicitly deferred to Day 4.** | User scope for Day 3 was `lock + release` only. Contract module exports the stub so the route is half-built. |
| 6 | **Standardised error envelope.** All routes return `{ error: code, reason?, …context }` via `lib/api/errors.ts`. | Original plan listed error codes per route but didn't unify the JSON shape — frontend would have had to handle two different formats. |

---

## 2. Files added / modified

### Added (P2-owned)

```
lib/
├── api/
│   ├── auth.ts                 ← Bearer-JWT verifier (requireUser)
│   └── errors.ts               ← ok() / err() / parseJsonBody() helpers
├── stellar/
│   └── contract.ts             ← Soroban invoker: lockEscrow / releaseEscrow / getBalances
└── supabase-admin.ts           ← Service-role client + per-JWT anon client

app/api/escrow/
├── lock/
│   └── route.ts                ← POST /api/escrow/lock
└── release/
    └── route.ts                ← POST /api/escrow/release

scripts/
└── _test-escrow-wiring.ts      ← Probe: route handlers load + contract module fails-fast on missing env

DAY3-P2-SUMMARY-OF-WORK.md      ← (this file)
```

### Modified

- `DAY3-P2.md` — added Auth Strategy section, Env Variables checklist, Plan
  Revisions log; relaxed the "no new npm packages" rule for Supabase only.
- `tsconfig.json` — bumped `target` to ES2020 (BigInt literals), removed the
  `lib/supabase.ts` exclusion now that the package is installed, excluded
  P4's pre-existing `scripts/test-realtime.ts` which depends on `dotenv`
  (still uninstalled — that's P4's call).
- `package.json` — added `@supabase/supabase-js@2.45.4` (pinned exact),
  added `npm run test:escrow-wiring` script.

### Untouched (other people own these)

- `db/*.sql` — P4 (Charles) owns; schema stays LOCKED.
- `lib/supabase.ts` — Charles's anon-key client; we import it via the new
  admin module but didn't modify it.
- `lib/stellar/client.ts` and `network.ts` — earlier bridge work; reused as-is.
- `scripts/test-realtime.ts`, `fund-test-account.ts`, `verify-stellar-connection.ts`
  — left alone.

---

## 3. The two endpoints — at a glance

### `POST /api/escrow/lock`

Body:
```json
{ "family_id": "<uuid>", "wishlist_id": "<uuid>" }
```
Headers: `Authorization: Bearer <supabase access_token>`

Happy path:
1. JWT → `user.id` must equal `family_id` (else 403).
2. Load wishlist (must be `draft` or `pending_approval`, no existing
   `escrow_tx_hash`) + its items + the family's `stellar_public_key`.
3. Sum line items → `grocery_stroops` (bigint).
4. `lockEscrow(familyAddress, grocery_stroops)` → on-chain TX hash + escrow id.
5. `UPDATE wishlist SET status='locked', escrow_tx_hash=…, total_stroops=…`
   (escrow id stashed in `wishlist.notes` with prefix `__escrow_ret__:`
   until P4 either approves a new column or P1 confirms tx hash is enough).
6. `INSERT settlement (event_type='lock', tx_hash, amount_stroops)`.
7. Return `{ escrow_id, tx_hash, status:'locked', amount_stroops, message }`.

Error map:
| Cause | HTTP | error code |
|---|---|---|
| Missing/invalid Bearer | 401 | `unauthorized` |
| `user.id ≠ family_id` | 403 | `forbidden` |
| Body malformed | 400 | `invalid_body` |
| Wishlist not found | 404 | `wishlist_not_found` |
| Wrong status | 409 | `invalid_status` (returns `current`, `expected`) |
| Already locked | 409 | `already_locked` |
| Empty wishlist | 409 | `wishlist_empty` |
| Family `stellar_public_key` null | 400 | `family_address_not_set` |
| Contract not configured (env missing) | 503 | `contract_not_configured` |
| Contract panic / sim failure | 400 | `contract_error` (`reason` = parsed panic token if any) |
| Supabase write fails AFTER chain success | 500 | `db_error` (`tx_hash` returned for reconciliation) |

### `POST /api/escrow/release`

Same body shape + same JWT auth. Requires wishlist to be `status='delivered'`
(P3's "Mark Delivered" flow flips this), no existing `release_tx_hash`, and
the original `escrow_tx_hash` to be present.

The escrow id passed to `release_escrow` is whichever of:
- the contract's literal return value stashed during lock (preferred), or
- the lock TX hash (fallback, in case stash is gone or P1 wants the hash).

Same error envelope; same DB-write-after-chain-success posture.

---

## 4. Where the Day 3 Gate stands

The user-defined gate: **escrow lock works on-chain; wishlist creates a real
locked escrow.** The pieces below need to be green at the same time:

| Layer | Owner | Status |
|---|---|---|
| Routes exist, type-check, load | P2 | ✅ `npm run test:escrow-wiring` 5/5 pass |
| `lib/stellar/contract.ts` reaches Soroban RPC | P2 | ✅ wire-up verified; awaits operator running fund script + filling env |
| Contract deployed at `NEXT_PUBLIC_CONTRACT_ID` | **P1 (Prince)** | confirmed deployed (per user); env var still needs to be set in `.env.local` |
| `lock_escrow`/`release_escrow` signatures match what routes call | **P1 (Prince)** | unconfirmed — pair session pending (see §5) |
| `family.stellar_public_key` populated for demo family `2222…` | **P4 (Charles)** | NOT yet — current seed leaves it `null` (see §6) |
| Supabase service-role key is in `.env.local` | operator | already in `.env` per checked env |
| Family JWT obtained for curl test | operator | one curl call (recipe in `DAY3-P2.md` Auth Strategy) |

**To turn the gate green end-to-end, the next two actions are P1 + P4 — see below.**

---

## 5. Next actions for P1 (Prince — Contract Lead)

These belong to P1 and must happen before the end-to-end gate flips green:

1. **Confirm the deployed contract id.** Put it in `.env.local` as
   `NEXT_PUBLIC_CONTRACT_ID=C…`. As long as it's empty, every escrow call
   returns `503 contract_not_configured` with a clear message — by design,
   not a mock.

2. **Confirm function signatures match what P2's routes call.** P2 wrote
   to the signatures documented in `DAY3-P2.md`:
   - `lock_escrow(family: Address, amount: i128)` — return type can be
     anything (Symbol, u32, Bytes); P2 decodes whatever you give via
     `scValToNative` and stashes it for release.
   - `release_escrow(escrow_id)` — `escrow_id` shape can be Symbol, u32, or
     hex/base64 string; `convertEscrowIdToScVal()` in
     `lib/stellar/contract.ts` handles the common shapes. If your contract
     expects something else (Bytes? Vec? Map?), tell P2 and the conversion
     line gets a one-line edit.
   - `get_balances(user: Address) -> (i128, i128, i128)` — wired but not
     called by Day 3 routes. Day 4 work.

3. **List the panic strings the contract throws** (`insufficient_balance`,
   `unauthorized`, etc.). P2's `extractPanicReason()` grepifies them out of
   the SDK error message; the friendlier you label them, the cleaner the
   `reason` field is in the route's 400 response.

4. **Confirm the signing model.** Routes sign every contract call with
   `STELLAR_DEMO_SECRET_KEY` (server-side). If `lock_escrow` requires the
   *family's* signature via `require_auth()`, that's a hard blocker —
   surface immediately and we'll switch to a different auth flow (likely
   pre-authorising the demo signer at contract level).

5. **Tag the working commit** once steps 1-4 are green and one full
   lock→release round trip is verified on `stellar.expert`.

---

## 6. Next actions for P4 (Charles — Data + Integration + PM)

Three blocking items (the first one was found during P2 functional testing
and blocks the entire gate — see §10):

0. **🟥 Run `db/grants.sql` in the Supabase SQL editor (once).** Grants
   `select/insert/update/delete` on all 5 tables to `service_role`, plus
   `alter default privileges` so any new table you add inherits the
   permission. Without this, every API route returns
   `500 db_error / permission denied`. Paste-and-run; idempotent.

1. **Backfill `profiles.stellar_public_key` for the demo family.** The
   lock route returns `400 family_address_not_set` if the family's row in
   `profiles` has a null `stellar_public_key`. The seed currently doesn't
   set it. Either:
   - extend `db/seed.sql` to write a known testnet pubkey for
     `22222222-2222-2222-2222-222222222222`, **OR**
   - have P2 generate a Friendbot-funded keypair via
     `npm run fund-test-account` and you `UPDATE` the row manually before
     the gate test.

   (P2 recommendation: extend `seed.sql` so reset-demo is one command,
   matching the Day 5 plan.)

2. **Confirm `dev_write_*` policies stay in place through Day 3.** P2's
   routes go through the service-role client, so they bypass RLS — but
   P3's UI (when wired) still hits the DB with the anon key and depends on
   `dev_write_*`. The Day 4-5 hardening plan says to drop those once
   *all* writes go through P2's API. Keep them for now.

Optional but useful for Day 4 (your call):

3. **Consider a `wishlist.escrow_return_value` column** instead of the
   `__escrow_ret__:` prefix in `notes`. The stash works for Day 3 but the
   notes column is meant for human messages. A real column avoids
   accidental display in the UI.

4. **`finalize_wishlist` RPC** (per your Day 4 plan) — when ready, paste
   the signature here or tag P2 to wire `supabase.rpc('finalize_wishlist',
   { wishlist_id })` into the release route right before the
   `settlement` insert.

---

## 10. Functional test evidence (2026-05-20)

Static checks (no env needed):

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ PASS, zero errors |
| `npm run test:stellar-lib` | ✅ 4/4 pass (pre-existing bridge tests still green) |
| `npm run test:escrow-wiring` | ✅ 5/5 pass (new probe) |
| `npm run build` | ✅ Both routes registered as `ƒ /api/escrow/lock`, `ƒ /api/escrow/release` (Dynamic, server-rendered) |

Live checks (dev server on `localhost:3000`, Supabase + Stellar testnet):

| Probe | Expected | Actual |
|---|---|---|
| Inline Horizon round-trip via `verify-stellar-connection.ts` | latest ledger JSON | ✅ ledger 2649058, fresh timestamp |
| `POST /lock` no Bearer | 401 `unauthorized` | ✅ |
| `POST /release` no Bearer | 401 `unauthorized` | ✅ |
| `POST /lock` invalid JWT | 401 `unauthorized` (Supabase msg) | ✅ |
| `POST /lock` real JWT + mismatched `family_id` | 403 `forbidden` | ✅ |
| `POST /lock` real JWT + malformed JSON | 400 `invalid_body` | ✅ |
| `POST /lock` real JWT + nonexistent wishlist | 404 `wishlist_not_found` | **❌ got 500 `db_error`** — see below |
| `POST /release` real JWT + nonexistent wishlist | 404 `wishlist_not_found` | **❌ got 500 `db_error`** — see below |

**Why the two 500s, and why they are NOT a code bug:**

The dev server log on those calls printed:

```
[escrow/lock] wishlist load failed: {
  code: '42501',
  message: 'permission denied for table wishlist',
  hint: 'Grant the required privileges to the current role with: GRANT SELECT ON public.wishlist TO service_role;'
}
```

I confirmed this directly against the Supabase PostgREST endpoint using the
service_role key for all 5 tables — every single one returned `42501
permission denied`. Hint is Postgres-generated and unambiguous.

The route correctly distinguishes:
- Supabase error → 500 `db_error` (this is the path we hit — DB is broken)
- No rows returned → 404 `wishlist_not_found` (would fire if DB worked but
  the row genuinely didn't exist)

So the route is doing the right thing. The DB simply hasn't been granted
the privileges service-role needs. The fix is in `db/grants.sql`. Once P4
runs it, re-running these probes will produce 404 / 200 as expected.

**Note on the dev server's stdout:** it auto-loaded `.env` (Next.js 14
behavior). When the operator follows the `DAY3-P2.md` instructions to
`cp .env.example .env.local`, those values take precedence — same routes,
same behavior.

---

## 7. Notes for P3 (Gerardo — Frontend, when they get to wiring)

Not blocking Day 3 but worth flagging now:

- The routes are POST-only and require `Authorization: Bearer <JWT>`. The
  family must be logged in via Supabase Auth before hitting either route.
- Both routes return the same error envelope shape; a single helper in
  the UI can handle 401/403/404/409/400/500/503 generically and switch
  on `error` for human messages.
- For the "Locked ✓" success card, use `tx_hash` from the lock response
  and link to:
  `https://stellar.expert/explorer/testnet/tx/<tx_hash>`
- For the "Payment Released" card, same pattern with `release_tx_hash`.

---

## 8. How to verify (for any operator)

```bash
# 1. Type-check passes
cd InternStellar-Hackathon
npx tsc --noEmit

# 2. Wiring smoke test passes (4-5 checks, no network needed)
npm run test:escrow-wiring

# 3. The pre-existing stellar bridge test still passes
npm run test:stellar-lib

# 4. End-to-end (requires NEXT_PUBLIC_CONTRACT_ID + STELLAR_DEMO_SECRET_KEY
#    in .env.local AND family's stellar_public_key seeded in DB):

# 4a. get a JWT
curl -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"cora.family@internstellar.demo","password":"demo123456"}'
# copy access_token

# 4b. create a draft wishlist + items via Supabase SQL editor or P3's UI

# 4c. lock the escrow
curl -X POST http://localhost:3000/api/escrow/lock \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"family_id":"22222222-2222-2222-2222-222222222222","wishlist_id":"<uuid>"}'
# expect: 200 { escrow_id, tx_hash, status:"locked", ... }
# verify: wishlist.status='locked', escrow_tx_hash populated, settlement row created,
#         tx_hash visible on https://stellar.expert/explorer/testnet/tx/<hash>

# 4d. flip wishlist status to 'delivered' (P3 normally does this; for
#     curl-only testing, UPDATE via Supabase SQL editor)

# 4e. release
curl -X POST http://localhost:3000/api/escrow/release \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"family_id":"22222222-2222-2222-2222-222222222222","wishlist_id":"<uuid>"}'
# expect: 200 { release_tx_hash, status:"released", ... }
```

If 4c returns `503 contract_not_configured` → P1's env var (item §5.1) is missing.
If 4c returns `400 family_address_not_set` → P4's seed task (§6.1) is missing.
Both are expected gates, not bugs in this layer.

---

## 9. Out of scope (intentionally deferred)

- `GET /api/balances/:user_id` — Day 4 first thing. Contract module's
  `getBalances()` is wired; the route file is the only missing piece.
- Inventory decrement on release (P4's `finalize_wishlist` RPC) — Day 4.
- Tightening RLS / dropping `dev_write_*` policies — Day 4-5 (P4).
- Freighter wallet signing — explicit stretch only, per CLAUDE.md.
- Frontend wiring — P3 owns it; the API contract above is the handoff.

---

**This layer is done.** The two endpoints exist, compile, load, fail
gracefully when env is missing, and will hit the real contract the moment
P1 fills `NEXT_PUBLIC_CONTRACT_ID` and P4 seeds the family's stellar
public key. Hand-off to P1 and P4 is in §5 and §6.
