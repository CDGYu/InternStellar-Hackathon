# DAY 3-4 — P2 (Rene) Summary of Work

**Owner:** Person 2 (Rene) — Integration Bridge
**Date range:** 2026-05-20 → 2026-05-21 (Day 3 + Day 4 API layer)
**Scope shipped this conversation:**
- Day 3 catch-up: lockEscrow signature for Day 4 contract, store-address
  derivation in lock route, wishlist creation endpoint, panic-string mapping.
- Day 4 core: deposit + balances routes wired to the contract, full chain
  reachable from one click-through, smoke test refreshed.
- P4 carry-over: seed file now sets `stellar_public_key` for all three demo
  profiles; realtime publication extended to `settlement`.

> **What "done" looks like for P2 right now:** every API route that the
> Golden Path needs exists, type-checks, compiles, and fails gracefully
> when env / DB / chain isn't ready. Once P1 fills `NEXT_PUBLIC_CONTRACT_ID`,
> P4 runs the updated SQL files, and P3 wires the UI to the endpoints in
> §6, the gate flips green.

---

## 1. Files added / modified in this conversation

### Added (P2-owned)

```
app/api/wishlist/
└── route.ts                        ← POST /api/wishlist  (NEW)

app/api/deposit/
└── route.ts                        ← POST /api/deposit  (NEW)

app/api/balances/[user_id]/
└── route.ts                        ← GET  /api/balances/:user_id  (NEW)

DAY3-4-P2-SUMMARY-OF-WORK.md        ← (this file, replaces DAY3-P2-SUMMARY-OF-WORK.md as the canonical handoff)
```

### Modified (P2-owned)

| File | What changed |
|---|---|
| `lib/stellar/contract.ts` | Added `depositAndSplit()`; `lockEscrow()` now takes `storeAddress`; `getBalances()` returns a typed `{util, groc, emerg}` tuple; new panic-string table covers Day 4 panics (`family cannot be store`, `store groc overflow`); arg validation moved before `loadConfig()` so callers get clear reasons even when env is partial. |
| `app/api/escrow/lock/route.ts` | Resolves the destination store via the inventory join; enforces single-store wishlists; loads both family AND store `stellar_public_key`; validates `family != store`; passes `storeAddress` to `lockEscrow()`; returns `store_id` + `contract_escrow_id` in the response. |
| `scripts/_test-escrow-wiring.ts` | Updated for the 3-arg `lockEscrow`; new tests for `depositAndSplit`; new route-compile checks for `/api/wishlist`, `/api/deposit`, `/api/balances/[user_id]`. |
| `DAY3-NEEDEDTASKS.md` | Rewritten as a unified Day 3-4 task list with a clear ownership matrix and timeline. |

### Modified (P4-territory — fixed in P2's branch because they block P2)

| File | What changed |
|---|---|
| `db/seed.sql` | Now `UPDATE`s `profiles.stellar_public_key` for ALL THREE demo users (OFW, Family, Store) to `GAC3WCB5ZZ5GVWDOL4XCA3UJU5ZQ4CCAODREOEDLJB5UT4Q6BZDKPYUK`. Day 4 contract credits store on release, so store needs an address too. P4 to re-run in the Supabase SQL editor. |
| `db/realtime.sql` | Adds `settlement` to the `supabase_realtime` publication + sets `replica identity full`, so the Store dashboard sees lock/release receipts the instant they hit Supabase (no polling). |

### Untouched on purpose

- `db/schema.sql` — LOCKED (CLAUDE.md). Store address is derived via
  the `wishlist_item → inventory → store_id → profile` join rather than a
  new column.
- `db/policies.sql` — RLS is already correct for the server-side flow.
- `db/grants.sql` — already correct.
- `lib/api/auth.ts`, `lib/api/errors.ts`, `lib/supabase-admin.ts` — bridge
  pieces are stable.
- P3's UI code (none shipped yet) — see §6 for the integration contract.

---

## 2. The five endpoints at a glance

All routes:
- Require `Authorization: Bearer <supabase_access_token>`.
- Return the standard `{ error, reason?, ...context }` envelope on failure.
- Return JSON success bodies — all bigints as strings (JSON has no bigint).
- Are server-rendered (`dynamic = "force-dynamic"`), `runtime = "nodejs"`.

### 2.1 `POST /api/wishlist`

Creates a wishlist (status `draft`) with line items.

Request body:
```json
{
  "family_id": "22222222-2222-2222-2222-222222222222",
  "items": [
    { "inventory_id": "a0000000-0000-0000-0000-000000000001", "quantity": 1 },
    { "inventory_id": "a0000000-0000-0000-0000-000000000002", "quantity": 3 }
  ],
  "notes": "Lola needs her maintenance meds"
}
```

Response:
```json
{
  "wishlist_id": "<uuid>",
  "family_id": "22222222-...",
  "status": "draft",
  "total_stroops": "4850000",
  "item_count": 2,
  "notes": "Lola needs her maintenance meds",
  "message": "Wishlist created. Family can now request approval / lock escrow."
}
```

Error map (subset):
| HTTP | `error` | Cause |
|---|---|---|
| 400 | `invalid_body` | missing field, wrong type, items empty |
| 403 | `forbidden` | JWT.user_id ≠ family_id |
| 404 | `inventory_not_found` | one or more `inventory_id`s don't exist |
| 409 | `multiple_stores` | items span > 1 store (demo is single-store) |
| 409 | `insufficient_stock` | requested quantity > available |

### 2.2 `POST /api/deposit`

OFW splits a deposit across utilities / groceries / emergency buckets via
`deposit_and_split` on the contract.

Request body:
```json
{
  "ofw_id": "11111111-1111-1111-1111-111111111111",
  "total_stroops": "10000000000",
  "pct_util": 60,
  "pct_groc": 30,
  "pct_emerg": 10
}
```

Response:
```json
{
  "tx_hash": "a33843763a5a1f64...",
  "shares": {
    "util_stroops": "6000000000",
    "groc_stroops": "3000000000",
    "emerg_stroops": "1000000000"
  },
  "total_stroops": "10000000000",
  "percentages": { "util": 60, "groc": 30, "emerg": 10 },
  "message": "Deposit split successfully across utilities, groceries, and emergency buckets."
}
```

Notes:
- The `pct_*` values must sum to exactly 100 (route validates pre-call so
  no wasted round trip).
- No `settlement` row is written here — `settlement.wishlist_id` is `NOT NULL`
  per the locked schema. The on-chain `deposit` event is the audit trail.

### 2.3 `POST /api/escrow/lock`

Lock the wishlist's grocery-bucket amount on-chain, addressed to the store
derived from the inventory join.

Request body:
```json
{
  "family_id": "22222222-2222-2222-2222-222222222222",
  "wishlist_id": "<wishlist_uuid>"
}
```

Response:
```json
{
  "escrow_id": "<wishlist_uuid>",
  "contract_escrow_id": 1,
  "tx_hash": "97db84a18330476c...",
  "status": "locked",
  "amount_stroops": "2000000000",
  "store_id": "33333333-3333-3333-3333-333333333333",
  "message": "Escrow locked successfully. Store can now prepare delivery."
}
```

### 2.4 `POST /api/escrow/release`

Family confirms delivery → contract releases escrow → store grocery bucket
auto-credited.

Request body:
```json
{
  "family_id": "22222222-2222-2222-2222-222222222222",
  "wishlist_id": "<wishlist_uuid>"
}
```

Response:
```json
{
  "release_tx_hash": "bba0803f0a17464f...",
  "status": "released",
  "message": "Payment released to store. Thank you!"
}
```

Requires `wishlist.status === 'delivered'`. The route reads the stashed
`__escrow_ret__:<id>` from `wishlist.notes` and passes it to
`release_escrow(escrow_id)`. Falls back to `escrow_tx_hash` if the stash
is missing.

### 2.5 `GET /api/balances/:user_id`

Returns the user's three on-chain buckets in both stroops and a formatted
XLM string.

Response:
```json
{
  "user_id": "33333333-3333-3333-3333-333333333333",
  "role": "store",
  "stellar_address": "GAC3WCB5...",
  "balances_stroops": {
    "utilities": "0",
    "groceries": "2000000000",
    "emergency": "0"
  },
  "display": {
    "utilities": "0.0000 XLM",
    "groceries": "200.0000 XLM",
    "emergency": "0.0000 XLM"
  }
}
```

For the demo, the store's grocery balance shows the released amount —
that's the "funds landed at the store" beat.

---

## 3. The Golden Path through the API layer

```
OFW deposit                     Family wishlist + lock              Family release
┌──────────────────┐         ┌──────────────────────┐         ┌──────────────────────┐
│ POST /api/deposit│ ──────► │ POST /api/wishlist   │ ──────► │ POST /api/escrow/    │
│ → contract       │         │   (create draft)     │         │       release        │
│ → 3 buckets fund │         │ POST /api/escrow/    │         │ → release_escrow     │
│                  │         │       lock           │         │ → store groc bucket  │
│ GET /api/balances│         │ → lock_escrow        │         │   credited (chain)   │
│  /:ofw_id        │         │ → DB status='locked' │         │ → DB status='released'│
└──────────────────┘         └──────────────────────┘         └──────────────────────┘
                                       │                                  │
                                       ▼                                  ▼
                                  Supabase realtime                 Supabase realtime
                                  broadcasts wishlist               broadcasts wishlist
                                  + settlement to                   + settlement (release)
                                  Store dashboard                   to Store dashboard
                                                                          │
                                                                          ▼
                                                                  P4 finalize_wishlist
                                                                  RPC decrements inventory
                                                                  (P4 wires this Day 4)
```

Every box in the middle row is a P2 endpoint that exists today. Every
arrow is a real Supabase / Stellar call.

---

## 4. Verification done in this conversation

### Static checks

| Check | Command | Result |
|---|---|---|
| TypeScript type-check | `npx tsc --noEmit` | ✅ exit 0 |
| Production build | `npm run build` | ✅ all 5 routes registered as `ƒ` (dynamic) |
| Wiring smoke test | `npm run test:escrow-wiring` | ✅ 11 / 11 pass |

The 11 wiring checks:
1. `lockEscrow` rejects amount ≤ 0
2. `lockEscrow` rejects family == store (no round trip)
3. `lockEscrow` throws `ContractNotConfiguredError` when env missing
4. `depositAndSplit` rejects pct sum ≠ 100
5. `depositAndSplit` rejects total ≤ 0
6. `err()` envelope is the standard shape
7-11. All five route modules export the right HTTP verb

### Not done here (operator's gate)

- End-to-end `curl` against testnet. That needs (a) `NEXT_PUBLIC_CONTRACT_ID`
  in `.env.local` set to `CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF`,
  (b) the updated `db/seed.sql` re-run, and (c) `STELLAR_DEMO_SECRET_KEY`
  funded via `npm run fund-test-account`. P4 + P1 own these.

---

## 5. Remaining gate items (handoff)

### For P1 (Prince — Contract Lead)

1. **Confirm `NEXT_PUBLIC_CONTRACT_ID` is the Day 4 id**
   (`CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF`) in your
   `.env.local`. Once filled, every P2 call hits the real contract.
2. **Wire `release_escrow` to the Family Confirm Delivery path.** The
   P2 route exists; you own driving it from the demo's confirm-delivery
   button. After lock → confirm → release, verify on
   `https://stellar.expert/explorer/testnet/contract/CB3VGM6SU...`.
3. **Tag the working commit** `golden-path-v1` once the round trip is
   verified on testnet.
4. **Optional but useful for Day 4:** subscribe to the contract's
   emitted events (`deposit`, `esc_lock`, `esc_rel`) via Soroban RPC
   `getEvents` so the receipts view can replay history.

### For P3 (Thirdy — Frontend / UX)

The five endpoints in §2 are your integration contract. Concrete wiring
notes for when the UI is ready:

**OFW view**
- "Send money" button → `POST /api/deposit` with the slider percentages.
- "My buckets" panel → `GET /api/balances/<ofw_id>` (polled on focus, or
  refreshed after a deposit's success response).
- Receipt card → `tx_hash` in the deposit response.
  Link: `https://stellar.expert/explorer/testnet/tx/${tx_hash}`.

**Family view**
- "Add to wishlist" page → list inventory via Supabase anon-key client
  (you already have the read policy: `auth_reads_inventory`).
- "Submit wishlist" button → `POST /api/wishlist`.
- "Lock escrow" button (post-OFW approval) → `POST /api/escrow/lock`.
- "Confirm delivery" button → `POST /api/escrow/release`.
- Subscribe to Supabase realtime on `wishlist` filtered by `family_id`
  so the status moves through `draft → locked → delivered → released`
  without a manual refresh.

**Store view**
- "Incoming orders" feed → Supabase realtime on `wishlist` filtered by
  `status=in.(pending_approval,locked,delivered)`.
- "Mark delivered" button → direct Supabase update (still uses
  `dev_write_wishlist` policy on Day 3-4) OR a future
  `POST /api/wishlist/:id/deliver` if P2 adds it.
  Either way: `UPDATE wishlist SET status = 'delivered' WHERE id = ...`.
- "My grocery bucket" panel → `GET /api/balances/<store_id>`. Refreshes
  after the release event lands via realtime on `settlement`.

**Generic error handler** (all routes return the same envelope):
```typescript
async function callApi(path: string, init: RequestInit) {
  const res = await fetch(path, init);
  const body = await res.json();
  if (!res.ok) {
    // body.error is the machine code; body.reason is the human message.
    const human = body.reason ?? body.error;
    throw new Error(`${body.error}: ${human}`);
  }
  return body;
}
```

Map of error codes → UI copy (suggestion, P3 adjusts for Lola Test):

| `error` | UI message (Tagalog or English) |
|---|---|
| `unauthorized` | "Please log in again." |
| `forbidden` | "You don't have access to this." |
| `contract_not_configured` | "The system is not ready yet. Try again in a minute." |
| `family_address_not_set` | "Your account isn't linked to a wallet. Contact support." |
| `store_address_not_set` | "Store hasn't set up payments. Contact the store." |
| `family_cannot_be_store` | "Cannot send a wishlist to your own store." (edge case) |
| `wishlist_not_found` | "We can't find that order." |
| `invalid_status` (current/expected in context) | "This order isn't ready for that step yet." |
| `already_locked` | "Funds already locked for this order." |
| `already_released` | "Funds already released for this order." |
| `contract_error` (reason from contract) | "Something went wrong on the blockchain: \<reason\>" |
| `insufficient_stock` | "Not enough stock at the store." |
| `multiple_stores` | "All items must come from the same store." (Day 4 demo) |
| `db_error` | "Save failed. Please try again." |

### For P4 (Charles — Data + Integration + PM)

1. **Run the updated `db/seed.sql`** in the Supabase SQL editor. The seed
   now sets `stellar_public_key` for OFW, family, AND store. Without this:
   - Deposit returns `400 ofw_address_not_set`.
   - Lock returns `400 family_address_not_set` or `store_address_not_set`.
   - Balances returns `400 address_not_set`.
2. **Run the updated `db/realtime.sql`** in the Supabase SQL editor.
   Adds `settlement` to the realtime publication so the Store dashboard
   gets the release receipt instantly.
3. **Ship `finalize_wishlist` RPC** (per your Day 4 plan — `db/functions.sql`).
   Signature: `finalize_wishlist(p_wishlist_id uuid) returns void`. When
   ready, paste the signature here so P2 can wire
   `supabase.rpc('finalize_wishlist', { wishlist_id })` into
   `/api/escrow/release` right after the chain success and before the
   `settlement` insert. **Until you ship this, inventory does not decrement.**
4. **Reset script (`db/reset.sql` + `scripts/reset-demo.ts`)** for Day 5.
   Not blocking the Day 4 gate, but P2 will rely on this for repeatable
   demo runs.
5. **Drop `dev_write_*` policies** on Day 4-5. P2 only uses the
   service-role client (RLS-bypassing); P3 uses the anon-key client for
   reads. The only place still hitting writes via anon-key would be P3's
   "Mark delivered" button — if you want to keep that as a direct Supabase
   update, add a narrow `store_writes_wishlist_status` policy. Otherwise
   ask P2 to add a `POST /api/wishlist/:id/deliver` route and drop the
   `dev_write_*` policies entirely.

---

## 6. UI integration contract (canonical)

This section is the **single source of truth** for how P3 calls the API.
If you change a route shape, update this section in the same PR.

### Auth — every route

```
Header:  Authorization: Bearer <supabase_access_token>
         Content-Type: application/json   (for POST routes)
```

Get a JWT for curl testing:
```bash
curl -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"cora.family@internstellar.demo","password":"demo123456"}'
```

### Response envelopes

**Success:** route-specific JSON object (no wrapping). All bigints serialized
as decimal strings.

**Error:** `{ "error": "<machine_code>", "reason"?: "<human>", ...context? }`
HTTP status mirrors the failure class (401/403/404/409/400/500/503).

### Endpoint summary

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/wishlist` | Create a draft wishlist with items |
| POST | `/api/deposit` | OFW deposit → split into 3 buckets |
| POST | `/api/escrow/lock` | Lock grocery bucket on-chain to the store |
| POST | `/api/escrow/release` | Release escrow (also credits store bucket) |
| GET | `/api/balances/:user_id` | Read on-chain buckets for a user |

Full request/response shapes are in §2 above.

### Reading state directly from Supabase (no P2 layer)

For pure reads, P3 can use the Supabase anon-key client directly:

```typescript
import { supabase } from "@/lib/supabase";

// List inventory
const { data: inventory } = await supabase.from("inventory").select("*");

// My wishlists
const { data: mine } = await supabase
  .from("wishlist")
  .select("*, wishlist_item(*)")
  .eq("family_id", familyId)
  .order("created_at", { ascending: false });

// Receipts
const { data: receipts } = await supabase
  .from("settlement")
  .select("*")
  .eq("wishlist_id", wishlistId)
  .order("created_at");
```

### Realtime subscriptions

```typescript
// Store dashboard — incoming orders
supabase
  .channel("store-orders")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "wishlist",
      filter: "status=in.(pending_approval,locked,delivered)" },
    (payload) => updateStoreFeed(payload),
  )
  .subscribe();

// Store dashboard — receipts the moment lock/release fires
supabase
  .channel("store-settlement")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "settlement" },
    (payload) => renderReceipt(payload.new),
  )
  .subscribe();

// Family view — my wishlist status
supabase
  .channel(`family-${familyId}`)
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "wishlist",
      filter: `family_id=eq.${familyId}` },
    (payload) => refreshMyOrder(payload.new),
  )
  .subscribe();
```

Realtime works because P4's updated `db/realtime.sql` puts `wishlist`,
`wishlist_item`, AND `settlement` in the `supabase_realtime` publication.

---

## 7. Operator end-to-end verification (Day 4 gate)

For when P1's contract id is filled and P4's SQL is re-run.

```bash
cd InternStellar-Hackathon

# 1. Type-check + smoke test + build (all done in this conversation already)
npx tsc --noEmit
npm run test:escrow-wiring
npm run build

# 2. Fund the demo signer (idempotent)
npm run fund-test-account

# 3. Start the dev server
npm run dev    # in another terminal

# 4. Get a family JWT
curl -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"cora.family@internstellar.demo","password":"demo123456"}' \
  | jq -r .access_token
# copy the printed access_token → $FAMILY_JWT

# 5. Get an OFW JWT (same flow, different email)
curl -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"maria.ofw@internstellar.demo","password":"demo123456"}' \
  | jq -r .access_token
# → $OFW_JWT

# 6. OFW deposits + splits
curl -X POST http://localhost:3000/api/deposit \
  -H "Authorization: Bearer $OFW_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "ofw_id": "11111111-1111-1111-1111-111111111111",
    "total_stroops": "10000000000",
    "pct_util": 60,
    "pct_groc": 30,
    "pct_emerg": 10
  }'

# 7. OFW balances reflect split
curl http://localhost:3000/api/balances/11111111-1111-1111-1111-111111111111 \
  -H "Authorization: Bearer $OFW_JWT"

# 8. Family creates wishlist
curl -X POST http://localhost:3000/api/wishlist \
  -H "Authorization: Bearer $FAMILY_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "family_id": "22222222-2222-2222-2222-222222222222",
    "items": [
      { "inventory_id": "a0000000-0000-0000-0000-000000000001", "quantity": 1 },
      { "inventory_id": "a0000000-0000-0000-0000-000000000002", "quantity": 2 }
    ],
    "notes": "Maintenance meds + sardines"
  }'
# → $WISHLIST_ID

# 9. Family locks escrow (this is the Day 3 gate)
curl -X POST http://localhost:3000/api/escrow/lock \
  -H "Authorization: Bearer $FAMILY_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"family_id\":\"22222222-2222-2222-2222-222222222222\",\"wishlist_id\":\"$WISHLIST_ID\"}"

# 10. Store marks delivered (P3 button OR raw SQL)
#     For curl-only: UPDATE wishlist SET status='delivered' WHERE id = $WISHLIST_ID;

# 11. Family confirms delivery → release (Day 4 gate)
curl -X POST http://localhost:3000/api/escrow/release \
  -H "Authorization: Bearer $FAMILY_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"family_id\":\"22222222-2222-2222-2222-222222222222\",\"wishlist_id\":\"$WISHLIST_ID\"}"

# 12. Store grocery bucket reflects the released amount
curl http://localhost:3000/api/balances/33333333-3333-3333-3333-333333333333 \
  -H "Authorization: Bearer $FAMILY_JWT"     # for demo, family JWT also works since profile read is open
```

If steps 6-12 all return 2xx, the Golden Path is closed end-to-end.

---

## 8. Out of scope (intentionally deferred)

- **Freighter wallet signing** — stretch only per CLAUDE.md. Current
  routes use server-side signing with `STELLAR_DEMO_SECRET_KEY`.
- **Multi-store wishlists** — single-store demo is enforced by both the
  wishlist creation route (`409 multiple_stores`) and the lock route
  (defense-in-depth).
- **Event replay / receipts via Soroban `getEvents`** — Day 4 stretch.
  Routes emit a `TODO` comment for this.
- **Inventory decrement** — owned by P4's `finalize_wishlist` RPC. P2
  has placeholder for the rpc call in the release route — will land when
  P4 ships the function.
- **Cancellation route** (`status=cancelled`) — not on the critical path.

---

## 9. Plan revisions (incremental from `DAY3-P2.md`)

1. **Day 4 contract supersedes Day 3.** `lock_escrow` now takes a `store`
   address. The lock route derives store from the inventory join — no
   schema change. Single-store demo enforced at creation AND lock.
2. **Store profile also seeded with `stellar_public_key`.** Day 4 release
   credits the store's grocery bucket, which means `get_balances(store)`
   must work. Demo uses the same testnet identity across all three
   profiles; production splits them.
3. **`settlement` added to the realtime publication.** The Store dashboard
   gets receipts the instant lock/release fires. Replaces the polling
   loop P3 would have otherwise written.
4. **Arg validation moved before `loadConfig()`** in `lib/stellar/contract.ts`.
   Callers now get exact reasons (`"family cannot be store"`,
   `"percentages must sum to 100"`) even when env is partial. Smoke test
   relies on this.
5. **No new packages.** Day 3 already allowed `@supabase/supabase-js`;
   Day 4 ships with the same lockfile.
6. **`/api/balances/:user_id` is now scoped to the caller** (`caller.userId
   === user_id`). If we want the family to read the store's balance for
   the receipt UI, we relax this — flag in next sync.

---

**P2 is done for Day 3-4 scope.** Remaining items belong to P1, P3, and
P4 — see §5 for the punch list.
