DAY 2 — The Split Function (hour-by-hour) — DONE
Goal: deposit_and_split works and is unit-tested locally. By tonight P3's sliders move real on-chain balances.

Result:
- Contract project:  internstellar-contract/contracts/internstellar
- Contract ID:       CCNHZGSUWCQXWFVU4IGFRNC5FWYJTGUPOAIHV7KNRSB7KLWVJNPQ43OE
- Wasm Hash:         3901b5dc8008988d58def3d8d6208d3a530b2db7a85dd914fc45124dfa4994c6
- Deploy tx:         ed5ddf5f7de75708bbac9ad930afc1d6dc70677ca954355114ff651175937806
- Invoke tx:         a6d64794fea0cd0e63fad905fc5acb3da53f951f902efca9e8c03bab287b32ce
- Source account:    internstellar (GAC3WCB5ZZ5GVWDOL4XCA3UJU5ZQ4CCAODREOEDLJB5UT4Q6BZDKPYUK)
- Invoke return:     ["6000000000","3000000000","1000000000"] (60/30/10 of 1000 XLM in stroops)
- Unit tests:        8 passed; 0 failed

Hour 0–1 · Design before you type — DONE

- DONE: Function contract on paper:
  Inputs: depositor address, total amount, three percentages (util, groc, emerg).
  Effect: store three running balances (UTIL, GROC, EMERG) keyed by depositor address.
  Output: the three shares produced by this deposit.
- DONE: Money representation: i128 in base units (1 XLM = 10_000_000). No floats anywhere.
- DONE: Percentages as integers; multiply BEFORE divide; remainder trick for the last bucket so total is preserved.

Hour 1–3 · Write it — DONE

- DONE: deposit_and_split implemented in contracts/internstellar/src/lib.rs
- DONE: Persistent storage keyed by DataKey::{Util,Groc,Emerg}(Address)
- DONE: from.require_auth() enforced
- DONE: Validation: total > 0 and pct_util + pct_groc + pct_emerg == 100
- DONE: Running balance updates use checked_add (overflow-explicit)
- DONE: Verified soroban-sdk 25.3.1 storage::persistent API matches docs.rs

Hour 3–4 · Compile via the AI-Verification Loop — DONE

- DONE: stellar contract build succeeded
- DONE: Wasm File: target/wasm32v1-none/release/internstellar.wasm (4760 bytes)
- DONE: Exported function: deposit_and_split

Hour 4–6 · Unit test (this is non-negotiable) — DONE

- DONE: deposit_splits_60_30_10_correctly
- DONE: stored_balances_match_shares_on_first_deposit
- DONE: second_deposit_accumulates_running_balance
- DONE: rejects_percentages_summing_above_100
- DONE: rejects_percentages_summing_below_100
- DONE: rejects_zero_total
- DONE: rejects_negative_total
- DONE: remainder_trick_preserves_total_for_uneven_split
- DONE: Deployed updated contract to testnet, invoked once with real numbers, verified on Stellar Expert.

🟨 PAIR with P2 (30 min, mandatory) — TODO

- TODO: Walk P2 through the contract. P2 specifically hunts for:
  - overflow on the running-total adds
  - whether anyone unauthorized could call it
- Two pairs of eyes on money code.

🟥 End-of-Day-2 gate — IN PROGRESS

- DONE: Contract deployed and CLI invocation returns correct splits.
- TODO: P3 sliders → P2 API → contract → real balances come back. Number on screen equals stored balance. That's the win condition.

"You are behind" recovery (Day 2)
If split isn't tested by end of Day 2: cut scope, not corners. The split is P0 — it cannot be the thing that's missing. If you're behind, the thing that gives is escrow polish later, never split correctness. Tell P4 at the gate so Day 3 is re-planned around it.
