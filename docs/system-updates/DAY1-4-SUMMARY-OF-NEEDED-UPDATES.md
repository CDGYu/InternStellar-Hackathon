# InternStellar — Day 1-4 Summary + Needed UI Integration Updates

**Branch:** `Rene` (14 commits ahead of `origin/Rene` at the time of writing).
**Last merge:** `7e1d566 — Merge origin/Prince into Rene` (brings in P1's
contract source, docs reorganisation, and LICENSE).
**Audience:** the whole team — especially P3 (Gerardo) who will wire the UI.

> **Scope of this doc:** Part 1 is a closing audit of Day 1-4 work that
> exists in the repo today. Part 2 is the UI integration contract — every
> endpoint, payload shape, realtime channel, and error code P3 needs to
> wire the frontend against the backend P1/P2/P4 already shipped.

---

## PART 1 — Summary of what we built (Days 1-4)

### Contract layer (P1 — Prince)

| Day | What shipped | Where |
|---|---|---|
| 1 | Hello-world Soroban contract deployed to testnet | `internstellar-contract/`; contract id `CAVWRKTKOY5CSNIBMES3GP2VBVRHSMELP6G5VJBBYOLI7QTIKUH3NOSS` |
| 2 | `deposit_and_split(from, total, pct_util, pct_groc, pct_emerg) -> (i128,i128,i128)` with `from.require_auth()`, `checked_add` on running balances, remainder-trick for the third bucket | `internstellar-contract/contracts/internstellar/src/lib.rs` |
| 3 | `get_balances(user) -> (i128,i128,i128)` + `lock_escrow(family, store, amount) -> u32` + `release_escrow(escrow_id)` | Same `lib.rs`; Day 3 contract id `CAWU54VCOTXACW5RDQ23DMHMKCFHCRICGEHIGGCDL4GL4X6NP2ZBMPID` (superseded) |
| 4 | `lock_escrow` accepts `store`; `release_escrow` credits store's grocery bucket; on-chain events `deposit` / `esc_lock` / `esc_rel`; reject `family == store` | Day 4 contract id `CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF` |

**Tests:** 22 unit tests pass with snapshots committed in
`internstellar-contract/contracts/internstellar/test_snapshots/test/`.
Live testnet smoke included in `docs/handoffs/p2-rene.md` (deposit tx
`a33843…`, lock tx `97db84…`, release tx `bba080…`).

**P2 code review of `deposit_and_split`:** 0 critical / 0 high findings.
Three low-severity nits flagged (non-checked multiply, no TTL extend,
two missing test cases) — does not block the demo.

---

### API + bridge layer (P2 — Rene)

All routes are POST except balances. All require
`Authorization: Bearer <supabase_access_token>`. All return JSON. All
bigints serialised as decimal strings.

| Day | Route | What it does |
|---|---|---|
| 1 | — | Next.js 14 scaffolded, `@stellar/stellar-sdk@12.3.0`, Horizon client, Friendbot script, verify-stellar script |
| 2 | `POST /api/deposit` | OFW deposit → `deposit_and_split` → 3 buckets |
| 3 | `POST /api/wishlist` | Family creates a draft wishlist with items |
| 3 | `POST /api/escrow/lock` | Locks grocery bucket on-chain to derived store |
| 3 | `POST /api/escrow/release` | Releases escrow + auto-credits store + decrements inventory |
| 4 | `GET /api/balances/[user_id]` | Reads `get_balances` for OFW / family / store |

**Bridge module** (`lib/stellar/contract.ts`):
- `depositAndSplit()`, `lockEscrow()` (3-arg), `releaseEscrow()`, `getBalances()`
- `ContractNotConfiguredError` / `ContractCallError` with friendly `reason` field
- Day 4 panic strings mapped (`family cannot be store`, `store groc overflow`, etc.)
- Arg validation runs before `loadConfig()` so callers see exact reasons

**Standardised error envelope** (`lib/api/errors.ts`):
```
success:  route-specific JSON object
failure:  { error: "<machine_code>", reason?: "<human>", ...context? }
```

**Auth** (`lib/api/auth.ts`):
- `requireUser(req)` → verifies Bearer JWT via short-lived anon-key client
- Returns `{ userId, email }` or a 401 NextResponse
- Routes layer enforces `caller.userId === family_id` (or `ofw_id`) → 403 otherwise

**Wiring smoke test:** `npm run test:escrow-wiring` → 11/11 pass.

---

### Data layer (P4 — Charles, with carry-overs absorbed by P2)

**Schema (LOCKED Day 2):** 5 tables — `profiles`, `inventory`, `wishlist`,
`wishlist_item`, `settlement`. All in stroops (`bigint`). RLS enabled on all.

**Policies (`db/policies.sql`):** Read policies tightened per role.
`dev_write_*` policies kept open for the build window — to be dropped on
Day 4-5 once P3 hits writes via P2's routes only.

**Realtime (`db/realtime.sql`):** `wishlist`, `wishlist_item`, AND
`settlement` in the `supabase_realtime` publication. `REPLICA IDENTITY
FULL` on all three so subscribers see the full row on UPDATE/DELETE.

**Grants (`db/grants.sql`):** `service_role` has `select/insert/update/delete`
on all 5 tables, plus `ALTER DEFAULT PRIVILEGES` so future tables inherit.

**Seed (`db/seed.sql`):** 3 demo users with fixed UUIDs (`1111…`/`2222…`/`3333…`),
8 inventory items in stroops. `stellar_public_key` seeded:
- OFW (Auntie Maria) + Family (Lola Cora) → `GAC3WCB5ZZ5GVWDOL4XCA3UJU5ZQ4CCAODREOEDLJB5UT4Q6BZDKPYUK` (P1's demo signer)
- Store (Aling Nena) → `GCDBRYRNO6I5HHJJGKYBHJZB7JUFQ2ZA7HPIKKGBEMXG7J633QF6QBY5` (distinct testnet pubkey; store doesn't sign)

**Functions (`db/functions.sql`):** `finalize_wishlist(p_wishlist_id uuid)`
RPC — decrements `inventory.stock` for each `wishlist_item`, clamped at 0,
`SECURITY DEFINER`. Called from `/api/escrow/release` after chain success.

**Supabase migrations applied (project `xeaqcbskmzjkjrrlndan`):**
1. `p4_day3_grants_service_role`
2. `p4_day3_seed_stellar_public_key_for_demo_profiles`
3. `p4_day3_add_settlement_to_realtime_publication`
4. `p4_day3_distinct_store_stellar_public_key`
5. `p4_day4_finalize_wishlist_rpc`

---

### Verification (current `Rene` branch tip)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run test:stellar-lib` | 4/4 pass |
| `npm run test:escrow-wiring` | 11/11 pass |
| `npm run build` | 5 dynamic routes registered |
| Supabase live state | 5 tables/RLS-on, realtime publication has 3 tables, `finalize_wishlist` RPC live, demo profiles seeded |

---

### What was NOT done in scope (intentional)

- Frontend (P3 — Gerardo): see Part 2 below.
- `golden-path-v1` git tag: deferred until the click-through proves out.
- Service-role key rotation: P4 dashboard action (carry-over from Day 3 audit).
- Push to `origin/Rene`: working tree is clean but 14 commits remain local.

---

## PART 2 — Needed updates for UI integration (P3 — Gerardo)

This is the contract between the existing backend and the UI P3 builds.
**No backend changes are required** unless this section says so explicitly.

### 2.1 Environment + bootstrapping

The UI uses two Supabase clients:

```ts
// Already shipped — lib/supabase.ts (anon-key, client-safe)
import { supabase } from "@/lib/supabase";
```

Env vars the UI needs at build time:
```
NEXT_PUBLIC_SUPABASE_URL=https://xeaqcbskmzjkjrrlndan.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<public anon key>
NEXT_PUBLIC_CONTRACT_ID=CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF
```

Server-only (already set up — P3 does NOT touch):
```
SUPABASE_SERVICE_ROLE_KEY=<server-only>
STELLAR_DEMO_SECRET_KEY=<server-only, operator paste>
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

---

### 2.2 Login flow (Supabase Auth)

Each demo user logs in with email + password `demo123456`:

| Role | Email | UUID |
|---|---|---|
| OFW | `maria.ofw@internstellar.demo` | `11111111-1111-1111-1111-111111111111` |
| Family | `cora.family@internstellar.demo` | `22222222-2222-2222-2222-222222222222` |
| Store | `nena.store@internstellar.demo` | `33333333-3333-3333-3333-333333333333` |

```ts
const { data, error } = await supabase.auth.signInWithPassword({
  email, password: "demo123456",
});
// data.session.access_token  -> use as Bearer JWT for API calls
// data.user.id               -> use as ofw_id / family_id / store_id
```

After login, P3 fetches the profile to discover role:
```ts
const { data: profile } = await supabase
  .from("profiles")
  .select("id, role, display_name")
  .eq("id", session.user.id)
  .single();
// route to /ofw, /family, or /store based on profile.role
```

---

### 2.3 Generic API client (suggested helper)

All five backend routes return the same envelope shape. One helper handles them all:

```ts
async function callApi<T = any>(
  path: string,
  init: RequestInit & { token: string },
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${init.token}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) {
    // body.error = machine code; body.reason = human message
    const human = body.reason ?? body.error;
    const err = new Error(`${body.error}: ${human}`);
    (err as any).code = body.error;
    (err as any).context = body;
    throw err;
  }
  return body as T;
}
```

Use `err.code` to switch on the error machine code (table in §2.7), and
`err.context` for the additional fields per error (e.g. `current`, `expected`).

---

### 2.4 Three screens × what to call

#### OFW view — `/ofw`

| Element | Backend call | Body / params |
|---|---|---|
| Allocation sliders | (local state) | `pct_util`, `pct_groc`, `pct_emerg`, sum must equal 100 |
| Total field | (local state) | `total_stroops` as string (bigint) — convert from XLM at the boundary |
| "Send" button | `POST /api/deposit` | `{ ofw_id, total_stroops, pct_util, pct_groc, pct_emerg }` |
| Three balance cards | `GET /api/balances/${ofw_id}` | called after deposit succeeds AND on focus |
| Receipt card | (deposit response) | `tx_hash` → `https://stellar.expert/explorer/testnet/tx/${tx_hash}` |

Deposit success response:
```json
{
  "tx_hash": "a33843…",
  "shares": {
    "util_stroops": "6000000000",
    "groc_stroops": "3000000000",
    "emerg_stroops": "1000000000"
  },
  "total_stroops": "10000000000",
  "percentages": { "util": 60, "groc": 30, "emerg": 10 },
  "message": "Deposit split successfully…"
}
```

Balances success response:
```json
{
  "user_id": "11111111-…",
  "role": "ofw",
  "stellar_address": "GAC3WCB5…",
  "balances_stroops": { "utilities": "6000000000", "groceries": "3000000000", "emergency": "1000000000" },
  "display":          { "utilities": "600.0000 XLM", "groceries": "300.0000 XLM", "emergency": "100.0000 XLM" }
}
```

UI conversion rule: **always display from `display.*` if present**, never re-compute. Stroops → XLM at the boundary only.

---

#### Family view — `/family`

| Step | Backend call | Notes |
|---|---|---|
| Browse store inventory | `supabase.from("inventory").select("*")` | Direct anon-key read; RLS allows authenticated reads |
| Build cart locally | (local state) | `[{ inventory_id, quantity }]` |
| Submit wishlist | `POST /api/wishlist` | `{ family_id, items: [...], notes? }` |
| Show "draft" state | (response) | Wishlist appears in family's list with `status='draft'` |
| Lock escrow | `POST /api/escrow/lock` | `{ family_id, wishlist_id }` |
| Show "locked" state + receipt link | (response) | `tx_hash` + `escrow_id` (contract u32) |
| Wait for delivery | (realtime) | subscribe to own wishlist changes (§2.5) |
| Confirm delivery | `POST /api/escrow/release` | `{ family_id, wishlist_id }` |
| Show "released" receipt | (response) | `release_tx_hash` + `inventory_finalized` flag |
| Show my buckets | `GET /api/balances/${family_id}` | only the family's grocery shrinks after lock |

Wishlist creation response:
```json
{
  "wishlist_id": "<uuid>",
  "family_id": "22222222-…",
  "status": "draft",
  "total_stroops": "4850000",
  "item_count": 2,
  "notes": "…",
  "message": "Wishlist created…"
}
```

Lock success response:
```json
{
  "escrow_id": 1,
  "wishlist_id": "<uuid>",
  "tx_hash": "97db84…",
  "status": "locked",
  "amount_stroops": "4850000",
  "store_id": "33333333-…",
  "message": "Escrow locked successfully…"
}
```

Release success response:
```json
{
  "release_tx_hash": "bba080…",
  "status": "released",
  "inventory_finalized": true,
  "message": "Payment released to store. Thank you!"
}
```

If `inventory_finalized` is `false`, surface a soft warning ("Receipt OK,
stock sync delayed") but DO NOT block the success state — the chain has
already paid the store.

---

#### Store view — `/store`

The store does not initiate any blockchain calls. It only watches realtime
and flips `wishlist.status` from `'locked'` → `'delivered'`.

| Element | Backend call | Notes |
|---|---|---|
| Incoming orders feed | realtime on `wishlist` (§2.5) | Filter `status=in.(pending_approval,locked,delivered)` |
| Order detail | `supabase.from("wishlist_item").select("*, inventory(*)").eq("wishlist_id", id)` | Direct anon read |
| "Mark delivered" button | `supabase.from("wishlist").update({ status: "delivered" }).eq("id", id)` | Direct anon write via `dev_write_wishlist` policy (Day 5 will move this behind P2's API) |
| Receipts feed | realtime on `settlement` (§2.5) | Each row → "Received ₱X — receipt" |
| Store grocery balance | `GET /api/balances/${store_id}` | Bumps after each release |

---

### 2.5 Realtime subscriptions

Realtime is already configured on the server side (`wishlist`,
`wishlist_item`, `settlement` are in the publication; replica identity
full). The UI just subscribes.

```ts
// Family — watch my own wishlists transition
supabase
  .channel(`family-${familyId}`)
  .on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "wishlist",
      filter: `family_id=eq.${familyId}`,
    },
    (payload) => refreshMyWishlist(payload.new),
  )
  .subscribe();

// Store — incoming + in-flight orders
supabase
  .channel("store-orders")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "wishlist",
      filter: "status=in.(pending_approval,locked,delivered)",
    },
    (payload) => updateStoreFeed(payload),
  )
  .subscribe();

// Store — receipt the moment lock/release fires
supabase
  .channel("store-receipts")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "settlement" },
    (payload) => renderReceipt(payload.new),
  )
  .subscribe();
```

Unsubscribe on route change to avoid the realtime-tax P4 flagged in the
field guide.

---

### 2.6 Wishlist status state machine (for UI badges)

```
draft ──► pending_approval ──► locked ──► delivered ──► released   (terminal)
   │
   └──► cancelled
```

UI mapping (Lola Test — Tagalog/English mix, no jargon):
- `draft` → "Inihahanda" / "Draft"
- `pending_approval` → "Hinihintay ang Auntie" / "Awaiting approval"
- `locked` → "Bayad na sa eskrow" / "Payment held"
- `delivered` → "Nadeliver na" / "Delivered"
- `released` → "Tapos na ✓" / "Done ✓"
- `cancelled` → "Kinansela" / "Cancelled"

---

### 2.7 Error code → UI copy map

All five routes share the same envelope. P3 maps `body.error` to copy:

| `error` code | HTTP | Suggested UI copy |
|---|---|---|
| `unauthorized` | 401 | "Please log in again." |
| `forbidden` | 403 | "You don't have access to this." |
| `invalid_body` | 400 | "Form has an invalid field." (debug: show `reason`) |
| `contract_not_configured` | 503 | "Payments are warming up. Try again in a minute." |
| `contract_error` | 400 | Map `reason`:<br>• `family cannot be store` → "You can't pay your own store."<br>• `insufficient grocery balance` → "Not enough in the grocery wallet."<br>• `escrow already released` → "This order is already paid out."<br>• `escrow not found` → "We can't find that payment."<br>• default → "Blockchain says: \<reason\>" |
| `family_address_not_set` | 400 | "Your account isn't linked to a wallet. Contact support." |
| `store_address_not_set` | 400 | "Store hasn't set up payments." |
| `wishlist_not_found` | 404 | "We can't find that order." |
| `wishlist_empty` | 409 | "Your cart is empty." |
| `invalid_status` | 409 | "This order isn't ready for that step yet." (debug: `current` / `expected`) |
| `already_locked` | 409 | "Payment already held for this order." |
| `already_released` | 409 | "Payment already released for this order." |
| `multiple_stores` | 409 | "All items must come from the same store." |
| `insufficient_stock` | 409 | "Not enough stock for `<name>`." |
| `db_error` | 500 | "Save failed. Please try again." |

---

### 2.8 Stellar Expert receipt links

Build `https://stellar.expert/explorer/testnet/tx/${tx_hash}` for every
`tx_hash` and `release_tx_hash` returned by the API. Use them on:
- OFW deposit success card
- Family lock success card
- Family release success card
- Store receipts feed (one link per settlement row)

The hash returned is already a 64-char hex string — no transformation needed.

---

### 2.9 Money formatting

1 XLM = 10_000_000 stroops. Backend always returns stroops as decimal strings (JSON has no bigint).

UI rule:
```ts
function stroopsToXlm(stroops: string | bigint): string {
  const s = BigInt(stroops);
  if (s === 0n) return "0.0000 XLM";
  const whole = s / 10_000_000n;
  const frac = s % 10_000_000n;
  if (whole === 0n && frac < 1000n) return "<0.0001 XLM";
  return `${whole}.${frac.toString().padStart(7,"0").slice(0,4)} XLM`;
}
```

For balances, the API already returns a pre-formatted `display.*` field.
For deposit/lock/release responses, format on the client using the snippet above.

---

### 2.10 Operator-level steps before the UI demo can run live

These are NOT P3 tasks but they block the first end-to-end click-through:

1. **Paste `STELLAR_DEMO_SECRET_KEY` into `.env.local`.** Must be the
   secret tied to public key `GAC3WCB5ZZ5GVWDOL4XCA3UJU5ZQ4CCAODREOEDLJB5UT4Q6BZDKPYUK`
   (P1's `internstellar` testnet identity). Without this, every contract
   call returns `503 contract_not_configured`.
2. **Rotate the leaked Supabase `service_role` key** (Project Settings →
   API → Reset). Update `.env.local`.
3. **Run `npm run dev`** in `InternStellar-Hackathon/` — the API layer is
   ready to serve once env is filled.
4. **Push `Rene` branch** when ready: `git push origin Rene`. 14 commits
   are queued locally.

After step 1 + 2, P3 can drive the full Golden Path on `localhost:3000`
without any backend changes.

---

### 2.11 What backend changes WOULD be needed if UX requires them

The current backend covers the Golden Path. These are **only** needed if
P3 finds a UX requirement that can't be satisfied with what's listed
above. P2 owns these — flag in the daily sync.

- `POST /api/wishlist/[id]/deliver` — server-side wrapper for "Mark
  delivered" (replaces Store's direct anon-key update). Only needed when
  dropping `dev_write_wishlist` policy on Day 5.
- `GET /api/wishlist/[id]` — single wishlist detail with joined items.
  Currently P3 reads this directly from Supabase anon-key. Move to API
  only if RLS becomes too restrictive.
- `GET /api/wishlist?family_id=…` — paginated family wishlist history.
  Same reasoning as above.
- Cancellation: `POST /api/wishlist/[id]/cancel` — transitions
  `draft → cancelled`. Not on the critical path; add if the UI surfaces a
  cancel button.
- Soroban event replay (`getEvents` from RPC) for a "what happened" timeline.
  Stretch only.

---

## Cross-references

- `docs/handoffs/p2-rene.md` — P1's outgoing handoff to P2 (signatures, panics, events, smoke tests).
- `docs/handoffs/p4-charles.md` — P1's outgoing handoff to P4.
- `docs/from-team/rene-day3-plan.md` — P2's original Day 3 plan with revisions log.
- `docs/from-team/rene-day3-summary.md` — P2's Day 3 summary (Supabase grants finding).
- `docs/working-guide/` — P1's day-by-day plans and field guides.
- `docs/pitch/pitch-deck-outline.md` — P4 Day 3 outline.
- `docs/specs/2026-05-19-chain-bridge-setup-design.md` — bridge bootstrap design.
- `internstellar-contract/contracts/internstellar/src/lib.rs` — the contract.
- `db/*.sql` — the data layer.
- `lib/stellar/contract.ts` — the chain bridge.
- `lib/api/{auth,errors}.ts` — auth + error envelope helpers.
- `app/api/*` — the five HTTP routes.

**End of summary.** The backend is ready. The next move is P3's UI plus
the two operator-level env fills in §2.10.
