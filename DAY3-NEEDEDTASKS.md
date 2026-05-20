# DAY 3-4 Needed Tasks — Unified Timeline

**Date:** May 20-21, 2026 (Day 3 → Day 4)
**Status:** P1 contract deployed and verified on testnet (Day 4 redeploy).
**Driver:** Golden Path closes when one click-through runs
`deposit → split → wishlist → lock → deliver → release → store credited → inventory decrement`
without manual intervention.

---

## 📋 Executive Summary

P1 has shipped a Day 4 contract that supersedes the Day 3 one. Two real
changes for everyone downstream:

- **`lock_escrow` signature changed:** Now takes 3 args — `(family, store, amount)`.
- **`release_escrow` semantics changed:** On release, the store's grocery
  bucket is auto-credited. `get_balances(store_address)` will show the
  released amount.
- **Events emitted:** `deposit`, `esc_lock`, `esc_rel` (Soroban events).
- **New contract id:** `CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF`.

**What "done" looks like at the end of Day 3:**
escrow lock works on-chain; wishlist creates a real locked escrow.

**What "done" looks like at the end of Day 4:**
FULL Golden Path end to end works on one click-through, commit tagged.

---

## 🔥 P4 (Charles) — DAY 3 BLOCKING ITEMS

### **Item 1: 🔒 SECURITY — Rotate Supabase Service-Role Key**

**Problem:** Old `SUPABASE_SERVICE_ROLE_KEY` was committed to repo history.

**Steps (5 min):**
1. Supabase Dashboard → Project Settings → API
2. Reset the `service_role secret`
3. Update local `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=<new_key>
   ```
4. Share new key with team out-of-band (1Password / DM, NOT in repo).

---

### **Item 2: 🗄️ Execute `db/grants.sql`**

**Why:** service_role has no table privileges → every P2 API route returns
500 `db_error / permission denied`.

**Steps (2 min):**
1. Supabase Dashboard → SQL Editor → + New Query
2. Paste entire contents of `db/grants.sql`
3. Execute
4. Confirm: no errors

**Note:** `db/grants.sql` is idempotent — safe to re-run.

---

### **Item 3: 👤 Re-seed `db/seed.sql` (now sets `stellar_public_key`)**

**P2 has updated `db/seed.sql`** in this conversation. The seed now sets
`profiles.stellar_public_key` for BOTH the demo family and the demo store
to the testnet identity public key:
`GAC3WCB5ZZ5GVWDOL4XCA3UJU5ZQ4CCAODREOEDLJB5UT4Q6BZDKPYUK`.

**Steps (2 min):**
1. Supabase Dashboard → SQL Editor
2. Paste the updated `db/seed.sql` (P2 committed the change)
3. Execute
4. Verify:
   ```sql
   SELECT id, display_name, stellar_public_key FROM profiles ORDER BY id;
   ```
   All three rows should now show a public key.

**Why both family AND store?** Day 4 contract credits the store's grocery
bucket on release. `get_balances(store)` returns the credited amount —
which means the store needs a Stellar address too. For the demo we use
the same testnet identity for both. In production these would be
different keypairs.

---

### **Item 4: Run `db/realtime.sql` again (adds settlement to publication)**

**P2 has updated `db/realtime.sql`** to include the `settlement` table in
the realtime publication, so the Store view live-updates when a release
fires (judges click the receipt link the moment it lands).

**Steps (1 min):**
1. Supabase Dashboard → SQL Editor
2. Paste the updated `db/realtime.sql`
3. Execute. Idempotent.

---

### **Item 5: Pitch Deck Outline (start)**

Per P4 field guide Day 3 task. Use the 10-slide skeleton from the field
guide. Doesn't have to be pretty yet — placeholders for slide 4 (the
product) and slide 6 (how it works) will be filled with real screenshots
on Day 4 after the Golden Path closes.

---

## 📝 P2 (Rene) — DAY 3 CODE UPDATES (done in this conversation)

The following ALL ship in this conversation. P3 doesn't need to wait.

| # | Update | Where | Status |
|---|---|---|---|
| 1 | New contract id in `.env.local` documentation | `.env.example` | ✅ (operator step) |
| 2 | `lockEscrow()` signature → 3 args (family, store, amount) | `lib/stellar/contract.ts` | ✅ |
| 3 | `/api/escrow/lock` derives store address from inventory join | `app/api/escrow/lock/route.ts` | ✅ |
| 4 | `family != store` validation before contract call | `app/api/escrow/lock/route.ts` | ✅ |
| 5 | New panic strings: `family cannot be store`, `store groc overflow` | `lib/stellar/contract.ts` | ✅ |
| 6 | `POST /api/wishlist` creation route (was missing) | `app/api/wishlist/route.ts` | ✅ |

---

## 📝 P2 (Rene) — DAY 4 CODE UPDATES (also done in this conversation)

The Day 4 "connect full chain through API routes" work:

| # | Update | Where | Status |
|---|---|---|---|
| 1 | `POST /api/deposit` (deposit_and_split) | `app/api/deposit/route.ts` | ✅ |
| 2 | `GET /api/balances/:user_id` (get_balances) | `app/api/balances/[user_id]/route.ts` | ✅ |
| 3 | Wiring smoke test extended for new routes | `scripts/_test-escrow-wiring.ts` | ✅ |
| 4 | UI integration contract documented for P3 | `DAY3-4-P2-SUMMARY-OF-WORK.md` | ✅ |

P2 is **DONE** end-of-Day-4. The remaining gate items belong to
P1 / P3 / P4 — see §"Remaining gate items" at the bottom.

---

## ✅ Verification Checklist

### **After P4 Completes Items 1-5:**

- [ ] Service-role key rotated
- [ ] `db/grants.sql` executed
- [ ] Updated `db/seed.sql` re-run; `profiles.stellar_public_key` set for
  family AND store
- [ ] Updated `db/realtime.sql` re-run; `settlement` in publication
- [ ] Pitch deck outline exists

### **After P2 Code (already done in this conversation):**

- [ ] `.env.local` has `NEXT_PUBLIC_CONTRACT_ID=CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF`
- [ ] `npm run build` passes (0 errors)
- [ ] `npm run test:escrow-wiring` passes
- [ ] All four routes registered:
  `POST /api/wishlist`, `POST /api/deposit`,
  `POST /api/escrow/lock`, `POST /api/escrow/release`,
  `GET /api/balances/[user_id]`

### **Day 3 Gate (P1 + P2 + P4):**

- [ ] One click-through from wishlist creation → lock_escrow → wishlist
  row shows `status='locked'` and `escrow_tx_hash` populated.
- [ ] Tx visible on stellar.expert.

### **Day 4 Gate (P1 + P2 + P3 + P4):**

- [ ] One click-through from deposit → split shows three running buckets.
- [ ] Family creates wishlist from inventory.
- [ ] Lock fires; store dashboard updates live via realtime.
- [ ] Store marks delivered.
- [ ] Family confirms; release fires; store grocery bucket credited
  (visible via GET balances).
- [ ] Inventory decrements (P4's `finalize_wishlist` RPC).
- [ ] Commit tagged `golden-path-v1`.

---

## 🎯 Timeline

| Task | Owner | Day | Time |
|---|---|---|---|
| Rotate service-role key | P4 | 3 | 5 min |
| Run `db/grants.sql` | P4 | 3 | 2 min |
| Re-run updated `db/seed.sql` | P4 | 3 | 2 min |
| Re-run updated `db/realtime.sql` | P4 | 3 | 1 min |
| Start pitch deck outline | P4 | 3 | 30 min |
| Update `lockEscrow()` to 3 args | P2 | 3 | 10 min ✅ |
| Update lock route (store derive + validate) | P2 | 3 | 20 min ✅ |
| Add new panic strings | P2 | 3 | 5 min ✅ |
| `POST /api/wishlist` route | P2 | 3 | 30 min ✅ |
| `POST /api/deposit` route | P2 | 4 | 30 min ✅ |
| `GET /api/balances/:user_id` route | P2 | 4 | 20 min ✅ |
| Wiring smoke test refresh | P2 | 4 | 10 min ✅ |
| Wire `lock_escrow` to lock fire on wishlist approval | P1 | 3-4 | — |
| Wire `release_escrow` to family-confirm path | P1 | 4 | — |
| `finalize_wishlist` RPC (inventory decrement) | P4 | 4 | — |
| UI screens that call P2's routes | P3 | 3-4 | — |
| Tag `golden-path-v1` commit | P1+P2 | 4 EOD | — |

---

## 📌 Key Contract Details

### **Contract API (Day 4)**

```rust
pub fn deposit_and_split(env, from: Address, total: i128,
                         pct_util: u32, pct_groc: u32, pct_emerg: u32)
    -> (i128, i128, i128)

pub fn get_balances(env, user: Address) -> (i128, i128, i128)

pub fn lock_escrow(env, family: Address, store: Address, amount: i128) -> u32

pub fn release_escrow(env, escrow_id: u32)
```

### **Events Emitted**

| Topic | When | Data |
|---|---|---|
| `deposit` | after `deposit_and_split` | `(family, util_share, groc_share, emerg_share)` |
| `esc_lock` | after `lock_escrow` | `(family, store, escrow_id, amount)` |
| `esc_rel` | after `release_escrow` | `(escrow_id, family, store, amount)` |

### **Auth Model**

- `deposit_and_split` requires `from.require_auth()` (OFW signs).
- `lock_escrow` requires `family.require_auth()` (family signs).
- `release_escrow` requires `family.require_auth()` (family signs).
- Store does NOT authorize anything.

For the server-signed flow: every demo signer's `profiles.stellar_public_key`
must equal the public key of `STELLAR_DEMO_SECRET_KEY`. For the demo we
use the same testnet identity for OFW, family, and store.

### **Storage After Operations**

After `release_escrow(escrow_id)`:
```
get_balances(store_address) → (util, groc + released_amount, emerg)
```

---

## 🚨 Common Pitfalls

1. Forgetting to rotate the service-role key → security liability.
2. Forgetting `db/grants.sql` → all API calls fail with permission denied.
3. Forgetting to re-seed `stellar_public_key` for both family AND store
   → `lock_escrow` panics with auth failure, or `release_escrow` credits
   a non-existent store.
4. Hardcoding the contract id → P1 redeploys and everyone breaks.
5. Skipping `family != store` validation → contract panics with
   `family cannot be store`, which is fine BUT wastes a network round trip.
6. Forgetting `npm run build` after pulling — old route code lingers.

---

## 📞 Cross-References

- [DAY3-P2.md](DAY3-P2.md) — original Day 3 P2 plan (now historical).
- [DAY3-4-P2-SUMMARY-OF-WORK.md](DAY3-4-P2-SUMMARY-OF-WORK.md) — what P2
  shipped + what remains for P1 / P3 / P4.
- [BlockerInformation/p2-rene.md](../BlockerInformation/p2-rene.md) — P1's
  contract handoff to P2 (signatures, panics, events, smoke tests).
- [BlockerInformation/p4-charles.md](../BlockerInformation/p4-charles.md) —
  P4 field guide (Day-by-day plan, ownership boundaries).

**Day 3 gate closes when:** lock → release round-trip completes
successfully with the Day 4 contract and DB is properly configured.

**Day 4 gate closes when:** the full Golden Path runs end-to-end on one
click-through and the commit is tagged.
