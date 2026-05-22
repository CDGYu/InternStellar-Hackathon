# Vercel Env — Flip to Mainnet (Step-by-Step)

Last updated: 2026-05-22 11:25 +0800. Audience: whoever owns the InternStellar Vercel project. Reading time: ~5 min. Execution time: ~10 min including a redeploy.

This is the **operator runbook** for switching the deployed Next.js app from testnet to the mainnet contract. Code is already env-driven — you only edit Vercel environment variables and trigger a redeploy. No git push required from you.

---

## What you'll change

Six environment variables in the Vercel project, plus one redeploy. Three of the six are **new** values (network label + passphrase + RPC URL changes); three are **same name, different value** (Horizon URL, contract id, and optionally the demo secret).

> Do this on the **Production** environment scope, then on **Preview** if your team also wants `vercel.app` preview deployments to point at mainnet. Leave **Development** on testnet so `vercel dev` and local previews stay safe.

---

## Before you start

You need these in front of you (do not paste secrets in chat/Discord):

| Item | Value | Where it comes from |
|------|-------|---------------------|
| Mainnet contract id | `CCSK35NQQR46C7ULBEGL6FG7JJ7XPLR427ZN5HHN2FLBXTZNKT57GKRW` | Output of the mainnet deploy smoke |
| Organizer pubkey | `GBASZKU4ICS7Z2PN6NXWRYRVNIWEA52ERD4YDQ6YAYQSLEJWGEOY5RCI` | Hackathon-funded wallet |
| Organizer secret (`S…`) | *only paste into Vercel form, nowhere else* | The same wallet's secret |

If you don't yet have the mainnet contract id, run the deploy script first (see `docs/handoffs/mainnet-deploy.md` § "Reproducing the deploy") and come back when it prints `NEXT_PUBLIC_CONTRACT_ID=C...`.

---

## Step 1 — Open the Vercel env editor

1. Go to <https://vercel.com/dashboard>.
2. Click the **InternStellar** project (name may differ — pick the one currently serving the live URL).
3. Top nav: **Settings** → left sidebar: **Environment Variables**.
4. You'll see a list of existing testnet vars. Leave them alone for now; you'll **edit in place** rather than add duplicates.

---

## Step 2 — Edit the six variables (Production scope)

For each row below: click the **⋯** menu on the right of the existing var, choose **Edit**, paste the new value, leave the environment scopes checked as **Production** (and **Preview** if you want the preview URL to go to mainnet too), then **Save**. Do not check **Development** — local dev stays on testnet.

If a row doesn't exist yet, click **Add New** and use the variable name from the **Variable** column.

| # | Variable | New value | Scope |
|---|----------|-----------|-------|
| 1 | `STELLAR_NETWORK` | `public` | Production (+ Preview) |
| 2 | `STELLAR_NETWORK_PASSPHRASE` | `Public Global Stellar Network ; September 2015` | Production (+ Preview) |
| 3 | `STELLAR_RPC_URL` | `https://soroban-rpc.mainnet.stellar.gateway.fm` | Production (+ Preview) |
| 4 | `STELLAR_HORIZON_URL` | `https://horizon.stellar.org` | Production (+ Preview) |
| 5 | `NEXT_PUBLIC_CONTRACT_ID` | `CCSK35NQQR46C7ULBEGL6FG7JJ7XPLR427ZN5HHN2FLBXTZNKT57GKRW` | Production (+ Preview) |
| 6 | `STELLAR_DEMO_SECRET_KEY` | *(organizer `S…` secret)* | Production (+ Preview) — **Sensitive** |

### Variable-by-variable notes

**1. `STELLAR_NETWORK`** — The label `lib/stellar/network.ts` reads. Accepts `public` or `mainnet` (case-insensitive). Anything else falls back to testnet, which is why we type the value carefully.

**2. `STELLAR_NETWORK_PASSPHRASE`** — Exact string the Stellar SDK uses to sign mainnet transactions. Copy it verbatim, including the spaces around `;`. A wrong passphrase causes every signed tx to be rejected by the network with a confusing "bad signature" error.

**3. `STELLAR_RPC_URL`** — Public Soroban RPC endpoint. `https://soroban-rpc.mainnet.stellar.gateway.fm` completed the lock/release smoke path after `https://mainnet.sorobanrpc.com` timed out on `lock_escrow`, so use the Gateway endpoint for Vercel.

**4. `STELLAR_HORIZON_URL`** — Classic Horizon endpoint. Used by `lib/stellar/bills.ts` for real XLM transfers and by `scripts/reset-demo.ts`.

**5. `NEXT_PUBLIC_CONTRACT_ID`** — The mainnet contract. **Important:** it has the `NEXT_PUBLIC_` prefix because the browser-side UI reads it for the "view contract on explorer" links. The secret never has that prefix.

**6. `STELLAR_DEMO_SECRET_KEY`** — Server-side only. Vercel will mark it **Sensitive** automatically once it sees the `_SECRET_` pattern (verify the lock icon appears after save). It is **never** sent to the browser; only Next.js API routes read it.

> If the existing testnet secret in Vercel is from the team's testnet signer, **replace** it with the organizer's mainnet secret. Don't try to keep both — `loadConfig()` in `lib/stellar/contract.ts` reads exactly one secret per process.

---

## Step 3 — Trigger a redeploy

Env var edits do **not** automatically redeploy on Vercel. You have to ship a fresh build.

1. Top nav: **Deployments**.
2. Click the most recent successful production deployment (top of the list).
3. **⋯** menu → **Redeploy**.
4. In the modal, **uncheck** "Use existing Build Cache" so the new env vars are baked into the bundle (important for `NEXT_PUBLIC_CONTRACT_ID`, which is inlined at build time).
5. Click **Redeploy**.

Build usually takes 1–3 minutes. When it goes **Ready**, the production URL is on mainnet.

---

## Step 4 — Verify after the redeploy

Run these three checks. Each one takes <30 seconds.

### 4a. `/api/health` reports mainnet config

```bash
curl -sS https://<your-prod-domain>/api/health | jq
```

Expect (shape may vary slightly with your route's current implementation):

```json
{
  "ok": true,
  "stellar": {
    "network": "public",
    "contract_id": "CCSK35NQQR46C7ULBEGL6FG7JJ7XPLR427ZN5HHN2FLBXTZNKT57GKRW",
    "demo_secret_configured": true
  }
}
```

If `network` still says `testnet`, the redeploy didn't pick up the new `STELLAR_NETWORK`. Confirm you redeployed without build cache.

### 4b. UI explorer links point at mainnet

Open the production URL in a browser. Navigate to any page with a transaction link (OFW transaction history is easiest). The link should be `https://stellar.expert/explorer/public/...`, not `.../explorer/testnet/...`.

If links are still `testnet`, P3's explorer-URL PR (see `docs/handoffs/mainnet-deploy.md` § P3) hasn't shipped — flag in #frontend.

### 4c. One real lock + release on mainnet

This is the gate that proves end-to-end. Sign in as the demo family, approve a small wishlist (~0.0005 XLM total), watch:

- `/api/escrow/lock` returns a tx hash that resolves on `https://stellar.expert/explorer/public/tx/<hash>`.
- The hash's contract events page shows an `esc_lock` event with `(family, store, escrow_id, amount)`.
- After the store marks delivered + family confirms, an `esc_rel` event appears.
- `get_balances(store)` (via the Store dashboard) shows the credited amount.

The organizer wallet balance should drop by **fees only** (~10 stroops per invoke) — the lock amount stays inside the contract as bucket numbers, not transferred XLM. That is Option A working as designed.

---

## Step 5 — Lock the change in

1. **Post the new contract id** to the team channel so P4 (Charles) can update Supabase profiles per `docs/handoffs/mainnet-deploy.md` § P4.
2. **Tag the production deployment** in Vercel: top of the deployment, click **Promote to Production** if it's not already, and rename the build tag to `mainnet-demo-v1` (Settings → General → Build Tag) so a future rollback can find it by name.

---

## Rollback (if something breaks on stage)

You can revert to testnet in **under 3 minutes** without a code deploy:

1. Settings → Environment Variables. Restore these six vars to the testnet block:

   | Variable | Testnet value |
   |----------|---------------|
   | `STELLAR_NETWORK` | `testnet` |
   | `STELLAR_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |
   | `STELLAR_RPC_URL` | `https://soroban-testnet.stellar.org` |
   | `STELLAR_HORIZON_URL` | `https://horizon-testnet.stellar.org` |
   | `NEXT_PUBLIC_CONTRACT_ID` | `CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF` |
   | `STELLAR_DEMO_SECRET_KEY` | the testnet signer's secret (from the team's password manager) |

2. Deployments → most recent **prior** deployment (before the mainnet redeploy) → **⋯** → **Promote to Production**.

   This skips the rebuild and instantly re-routes traffic to the old (testnet) bundle.

3. Refresh the production URL and confirm `/api/health` shows `network: "testnet"`.

If you tagged the prior deployment as `testnet-rehearsal-v1` per Step 5, you can also use Vercel's instant rollback shortcut.

---

## Common pitfalls

| Symptom | Cause | Fix |
|---------|-------|-----|
| `network: "testnet"` in `/api/health` after redeploy | Redeploy used build cache | Redeploy again with **Use existing Build Cache** unchecked |
| Explorer links still say `/testnet/` | Hardcoded strings in `app/(app)/**/*.tsx` not yet migrated to `STELLAR_EXPLORER_BASE` | Ship P3's PR or accept the visual mismatch for the demo |
| `/api/deposit` returns `contract_not_configured` | `NEXT_PUBLIC_CONTRACT_ID` or `STELLAR_DEMO_SECRET_KEY` missing/typo | Re-check the values, redeploy with cache off |
| Mainnet tx fails with `tx_bad_seq` | RPC out of sync with Horizon | Wait 30s and retry, or swap `STELLAR_RPC_URL` to a different provider |
| Lock tx panics with `family cannot be store` | Supabase store row has the same pubkey as the family | P4 must update store's `stellar_public_key` to the distinct mainnet pubkey (see deploy doc § P4) |
| Organizer balance running low mid-demo | Real fees, no Friendbot on mainnet | Top up the organizer wallet before continuing |

---

## Quick reference — every var, every scope

| Variable | Production (mainnet demo) | Development (local) |
|----------|---------------------------|---------------------|
| `STELLAR_NETWORK` | `public` | `testnet` |
| `STELLAR_NETWORK_PASSPHRASE` | `Public Global Stellar Network ; September 2015` | `Test SDF Network ; September 2015` |
| `STELLAR_RPC_URL` | `https://soroban-rpc.mainnet.stellar.gateway.fm` | `https://soroban-testnet.stellar.org` |
| `STELLAR_HORIZON_URL` | `https://horizon.stellar.org` | `https://horizon-testnet.stellar.org` |
| `NEXT_PUBLIC_CONTRACT_ID` | `CCSK35NQQR46C7ULBEGL6FG7JJ7XPLR427ZN5HHN2FLBXTZNKT57GKRW` | `CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF` |
| `STELLAR_DEMO_SECRET_KEY` | organizer mainnet secret | testnet signer secret (from password manager) |
| `NEXT_PUBLIC_SUPABASE_URL` | unchanged | unchanged |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | unchanged | unchanged |
| `SUPABASE_SERVICE_ROLE_KEY` | unchanged | unchanged |

Supabase vars are **identical** across environments. The DB is shared; only the on-chain target changes.

---

## What this doc does *not* cover

- Adding a new Vercel project from scratch (assumes the InternStellar project already exists and serves a working testnet build).
- Custom domains, DNS, or SSL.
- Vercel Postgres / KV — not used in this project (Supabase is the DB).

For deeper architectural context, see `docs/handoffs/mainnet-deploy.md`.
