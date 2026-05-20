# DAY 3 — Escrow API Layer (P2: Rene) — Lock & Release

**Owner:** Person 2 (Rene) — Integration Bridge  
**Date:** May 20-21, 2026 (Day 3)  
**Critical Path:** API routes must wire contract calls BEFORE P3 sliders unlock at gate.  
**Golden Flow:** Family creates wishlist → P2 `/api/escrow/lock` → Contract locks → DB records escrow → Family sees "locked" status.

> **Revision (2026-05-20, execution start):** plan refined while implementing — see "Plan Revisions" at bottom of this doc for what changed and why.

---

## Goal

Wire two API routes that invoke P1's escrow contract functions and update Supabase state in sync. By end of day:

1. **`POST /api/escrow/lock`** calls `lock_escrow(family, amount)` on contract → stores escrow TX hash in Supabase → returns locked escrow ID.
2. **`POST /api/escrow/release`** calls `release_escrow(escrow_id)` on contract → updates wishlist status → returns confirmation.
3. **Error handling** gracefully catches contract panics, network timeouts, and Supabase failures.
4. **Pair session** with P1 confirms contract function signatures match your API expectations.

---

## Mandatory Pair Session (Hour 0, 30 min)

**With P1 (Prince):**

Before you write a single API route, sit with P1 for 30 minutes. Your goal:

- [ ] **Confirm `lock_escrow()` signature:** Does P1's Rust contract expect:
  - `family: Address` (Stellar account address)?
  - `amount: i128` (stroops)?
  - Return type: what does it give back? (escrow ID? TX hash? Just acknowledgment?)
- [ ] **Confirm `release_escrow()` signature:** Does it expect:
  - `escrow_id: ???` (what format? UUID? i128? Symbol?)
  - `confirmation: ???` (what is this? a hash? a flag?)
  - Return: confirmation TX hash?
- [ ] **Confirm `get_balances()` signature:** (needed for wire-up, but not called in Day 3 routes yet)
  - Input: `user: Address`
  - Output: `(util: i128, groc: i128, emerg: i128)`
- [ ] **Error cases:** What panics can each function throw, and what's the message?
  - e.g., "insufficient_balance", "unauthorized", etc.
- [ ] **Auth pattern:** Do these functions require `caller.require_auth()`? Or does the API layer sign on behalf of the family?

**Take notes.** You will NOT guess the signature from the Rust code alone — P1 walks you through it live.

---

## Architecture Overview

```
Frontend (P3)                Next.js API (P2 — YOU)          Stellar Contract (P1)    Supabase (P4)
──────────────────────────────────────────────────────────────────────────────────────────────────────

POST wishlist/create
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                             │
  │  [Create draft wishlist]                                                   │
  │  → POST /api/wishlist                                                       │
  │    ├─ validate items exist in inventory                                    │
  │    └─ INSERT wishlist (status='draft') → Supabase                          │
  │                                                                             │
  │ Return: wishlist ID, items, total_stroops                                 │
  └─────────────────────────────────────────────────────────────────────────────┘

User clicks "Lock Escrow"
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                             │
  │  [Lock the wishlist's grocery portion]                                     │
  │  → POST /api/escrow/lock                                                    │
  │    ├─ Validate family_id is authenticated user                            │
  │    ├─ Validate wishlist exists and status='draft'                         │
  │    ├─ Calculate grocery_stroops from wishlist items                       │
  │    ├─ **CALL CONTRACT** lock_escrow(family_address, grocery_stroops)      │
  │    │   └─ [Network call to Stellar]                                       │
  │    ├─ UPDATE wishlist                                                      │
  │    │   ├─ status → 'locked'                                               │
  │    │   ├─ escrow_tx_hash → (returned by contract)                         │
  │    │   └─ Supabase                                                         │
  │    ├─ INSERT settlement (event_type='lock', tx_hash, amount)              │
  │    └─ Return: escrow_id, tx_hash, "escrow locked"                         │
  │                                                                             │
  │ P3 shows user: "Escrow Locked ✓ | Store can now deliver"                  │
  └─────────────────────────────────────────────────────────────────────────────┘

After store delivers
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                             │
  │  [Family confirms + release funds to store]                               │
  │  → POST /api/escrow/release                                                │
  │    ├─ Validate family_id + wishlist_id                                    │
  │    ├─ Validate wishlist status='delivered'                                │
  │    ├─ **CALL CONTRACT** release_escrow(escrow_id, confirmation=true)      │
  │    │   └─ [Network call to Stellar]                                       │
  │    ├─ UPDATE wishlist                                                      │
  │    │   ├─ status → 'released'                                             │
  │    │   ├─ release_tx_hash → (returned by contract)                        │
  │    │   └─ Supabase                                                         │
  │    ├─ INSERT settlement (event_type='release', tx_hash, amount)           │
  │    └─ Return: release_tx_hash, "funds released to store"                  │
  │                                                                             │
  │ P3 shows user: "Payment Released ✓ | Thank you"                           │
  └─────────────────────────────────────────────────────────────────────────────┘

GET /api/balances/:user_id  [NOT Day 3, but wire it for completeness]
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  [Show current running balances]                                           │
  │  → GET /api/balances/:user_id                                              │
  │    ├─ Validate auth                                                        │
  │    ├─ **CALL CONTRACT** get_balances(user_address)                        │
  │    └─ Return: { util, groc, emerg } in stroops                            │
  │                                                                             │
  │ P3 shows user: "Grocery Wallet: ₱300 | Utilities: ₱500 | Emergency: ₱100" │
  └─────────────────────────────────────────────────────────────────────────────┘
```

**Key principle:** All contract calls are signed/invoked from the API layer (server), not the browser. The family's Stellar address is a **data field** in Supabase, not a hot wallet in the browser.

---

## Hour 0 (30 min) — Pair with P1 ✅ CRITICAL

**Do this FIRST. Do not start coding until you have answers.**

Checklist:

- [ ] Call P1 over
- [ ] Ask: "What's the exact Rust function signature for `lock_escrow`?"
- [ ] Ask: "What does it return?"
- [ ] Ask: "What are all the ways it can panic or fail?"
- [ ] Ask: "Who signs this transaction — the family's account or a server account?"
- [ ] Ask: "Same questions for `release_escrow` and `get_balances`."
- [ ] Take screenshots of P1's Rust code (lib.rs).
- [ ] Write down the answers in a notes file or comment in your code.
- [ ] Confirm P1's contract is deployed and contract ID is in your `.env.local`.

**Critical detail:** If the contract requires the family to sign (Freighter or similar), that's a hard blocker for Day 3 — surface it to P4 immediately. The current spec assumes server-side signing.

---

## Hour 1–2 — Validate Your Setup

**Check that you have the infrastructure:**

```bash
cd InternStellar-Hackathon

# 1. Verify .env.local has all Stellar vars
cat .env.local
# Expected:
#   STELLAR_NETWORK=testnet
#   STELLAR_HORIZON_URL=https://soroban-testnet.stellar.org
#   STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
#   STELLAR_CONTRACT_ID=CCNHZGSUWCQXWFVU4IGFRNC5FWYJTGUPOAIHV7KNRSB7KLWVJNPQ43OE
#   STELLAR_DEMO_SECRET_KEY=<your-funded-keypair>

# 2. Test Stellar client connectivity
npx tsx scripts/verify-stellar-connection.ts
# Expected: recent ledger, network info

# 3. Verify Next.js dev server runs
npm run dev &
# Expected: server starts on http://localhost:3000

# 4. Verify Supabase creds work
# (Charles has already seeded test data, so just verify you can query)
```

**If any of these fail, stop and fix before moving forward.**

---

## Hour 2–4 — Implement `/api/escrow/lock`

**File:** `app/api/escrow/lock/route.ts` (or `.js`, your choice)

### Responsibilities:

1. **Parse request body**
   ```json
   {
     "family_id": "uuid-of-family-user",
     "wishlist_id": "uuid-of-wishlist"
   }
   ```

2. **Validate authentication**
   - Confirm the request is from an authenticated user (using Supabase auth context).
   - Confirm `family_id` matches the authenticated user (no spoofing).

3. **Load wishlist + items from Supabase**
   - Query `wishlist` where `id = wishlist_id` and `family_id = family_id`.
   - Query `wishlist_item` WHERE `wishlist_id = ...`.
   - Validate status is `'draft'`.
   - **Important:** Calculate the **grocery bucket amount** from the items:
     - Iterate wishlist items and sum `price_stroops_at_add * quantity`.
     - This is what goes into escrow.

4. **Invoke contract `lock_escrow(family_address, grocery_stroops)`**
   - Get the family's Stellar address from `profiles` table.
   - Call P1's contract with the grocery amount (in stroops).
   - **On success:** Contract returns a TX hash (or escrow ID — confirm with P1).
   - **On failure:** Catch error, return HTTP 400 with friendly message.

5. **Update Supabase state**
   - `UPDATE wishlist SET status = 'locked', escrow_tx_hash = <returned_hash>, updated_at = now()`.
   - `INSERT settlement (wishlist_id, event_type='lock', tx_hash, amount_stroops)`.

6. **Return response**
   ```json
   {
     "escrow_id": "uuid-of-wishlist",
     "tx_hash": "64-hex-char-hash",
     "status": "locked",
     "message": "Escrow locked successfully. Store can now prepare delivery."
   }
   ```

### Error cases to handle:

| Scenario | HTTP | Response |
|---|---|---|
| User not authenticated | 401 | `{ "error": "unauthorized" }` |
| Wishlist not found | 404 | `{ "error": "wishlist_not_found" }` |
| Wishlist status ≠ 'draft' | 409 | `{ "error": "invalid_status", "current": "..." }` |
| Family address missing | 400 | `{ "error": "family_address_not_set" }` |
| Contract call fails (e.g., insufficient funds) | 400 | `{ "error": "contract_error", "reason": "<message>" }` |
| Supabase update fails | 500 | `{ "error": "db_error", "reason": "<message>" }` |

**DO NOT expose raw Soroban error codes, stack traces, or XDR to the frontend.** Translate them into human words.

### Testing:

```bash
# 1. Create a draft wishlist manually in Supabase (or via POST /api/wishlist if that exists)
# 2. Call the lock endpoint
curl -X POST http://localhost:3000/api/escrow/lock \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-auth-token>" \
  -d '{"family_id":"<uuid>","wishlist_id":"<uuid>"}'

# 3. Verify:
#    - Supabase wishlist.status changed to 'locked'
#    - settlement record created
#    - Stellar Expert shows the escrow transaction
```

---

## Hour 4–5 — Implement `/api/escrow/release`

**File:** `app/api/escrow/release/route.ts`

### Responsibilities:

1. **Parse request body**
   ```json
   {
     "family_id": "uuid-of-family-user",
     "wishlist_id": "uuid-of-wishlist"
   }
   ```

2. **Validate authentication + ownership**
   - Confirm authenticated user matches `family_id`.

3. **Load wishlist from Supabase**
   - Query `wishlist` where `id = wishlist_id`.
   - Validate status is `'delivered'` (i.e., store has confirmed delivery).
   - Extract `escrow_tx_hash` (used to identify the escrow on-chain).

4. **Invoke contract `release_escrow(escrow_id, confirmation=true)`**
   - Extract the escrow ID from the TX hash or use it directly (confirm format with P1).
   - Call P1's contract to release funds to store account.
   - **On success:** Contract returns release TX hash.
   - **On failure:** Return HTTP 400 with friendly error.

5. **Update Supabase state**
   - `UPDATE wishlist SET status = 'released', release_tx_hash = <returned_hash>, updated_at = now()`.
   - `INSERT settlement (event_type='release', tx_hash, amount_stroops)`.
   - **Optional (Day 4+):** Trigger P4's stored procedure to decrement `inventory.stock` for each item.

6. **Return response**
   ```json
   {
     "release_tx_hash": "64-hex-char-hash",
     "status": "released",
     "message": "Payment released to store. Thank you!"
   }
   ```

### Error cases:

| Scenario | HTTP | Response |
|---|---|---|
| User not authenticated | 401 | `{ "error": "unauthorized" }` |
| Wishlist not found | 404 | `{ "error": "wishlist_not_found" }` |
| Wishlist status ≠ 'delivered' | 409 | `{ "error": "invalid_status", "current": "...", "expected": "delivered" }` |
| Contract call fails (e.g., already released) | 400 | `{ "error": "contract_error", "reason": "<message>" }` |
| Supabase update fails | 500 | `{ "error": "db_error" }` |

### Testing:

```bash
# 1. Manually update wishlist.status to 'delivered' in Supabase
# 2. Call release endpoint
curl -X POST http://localhost:3000/api/escrow/release \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-auth-token>" \
  -d '{"family_id":"<uuid>","wishlist_id":"<uuid>"}'

# 3. Verify:
#    - Supabase wishlist.status changed to 'released'
#    - settlement record created
#    - Stellar Expert shows funds moved to store account
```

---

## Hour 5–6 — Implement `GET /api/balances/:user_id` (Read-Only, For Completeness)

**File:** `app/api/balances/[user_id]/route.ts`

### Responsibilities:

1. **Validate authentication + ownership**
   - Confirm authenticated user matches `user_id` (no reading someone else's balance).

2. **Load user's Stellar address from Supabase**
   - Query `profiles` where `id = user_id`.

3. **Call contract `get_balances(user_address)`**
   - Returns `(util: i128, groc: i128, emerg: i128)` in stroops.

4. **Return response**
   ```json
   {
     "balances": {
       "utilities_stroops": 1000000000,
       "groceries_stroops": 500000000,
       "emergency_stroops": 250000000
     },
     "display": {
       "utilities_xlm": "100.00",
       "groceries_xlm": "50.00",
       "emergency_xlm": "25.00"
     }
   }
   ```

### Error cases:

- 401 Unauthorized
- 404 User not found
- 500 Contract call failed

### Testing:

```bash
curl -X GET http://localhost:3000/api/balances/<user-uuid> \
  -H "Authorization: Bearer <your-auth-token>"
```

---

## Error Handling & Logging

### Standards:

1. **All contract calls are wrapped in try-catch**
   ```typescript
   try {
     const result = await invokeContract(lock_escrow, args);
   } catch (err) {
     console.error('Contract lock_escrow failed:', err);
     return NextResponse.json(
       { error: 'escrow_lock_failed', reason: 'Insufficient balance or contract error' },
       { status: 400 }
     );
   }
   ```

2. **Supabase errors are caught separately**
   ```typescript
   try {
     await supabase.from('wishlist').update({ status: 'locked' }).eq('id', ...);
   } catch (dbErr) {
     console.error('Supabase update failed:', dbErr);
     return NextResponse.json(
       { error: 'db_error', reason: 'Could not update wishlist status' },
       { status: 500 }
     );
   }
   ```

3. **Log all transitions to settlement table**
   - Every lock/release must create a settlement record for audit trail.
   - This survives even if the frontend loses the response.

4. **Never expose:**
   - Raw Stellar XDR
   - Soroban error codes
   - Stack traces
   - Secret keys or private endpoints

---

## 🟥 Day 3 Gate (End-of-Day Verification)

The work is **DONE** only when **ALL** of the following are green:

### P2 (You) — API Routes

- [ ] `POST /api/escrow/lock` exists and is callable.
- [ ] `POST /api/escrow/release` exists and is callable.
- [ ] `GET /api/balances/:user_id` exists (read-only, wire-up only).
- [ ] All three routes return proper HTTP status codes (401, 404, 400, 500, 200).
- [ ] All three routes catch contract errors gracefully (no raw XDR in response).
- [ ] All state changes (lock/release) create `settlement` audit records.

### P1 (Prince) — Contract Signatures Match API

- [ ] Confirm `lock_escrow(family, amount)` signature matches what P2 is calling.
- [ ] Confirm `release_escrow(escrow_id)` signature matches what P2 is calling.
- [ ] Confirm `get_balances(user)` signature matches what P2 is calling.
- [ ] Confirm return types and error messages match API's error handling.

### Integration Test — P2 + P1 + P4

- [ ] **Lock flow:** Family creates wishlist → P2 `/api/escrow/lock` → Contract locks → Supabase updates → `settlement` record created.
- [ ] **Verify on stellar.expert:** Escrow transaction visible on testnet explorer.
- [ ] **Verify on Supabase:** `wishlist.status = 'locked'` and `escrow_tx_hash` is populated.
- [ ] **Release flow:** P2 `/api/escrow/release` → Contract releases → Supabase updates → `settlement` record created.

### Demo to P4 + Team

Show command-line calls + screenshots:
1. `curl -X POST /api/escrow/lock ...` → success response.
2. Supabase dashboard showing wishlist status changed to 'locked'.
3. Stellar Expert showing escrow TX.
4. `curl -X POST /api/escrow/release ...` → success response.
5. Supabase dashboard showing wishlist status changed to 'released'.
6. Stellar Expert showing release TX.

If all 6 items are green, **Day 3 is DONE.**

---

## Explicit Non-Actions

While implementing Day 3, you will NOT:

- Modify P1's Rust contract (that's P1's job for adding new functions).
- Manually write to `.env.local` (it stays operator-managed).
- Create new Supabase tables (P4 owns schema; it's locked).
- Deploy to production (this is testnet only).
- Build UI logic (P3 does that; you just wire the API).
- Add any npm packages beyond what the API layer strictly requires
  (allowed in Day 3: `@supabase/supabase-js` — see Plan Revisions; otherwise
  no axios, dotenv, ky, etc.).

---

## File Structure (What You'll Create)

```
app/api/
├── escrow/
│   ├── lock/
│   │   └── route.ts           ← POST /api/escrow/lock
│   └── release/
│       └── route.ts           ← POST /api/escrow/release
└── balances/
    └── [user_id]/
        └── route.ts           ← GET /api/balances/:user_id
```

---

## Key References

**From P1's Handoff (P2-HANDOFF.md):**
- Contract ID: `CCNHZGSUWCQXWFVU4IGFRNC5FWYJTGUPOAIHV7KNRSB7KLWVJNPQ43OE`
- Deployed on testnet
- RPC: https://soroban-testnet.stellar.org
- Network Passphrase: `Test SDF Network ; September 2015`

**From P4's Schema (db/schema.sql):**
- `wishlist` → status lifecycle: draft → pending_approval → locked → delivered → released → cancelled
- `settlement` → audit trail of all chain events
- All amounts in stroops (1 XLM = 10,000,000)

---

## Summary

**Your focus for Day 3:**

1. **Hour 0:** Pair with P1. Confirm contract signatures.
2. **Hour 1–2:** Verify infrastructure (Stellar client, Supabase, Next.js).
3. **Hour 2–4:** Implement `/api/escrow/lock` — contract call → Supabase update → settlement record.
4. **Hour 4–5:** Implement `/api/escrow/release` — contract call → Supabase update → settlement record.
5. **Hour 5–6:** Implement `GET /api/balances/:user_id` — read-only contract query.
6. **End-of-day:** Gate test with P1 + P4. Escrow lock/release flow works end-to-end.

**You are the bridge.** Contract calls don't reach Supabase without you. UI doesn't lock escrow without you. Own this layer completely.

---

## Auth Strategy (clarification — was implicit in original draft)

Both `/api/escrow/lock` and `/api/escrow/release` enforce **two layers**:

1. **JWT verification (caller identity).** The request must include
   `Authorization: Bearer <supabase_access_token>`. The route uses a
   short-lived **anon-key Supabase client bound to that token** to call
   `supabase.auth.getUser()`. If that fails → `401 unauthorized`.
2. **Ownership check.** The decoded `user.id` from step 1 must equal the
   `family_id` in the request body. Mismatch → `403 forbidden` (treat
   "you are who you say you are" and "this wishlist is yours" as separate
   failure modes so a confused frontend doesn't ship the wrong fix).

All **writes** (UPDATE wishlist, INSERT settlement) go through a
**service-role Supabase client** (`SUPABASE_SERVICE_ROLE_KEY`, server-side
only — never imported into a client component). The service role bypasses
RLS, which is fine because the route has already proven identity + ownership
above. This pattern is what lets us drop every `dev_write_*` policy on
Day 4-5 without breaking the lock/release flow.

How to get a JWT for curl testing:

```bash
# Returns { access_token, refresh_token, ... }
curl -X POST "${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"cora.family@internstellar.demo","password":"demo123456"}'

# Copy the access_token, then:
curl -X POST http://localhost:3000/api/escrow/lock \
  -H "Authorization: Bearer <paste-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"family_id":"22222222-2222-2222-2222-222222222222","wishlist_id":"<uuid>"}'
```

---

## Environment Variables — Day 3 Checklist

Add / confirm these in `.env.local` before the gate test. The committed
`.env.example` shows the keys; values below are what Day 3 needs:

```dotenv
# Supabase — both already in .env.example
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # server-only, bypasses RLS

# Stellar / Soroban
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
STELLAR_DEMO_SECRET_KEY=S...                   # from `npm run fund-test-account`

# P1's deployed contract (Day 3 unblocks the moment this is set)
NEXT_PUBLIC_CONTRACT_ID=C...                   # 56-char Soroban contract id
```

If `NEXT_PUBLIC_CONTRACT_ID` is empty, every contract call returns
`503 contract_not_configured` with a clear message — so the routes ship
green and only flip red when P1 needs to wire the real id. No mocks, no
stubs: just an honest "not ready yet" until the env var is set.

---

## Plan Revisions (2026-05-20, during execution)

The original plan was sound but rested on three assumptions that broke as
soon as code was written. Captured here so future-me / future-team can see
why the shipped code looks slightly different from the draft above.

1. **"No new npm packages" had to relax for `@supabase/supabase-js`.**
   The plan calls Supabase from route handlers (`supabase.from('wishlist')...`)
   but the package wasn't installed — `lib/supabase.ts` was excluded from
   tsc on `main` to keep the build green. We can't both "no new packages"
   AND "call Supabase from API routes." Installed `@supabase/supabase-js`
   as a runtime dep (only addition — no axios, no dotenv, no ky). Removed
   the `lib/supabase.ts` exclusion from `tsconfig.json`.

2. **Two Supabase clients, not one.** `lib/supabase.ts` (anon-key) is only
   safe to import client-side. For server-side writes that need to bypass
   RLS we added `lib/supabase-admin.ts` which uses
   `SUPABASE_SERVICE_ROLE_KEY`. Routes use the admin client for writes and
   a per-request anon client (bound to the caller's JWT) for the auth
   check. Mixing those two responsibilities into one client would either
   leak service-role keys to the browser or block our own writes via RLS.

3. **`escrow_id` resolution for `release_escrow`.** P1's exact return type
   from `lock_escrow` is unconfirmed. We store **both** the on-chain TX
   hash (in `wishlist.escrow_tx_hash`, always populated from the
   submission response) AND the contract's literal return value (in
   `wishlist.notes` as a tagged prefix `__escrow_ret__:<value>` until P4
   approves a real column, or thrown away if P1 confirms TX hash is
   sufficient). `release_escrow` passes whichever P1 specifies during the
   pair session. If P1 says "TX hash is enough," we drop the notes-prefix
   stash on Day 4.

4. **GET `/api/balances/:user_id` deferred.** Original plan flags it as
   "Hour 5-6 — for completeness" and "NOT Day 3." Day 3 ships only `lock`
   and `release` per the user's explicit scope ("API routes
   /api/escrow/lock + /api/escrow/release"). Balances becomes a Day 4
   first-thing task. The contract-invoker module exports a stub for it so
   wiring is half-done.

5. **Error response shape standardised.** All routes use the same
   `{ error: string, reason?: string, [context]?: any }` JSON envelope via
   `lib/api/errors.ts`. Stack traces / XDR / SDK error objects never reach
   the wire — they go to `console.error` only.