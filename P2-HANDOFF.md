# P2 — Contract Handoff

For P2 wiring API routes (`POST /api/deposit` and later escrow routes) to the InternStellar Soroban contract.

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

## Deployed Contract (Day 3 Escrow)

| Key | Value |
|---|---|
| Contract ID | `CAWU54VCOTXACW5RDQ23DMHMKCFHCRICGEHIGGCDL4GL4X6NP2ZBMPID` |
| Wasm Hash | `436ca76aac36ad45beb39249e01d0a8bbb8614ced97c690c7f32b80062c3bc3b` |
| Deploy tx | `64e46aaede316270140f2121436e2078bdcd198e001d3ee962bbc39bdaf795a2` |
| Source code | `internstellar-contract/contracts/internstellar/src/lib.rs` |
| Explorer | https://stellar.expert/explorer/testnet/contract/CAWU54VCOTXACW5RDQ23DMHMKCFHCRICGEHIGGCDL4GL4X6NP2ZBMPID |
| Lab | https://lab.stellar.org/r/testnet/contract/CAWU54VCOTXACW5RDQ23DMHMKCFHCRICGEHIGGCDL4GL4X6NP2ZBMPID |

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

## Day 3 Escrow Contract Additions

The same contract now has the API surface Rene's Day 3 routes expect:

```rust
pub fn get_balances(env: Env, user: Address) -> (i128, i128, i128)
pub fn lock_escrow(env: Env, family: Address, amount: i128) -> u32
pub fn release_escrow(env: Env, escrow_id: u32)
```

`lock_escrow` moves funds out of the family's grocery bucket into an escrow record and returns the contract escrow id. `release_escrow` marks that escrow record released. This demo version does not transfer a Stellar asset to a merchant yet; it protects the Golden Path by proving the lock/release state transition on-chain first.

**Auth model:** both `lock_escrow` and `release_escrow` call `family.require_auth()`. For Rene's server-signed API flow, seed the demo family's `profiles.stellar_public_key` with the public key for `STELLAR_DEMO_SECRET_KEY`.

**Escrow storage shape:**

```rust
DataKey::NextEscrowId -> u32
DataKey::Escrow(u32)  -> Escrow { family: Address, amount: i128, released: bool }
```

**Escrow panic strings for API mapping:**

- `escrow amount must be positive`
- `insufficient grocery balance`
- `escrow id overflow`
- `escrow not found`
- `escrow already released`

Planned API surface for P2:

- `POST /api/escrow/lock`
- `POST /api/escrow/release`
- `GET  /api/balances/:user`

Use the Day 3 contract ID above in `.env.local` as `NEXT_PUBLIC_CONTRACT_ID`.

## Test Identity

You can use your own funded testnet keypair, or for early integration use this one (testnet only, fake XLM):

```text
Alias:      internstellar
Public key: GAC3WCB5ZZ5GVWDOL4XCA3UJU5ZQ4CCAODREOEDLJB5UT4Q6BZDKPYUK
Network:    testnet
```

The secret key is NOT in the repo and should NOT be shared in chat. If you need a signer for backend testing, generate your own with `stellar keys generate <alias> --fund` on testnet.
