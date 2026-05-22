# Mainnet Deploy — Team Reference

Last updated: 2026-05-22 11:25 +0800. Owner: P1 (Prince). Audience: P2 (Rene, API/Vercel), P3 (UI), P4 (Charles, Supabase).

This document is the source of truth for the **Option A + organizer-funded wallet** mainnet demo. It does **not** describe Tier-3 production (per-user wallets, SAC payouts, real custody) — that is out of scope for the hackathon.

---

## TL;DR

The contract was redeployed on the **Stellar public network** with the same on-chain behavior as the Day-4 testnet build (Option A: in-contract grocery buckets, three events). The single organizer wallet **`GBASZKU4ICS7Z2PN6NXWRYRVNIWEA52ERD4YDQ6YAYQSLEJWGEOY5RCI`** plays OFW + Family in the demo. A separate, locally-generated mainnet pubkey plays the Store (never signs, never funded).

| What | Value |
|------|-------|
| Network label | `public` (a.k.a. mainnet) |
| Network passphrase | `Public Global Stellar Network ; September 2015` |
| Soroban RPC | `https://soroban-rpc.mainnet.stellar.gateway.fm` |
| Horizon | `https://horizon.stellar.org` |
| Explorer base | `https://stellar.expert/explorer/public` |
| Mainnet contract id | `CCSK35NQQR46C7ULBEGL6FG7JJ7XPLR427ZN5HHN2FLBXTZNKT57GKRW` |
| Organizer pubkey (OFW + Family signer) | `GBASZKU4ICS7Z2PN6NXWRYRVNIWEA52ERD4YDQ6YAYQSLEJWGEOY5RCI` |
| Store pubkey (no signing, no funding) | `GB6LTILUFADQLSXRWNLHGFSKPVRBLAFVQZUHC4LLKCGEHCGG6T7U5ZV3` |
| WASM hash | `894971627dd1e537f12efa9965ff196cdd080c013bf9cc4b66f90198d14162c4` |
| Testnet contract id (still valid as fallback) | `CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF` |

> The testnet contract is **not** retired. `demo.sh` still runs against testnet for the pitch fallback. Mainnet is an additional target, not a replacement.

Mainnet smoke result:

| Step | Result |
|------|--------|
| Deploy | `CCSK35NQQR46C7ULBEGL6FG7JJ7XPLR427ZN5HHN2FLBXTZNKT57GKRW` |
| `deposit_and_split` | tx `b014a121980f7aac4b1eb6896c81e18ce490d24acbc305299b4bd2e78d36ece9`, event `deposit`, shares `(6000, 3000, 1000)` |
| `lock_escrow` | tx `5cae5eaa93e6321fc4d2b8929d1394a14ac27f0828c95351697b68ba8d12b507`, event `esc_lock`, escrow id `1` |
| `release_escrow` | tx `4558fc00e4034fcdc5fe4ace4112d7bae0f6285e88c9b3c9a7874cc9f8653a60`, event `esc_rel` |
| `get_balances(store)` | `["0","2000","0"]` |

---

## What changed in the codebase

| File | Change | Why |
|------|--------|-----|
| `lib/stellar/network.ts` | Was hardcoded to `Networks.TESTNET`. Now reads `STELLAR_NETWORK` and `STELLAR_NETWORK_PASSPHRASE` from env at startup, falls back to testnet, and exports `STELLAR_EXPLORER_BASE` so UI links can use either explorer. Also exports `resolveNetwork(env)` for tests. | One build can target either network via Vercel env, no recompile required. |
| `scripts/_test-stellar-lib.ts` | Now verifies both the default (testnet) branch and the mainnet branch via `resolveNetwork()` with synthetic envs. | Keeps the env-driven resolver covered in CI. |
| `.env.example` | Adds a commented mainnet block (URLs + passphrase). Existing testnet defaults are unchanged. | Operators see the mainnet shape without having to look it up. |
| `internstellar-contract/scripts/deploy-mainnet.sh` | New file. One-shot mainnet deploy + smoke (deposit → lock → release → store balance check). Aborts loudly if the organizer balance is below 30 XLM or the identity is missing. | Reproducible mainnet deploy, no copy-pasted CLI commands. |
| `internstellar-contract/scripts/demo.sh` | Unchanged. Still the testnet rehearsal fallback for the pitch. | Don't break Day-5/6 rehearsals. |

The contract source (`internstellar-contract/contracts/internstellar/src/lib.rs`) is **identical** to the Day-4 testnet build — `panic_with_error!`, `extend_ttl`, `checked_add`, and the three events (`deposit`, `esc_lock`, `esc_rel`) are all in place. The WASM hash above proves the bytes match.

---

## Who needs to do what

### P2 (Rene) — API & Vercel env

1. **Update Vercel environment variables** (Production scope). Step-by-step: see `docs/handoffs/vercel-mainnet-env.md`.
2. **No code changes required in `lib/stellar/contract.ts` or the `/api/*` routes.** They already read `STELLAR_RPC_URL`, `NEXT_PUBLIC_CONTRACT_ID`, and `STELLAR_DEMO_SECRET_KEY` from env, and they pass `NETWORK_PASSPHRASE` from `lib/stellar/network.ts` — which is now env-driven.
3. **Smoke after Vercel redeploys:** call `POST /api/health`, then a real OFW deposit through the UI. The first lock should emit an `esc_lock` event visible on `https://stellar.expert/explorer/public/contract/CCSK35NQQR46C7ULBEGL6FG7JJ7XPLR427ZN5HHN2FLBXTZNKT57GKRW/events`.

### P3 (UI) — explorer links

Nine UI files hardcode `https://stellar.expert/explorer/testnet/...`. They will be wrong on mainnet. Two options:

| Approach | Effort | Trade-off |
|----------|--------|-----------|
| **A.** Replace each hardcoded string with `${STELLAR_EXPLORER_BASE}` imported from `lib/stellar/network.ts` | ~15 min, one PR | Best — flips with env |
| **B.** Hardcode `explorer/public` for the mainnet demo branch only, accept the manual flip back for testnet | ~5 min | Faster, but the next demo will hit this again |

Files (all under `app/`):

- `(app)/family/page.tsx`
- `(app)/family/WishlistBuilder.tsx`
- `(app)/ofw/BillsPanel.tsx`
- `(app)/ofw/OfwWishlistRow.tsx`
- `(app)/ofw/SendFundsForm.tsx`
- `(app)/ofw/TransactionHistory.tsx`
- `(app)/store/ReceiptCard.tsx`
- `(app)/store/page.tsx`
- `mobile/components/MobileSendFunds.tsx`

Also flip the copy in `app/settings/terms/page.tsx` and `app/mobile/settings/privacy/page.tsx` from "Stellar testnet" → "Stellar mainnet" (or "Stellar public network") before the demo. Otherwise judges read "testnet" while the txs are on mainnet.

### P4 (Charles) — Supabase data

The contract calls `family.require_auth()` on `lock_escrow` and `release_escrow`. The server signs with `STELLAR_DEMO_SECRET_KEY`, so every demo profile's `stellar_public_key` **must** equal that signer's public key — except the store, which must be **distinct** or `lock_escrow` panics with `family cannot be store`.

Run this against the Supabase mainnet target (or use the SQL editor):

```sql
-- OFW + Family share the organizer pubkey (server signs as both).
update profiles
   set stellar_public_key = 'GBASZKU4ICS7Z2PN6NXWRYRVNIWEA52ERD4YDQ6YAYQSLEJWGEOY5RCI'
 where id in (
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222'
 );

-- Store gets a distinct mainnet pubkey (never signs, never funded).
update profiles
   set stellar_public_key = 'GB6LTILUFADQLSXRWNLHGFSKPVRBLAFVQZUHC4LLKCGEHCGG6T7U5ZV3'
 where id = '33333333-3333-3333-3333-333333333333';
```

Verify:

```sql
select id, role, stellar_public_key from profiles
 where id in (
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333'
 );
```

Family and store rows must have **different** values; OFW and family may share.

---

## Reproducing the deploy

Prereqs:

- Stellar CLI ≥ 22 (`stellar --version`).
- Funded mainnet account (organizer wallet).
- `cargo` and the `wasm32v1-none` target reachable from your shell (Windows users: run from WSL Ubuntu).

Steps:

```bash
# 1. Register the organizer secret as a CLI identity (interactive prompt;
#    secret never appears in terminal logs or git history). One time only.
stellar keys add internstellar-mainnet --secret-key

# 2. Build the WASM (release profile, wasm32v1-none).
cd internstellar-contract
stellar contract build

# 3. Deploy + smoke (~0.001 XLM total in real fees).
bash scripts/deploy-mainnet.sh
```

`deploy-mainnet.sh` will:

1. Read the organizer pubkey + balance, abort if balance < 30 XLM.
2. Generate a `internstellar-store-mainnet` CLI identity without funding it (pubkey only — store never signs).
3. Run `stellar contract deploy --network mainnet`, capture the new contract id.
4. Smoke test the full happy path: `deposit_and_split` 0.001 XLM, `lock_escrow`, `release_escrow`, `get_balances(store)`.
5. Print three explorer URLs (deposit / lock / release) and the new `NEXT_PUBLIC_CONTRACT_ID`.

To deploy *without* the smoke (for example, if you want to drive the smoke through the UI): `SKIP_SMOKE=1 bash scripts/deploy-mainnet.sh`.

---

## Honesty checklist for the demo

These are **must-say-out-loud** items if anyone (judge, mentor, sponsor) asks how the mainnet build works:

1. **One wallet signs for two roles.** The organizer key plays OFW *and* Family. Real users in production would each have their own wallet (Freighter or smart-account); we did not build that in 7 days.
2. **Store "payment" is a bucket update, not an XLM transfer.** `release_escrow` increments `get_balances(store).groc` inside the contract; no XLM moves from organizer → store wallet. Option B (SAC transfer) was the planned upgrade and remains future work.
3. **`deposit_and_split` does not custody XLM.** It records a 60/30/10 split in contract storage after `from.require_auth()`. The organizer's XLM stays in the organizer wallet; the contract is not a vault.
4. **Bills (`/api/bills/pay`) *do* move real XLM** — those are classic Horizon payment ops from the organizer signer to the biller's mainnet account. Watch the organizer balance during the demo.

---

## Rollback

If the mainnet demo misbehaves during rehearsal or the live pitch:

1. On Vercel, change `STELLAR_NETWORK` back to `testnet` and revert the four URL/passphrase vars + `NEXT_PUBLIC_CONTRACT_ID` to the testnet values (the .env.example block has both). Redeploy.
2. Re-seed the Supabase demo profiles with the testnet keys from `db/seed.sql` (`GA5M6MWP4UU7VCNDMDT5GE6MHELVY6TQCJ2AIYXHEHEMT5CYH6HKHC6H` for OFW/family — this is the current testnet `STELLAR_DEMO_SECRET_KEY` signer, **not** the older `GAC3WCB5…` `internstellar` identity referenced in day1–4 logs — and `GCDBRYRNO6I5HHJJGKYBHJZB7JUFQ2ZA7HPIKKGBEMXG7J633QF6QBY5` for store).
3. `bash internstellar-contract/scripts/demo.sh` to confirm the testnet rehearsal still works.

Total rollback time: ~3 minutes if you have the testnet env block bookmarked.

---

## What this doc does **not** cover

- Per-user wallets (Freighter, smart accounts).
- SAC-based real XLM payout to the store (Option B).
- Compliance / KYC for handling real OFW funds.
- Production Supabase RLS hardening beyond the dev_write removal already done on Day 4.

Those are post-hackathon items. The audit doc `NEEDED-UPDATES-FOR-THE-REPO.md` enumerates them.

---

## Cross-references

- `docs/handoffs/vercel-mainnet-env.md` — step-by-step Vercel env update (this is Prince's runbook for the change he's doing).
- `docs/handoffs/p2-rene.md` — pre-mainnet API handoff (still valid; only env values change).
- `docs/handoffs/p4-charles.md` — pre-mainnet data handoff (still valid; pubkeys above replace the testnet ones).
- `internstellar-contract/scripts/deploy-mainnet.sh` — the script described above.
- `lib/stellar/network.ts` — env-driven network resolver.
- `internstellar-contract/contracts/internstellar/src/lib.rs` — unchanged contract source.
