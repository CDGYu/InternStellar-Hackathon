# P2 — Contract Handoff (Rene)

For P2 wiring API routes (`POST /api/deposit` and later escrow routes) to the InternStellar Soroban contract.

## 📌 Current Action Items (Day 4 — store credit + events)

Last updated: 2026-05-20 (Day 4 contract shipped). Two real changes this time: `lock_escrow` now takes a `store` address, and `release_escrow` credits that store's grocery bucket. Plus every state-changing function now emits an event the dApp can listen to.

1. **Update `.env.local`** with the new contract id:
   ```
   NEXT_PUBLIC_CONTRACT_ID=CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF
   ```
   (Day 3 id `CAWU54VCOTXACW5RDQ23DMHMKCFHCRICGEHIGGCDL4GL4X6NP2ZBMPID` is superseded.)

2. **`lock_escrow` signature changed** — now takes 3 args:
   - **Before:** `lock_escrow(family: Address, amount: i128) -> u32`
   - **After:** `lock_escrow(family: Address, store: Address, amount: i128) -> u32`
   - Your `POST /api/escrow/lock` body needs to also accept (or derive) a `store_id` / store address. The wishlist already references inventory rows owned by a store profile, so the store address is `(SELECT stellar_public_key FROM profiles WHERE id = wishlist.store_id)` or equivalent. Add a `family_address != store_address` guard before calling the contract, or the contract will panic with `"family cannot be store"` and you'll surface that as `contract_error`.
   - `lib/stellar/contract.ts` needs the new arg in `lockEscrow()`:
     ```ts
     export async function lockEscrow(args: {
       familyAddress: string;
       storeAddress: string;    // NEW
       amountStroops: bigint;
     }): Promise<{ txHash: string; escrowId: unknown }> { ... }
     ```
     And the `invokeContract("lock_escrow", […])` call grows from 2 ScVals to 3.

3. **`release_escrow` semantics changed** — same signature `release_escrow(escrow_id: u32)`, but now it does TWO things:
   - Marks the escrow `released = true` (as before)
   - Credits the store's grocery bucket: `DataKey::Groc(store) += amount`
   - For the UI: after release, `get_balances(store_address)` returns the new credited amount. This is what the demo "funds landed at the store" beat shows.

4. **Events emitted** — three topic symbols, one per state change. All emitted from `NEXT_PUBLIC_CONTRACT_ID`:

   | Topic | When | Data tuple |
   |---|---|---|
   | `deposit` | after `deposit_and_split` | `(family, util_share, groc_share, emerg_share)` |
   | `esc_lock` | after `lock_escrow` | `(family, store, escrow_id, amount)` |
   | `esc_rel` | after `release_escrow` | `(escrow_id, family, store, amount)` |

   You can read these via the Soroban RPC `getEvents` method (see https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getEvents). Filter by `topics: [["AAAADwAAAAdkZXBvc2l0AA==", ...]]` (base64-encoded Symbols) and `contractIds: ["CB3...ZGRDF"]`. Useful for: avoiding a polling loop in the UI, and getting historical replay for the receipts view.

5. **Auth model unchanged** — `lock_escrow` and `release_escrow` still call `family.require_auth()`. P4's seed task (demo family's `profiles.stellar_public_key` = `STELLAR_DEMO_SECRET_KEY`'s public key) is still required.

6. **Lock route's `escrow_id` shape** — still `u32`. Your `convertEscrowIdToScVal` already handles u32, no change.

7. **Verified on testnet** (smoke test):
   ```text
   deposit tx:  a33843763a5a1f643fa5ec038c83882ecd51545ca02086656eaf8e8ae8d6a039
   deposit event: ["deposit"] = (family, 6000000000, 3000000000, 1000000000)

   lock tx:     97db84a18330476c660706e8af46eb3aef35af7c1e07e7100f5e1650b0fdb136
   lock event:  ["esc_lock"] = (family, store, 1, 2000000000)

   release tx:  bba0803f0a17464ff5811470b7513ff6119d166ea0586f493662936b3915ad86
   release event: ["esc_rel"] = (1, family, store, 2000000000)

   Final get_balances(store) = ["0","2000000000","0"]   ← store grocery bucket credited
   ```

8. **Panic strings (updated)** — for your `extractPanicReason` mapping:
   - `total must be positive`
   - `percentages must sum to 100`
   - `util overflow` / `groc overflow` / `emerg overflow`
   - `escrow amount must be positive`
   - **`family cannot be store`** (NEW — surface as 400 `contract_error`)
   - `insufficient grocery balance`
   - `groc underflow`
   - `escrow id overflow`
   - `escrow not found`
   - `escrow already released`
   - `store groc overflow` (NEW)



## Network

| Key | Value |
|---|---|
| Network | testnet |
| RPC URL | https://soroban-testnet.stellar.org |
| Network Passphrase | `Test SDF Network ; September 2015` |

## Deployed Contract (Day 2)

| Key | Value |
|---|---|
| Contract ID | `CCNHZGSUWCQXWFVU4IGFRNC5FWYJTGUPOAIHV7KNRSB7KLWVJNPQ43OE` |
| Wasm Hash | `3901b5dc8008988d58def3d8d6208d3a530b2db7a85dd914fc45124dfa4994c6` |
| Deploy tx | `ed5ddf5f7de75708bbac9ad930afc1d6dc70677ca954355114ff651175937806` |
| Source code | `internstellar-contract/contracts/internstellar/src/lib.rs` |
| Explorer | https://stellar.expert/explorer/testnet/contract/CCNHZGSUWCQXWFVU4IGFRNC5FWYJTGUPOAIHV7KNRSB7KLWVJNPQ43OE |
| Lab | https://lab.stellar.org/r/testnet/contract/CCNHZGSUWCQXWFVU4IGFRNC5FWYJTGUPOAIHV7KNRSB7KLWVJNPQ43OE |

## Deployed Contract (Day 3 Escrow — superseded by Day 4)

| Key | Value |
|---|---|
| Contract ID | `CAWU54VCOTXACW5RDQ23DMHMKCFHCRICGEHIGGCDL4GL4X6NP2ZBMPID` |
| Wasm Hash | `436ca76aac36ad45beb39249e01d0a8bbb8614ced97c690c7f32b80062c3bc3b` |
| Deploy tx | `64e46aaede316270140f2121436e2078bdcd198e001d3ee962bbc39bdaf795a2` |

## Deployed Contract (Day 4 — store credit + events)

| Key | Value |
|---|---|
| Contract ID | `CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF` |
| Wasm Hash | `ff5d70fdf35b840b8975b5ea400ce0df7496eda877438f96382c871295f76e47` |
| Deploy tx | `82d070f1697dc5032e507a5aa1f642a68d427319a92c63c07a8c2f09ab18ad6f` |
| Wasm upload tx | `7cb07d8611ff26f2684f2c7d0968869075be07c397bcaa34d4193408fb056451` |
| Source code | `internstellar-contract/contracts/internstellar/src/lib.rs` |
| Explorer | https://stellar.expert/explorer/testnet/contract/CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF |
| Lab | https://lab.stellar.org/r/testnet/contract/CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF |

**Verified on testnet (escrow smoke test):**

```text
deposit_and_split tx: aa6f5a2c31db6f5018234768169f7e3a40583bd3ffac1942014516662a39a9ca
deposit return: ["6000000000","3000000000","1000000000"]
get_balances after deposit: ["6000000000","3000000000","1000000000"]
lock_escrow tx: 5277952024b0bf2e9dc9ddfb81043827fdbef3b96bd4a4cb5d7dafff63628791
lock_escrow return: 1
get_balances after lock: ["6000000000","1000000000","1000000000"]
release_escrow tx: 7caa0268e0a90961653a3b5a86ab475dde0ceca381ed47500e9a4677a4e0d2ff
```

## Money Convention

All amounts are integer base units. 1 XLM = 10_000_000 base units (Stellar stroops convention).
No floats. No decimals. Multiply before divide on the client side too, same as the contract.

Examples:

| Display | Base units |
|---|---|
| 1.00 XLM | 10_000_000 |
| 1.50 XLM | 15_000_000 |
| 1000 XLM | 10_000_000_000 |

## Function: deposit_and_split

Splits a deposit into three persistent buckets per depositor (utilities, groceries, emergency).

**Signature:**

```rust
pub fn deposit_and_split(
    env: Env,
    from: Address,
    total: i128,
    pct_util: u32,
    pct_groc: u32,
    pct_emerg: u32,
) -> (i128, i128, i128) // (util_share, groc_share, emerg_share) for THIS deposit
```

**Auth:** `from.require_auth()` — the depositor must authorize the transaction. Anyone who is not the depositor cannot drive this call on their behalf.

**Validation (these will panic the contract):**

- `total <= 0` → `"total must be positive"`
- `pct_util + pct_groc + pct_emerg != 100` → `"percentages must sum to 100"`

The API layer should validate these client-side first and return a friendly error before the contract is called.

**Storage shape (will be read by the future `get_balances`):**

```rust
DataKey::Util(Address)  -> i128   // running utilities balance
DataKey::Groc(Address)  -> i128   // running groceries balance
DataKey::Emerg(Address) -> i128   // running emergency balance
```

Each call accumulates: `new_balance = old_balance + share` using `checked_add`.

**Verified on testnet (smoke test):**

```text
Input:  total=10_000_000_000, pct_util=60, pct_groc=30, pct_emerg=10
Output: ["6000000000","3000000000","1000000000"]
```

**Reproduce via CLI:**

```bash
stellar contract invoke \
  --id CCNHZGSUWCQXWFVU4IGFRNC5FWYJTGUPOAIHV7KNRSB7KLWVJNPQ43OE \
  --network testnet \
  --source <your-stellar-identity> \
  --send=yes \
  -- deposit_and_split \
  --from <your-stellar-identity> \
  --total 10000000000 \
  --pct_util 60 \
  --pct_groc 30 \
  --pct_emerg 10
```

## API Layer Notes For P2

Suggestions for `POST /api/deposit`:

- Validate input first: reject `total <= 0` and percentages not summing to 100 with HTTP 400 and a friendly message.
- On contract failure, catch the Soroban error and return JSON like `{ "error": "deposit_failed", "reason": "<message>" }`.
- Do NOT expose XDR, stack traces, or raw Soroban error codes to the frontend.
- Return both:
  - the per-call shares from the contract response
  - the running balances (after we add `get_balances` on Day 3) so the UI can show "Grocery wallet: ₱600" without a second round trip
- Treat the contract ID as configuration:
  - `process.env.NEXT_PUBLIC_CONTRACT_ID` for Rene's current Next.js API routes
  - never hardcode in app code

## Contract API (Day 4)

```rust
pub fn deposit_and_split(env, from: Address, total: i128,
                         pct_util: u32, pct_groc: u32, pct_emerg: u32)
    -> (i128, i128, i128)

pub fn get_balances(env, user: Address) -> (i128, i128, i128)

pub fn lock_escrow(env, family: Address, store: Address, amount: i128) -> u32

pub fn release_escrow(env, escrow_id: u32)
```

`lock_escrow` moves funds out of the family's grocery bucket into an escrow record AND records the destination store. `release_escrow` marks the escrow released AND credits the store's grocery bucket with the held amount. Combined with the events below, the demo shows "funds left family → held in escrow → arrived at store" end-to-end on-chain.

**Auth model:** `lock_escrow` and `release_escrow` call `family.require_auth()`. The store does NOT need to authorize anything. For Rene's server-signed flow, the demo family's `profiles.stellar_public_key` must equal the public key of `STELLAR_DEMO_SECRET_KEY`.

**Storage shape:**

```rust
DataKey::Util(Address)   -> i128
DataKey::Groc(Address)   -> i128
DataKey::Emerg(Address)  -> i128
DataKey::NextEscrowId    -> u32
DataKey::Escrow(u32)     -> Escrow { family: Address, store: Address, amount: i128, released: bool }
```

**Events emitted (single Symbol topic each):**

- `deposit`   (after `deposit_and_split`)  data: `(family, util_share, groc_share, emerg_share)`
- `esc_lock`  (after `lock_escrow`)        data: `(family, store, escrow_id, amount)`
- `esc_rel`   (after `release_escrow`)     data: `(escrow_id, family, store, amount)`

Read via Soroban RPC `getEvents`, filter `contractIds: [NEXT_PUBLIC_CONTRACT_ID]`.

**Panic strings for API mapping:**

- `total must be positive`
- `percentages must sum to 100`
- `util overflow` / `groc overflow` / `emerg overflow`
- `escrow amount must be positive`
- `family cannot be store`
- `insufficient grocery balance`
- `groc underflow`
- `escrow id overflow`
- `escrow not found`
- `escrow already released`
- `store groc overflow`

API surface for P2:

- `POST /api/escrow/lock` (now needs `store_address` in body or derived from wishlist)
- `POST /api/escrow/release`
- `GET  /api/balances/:user` (Day 4)

Use the Day 4 contract id above in `.env.local` as `NEXT_PUBLIC_CONTRACT_ID`.

## Test Identity

You can use your own funded testnet keypair, or for early integration use this one (testnet only, fake XLM):

```text
Alias:      internstellar
Public key: GAC3WCB5ZZ5GVWDOL4XCA3UJU5ZQ4CCAODREOEDLJB5UT4Q6BZDKPYUK
Network:    testnet
```

The secret key is NOT in the repo and should NOT be shared in chat. If you need a signer for backend testing, generate your own with `stellar keys generate <alias> --fund` on testnet.
