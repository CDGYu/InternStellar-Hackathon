# Chain Bridge Bootstrap — Design Spec

- **Date:** 2026-05-19
- **Owner:** Person 2 (Rene) — Chain Integration + Backup Contract
- **Branch target:** `Rene` (synced with `origin/main`)
- **Repo:** `CDGYu/InternStellar-Hackathon`

## 1. Goal

Stand up a self-contained, runnable foundation for Person 2's chain-integration
work, layered on top of Charles's existing `lib/supabase.ts`. After this work is
merged, the following must be true:

1. `npm install && npm run dev` boots a Next.js app at the repo root with no
   errors.
2. A one-shot script generates a Stellar testnet keypair, funds it via
   Friendbot, and prints the keys for the operator to copy into `.env.local`.
3. A repeatable verification script connects to Horizon testnet through the
   shared Stellar client and prints a recent ledger sequence as proof of
   connectivity.

## 2. Non-Goals

The following are explicitly **out of scope** for this spec and will be handled
in subsequent specs / by other team members:

- Freighter wallet UI integration.
- Next.js API routes that invoke the Soroban contract.
- Supabase reads/writes from the Next.js app.
- Frontend wiring of contract responses (Person 3's surface).
- The Rust/Soroban contract itself (Person 1).
- CI workflows, deploy targets, branch protection rules.
- Automatic writes to `.env.local` from any script.

## 3. Constraints

Carried over from team agreements:

- **One Soroban contract** for the project (not multiple).
- **Supabase** is the database (NOT Firebase).
- **No bundle bloat:** only `@stellar/stellar-sdk` is added in this phase. Do
  NOT install `dotenv`, `axios`, `firebase`, or any other package. `tsx` is
  invoked via `npx`, not added as a dependency.
- **Per-person branches** are the team's working convention. PRs flow from a
  developer's branch → `main`.

## 4. Architecture

Resulting repo layout (deltas from current `main` — files marked `[main]`
already exist there and are left untouched, except `.gitignore` which gets
one new line):

```
InternStellar-Hackathon/
├── .env.local                        # gitignored — operator-managed secrets
├── .env.example                      # [main] Charles owns; NOT touched
├── .gitignore                        # [main] + add `.env*.local` (commit B)
├── README.md                         # [main] NOT touched
├── db/                               # [main] schema/policies/seed; NOT touched
├── next.config.mjs                   # Next.js scaffold (commit B)
├── package.json                      # adds @stellar/stellar-sdk (commits B+C)
├── tsconfig.json                     # Next.js TS scaffold (commit B)
├── app/
│   ├── layout.tsx                    # commit B
│   └── page.tsx                      # commit B — placeholder landing page
├── lib/
│   ├── supabase.ts                   # [main] Charles owns; NOT modified
│   └── stellar/
│       ├── client.ts                 # Horizon Server factory (commit D)
│       └── network.ts                # network passphrase + name constants
├── scripts/
│   ├── fund-test-account.ts          # one-shot Friendbot (commit E)
│   └── verify-stellar-connection.ts  # smoke test against Horizon (commit E)
└── docs/
    └── specs/
        └── 2026-05-19-chain-bridge-setup-design.md   # this file (commit A)
```

### 4.1 Component responsibilities

**`lib/stellar/client.ts`**
- Exports a single `getHorizonServer()` factory.
- Reads `STELLAR_HORIZON_URL` (server-side var, per Charles's `.env.example` on `main`) from the environment.
- Throws synchronously if the env var is missing — no fallback to mainnet.
- Returns a configured `Horizon.Server` instance.

**`lib/stellar/network.ts`**
- Exports `STELLAR_NETWORK` (string, e.g. `"testnet"`).
- Exports `NETWORK_PASSPHRASE` (the constant from `Networks.TESTNET`).
- Used by future contract-call code to sign transactions.

**`scripts/fund-test-account.ts`**
- Standalone Node script, invoked via `npx tsx`.
- Generates a fresh `Keypair` locally.
- Calls `https://friendbot.stellar.org?addr=<public>`.
- On success: prints public + secret keys and a copy/paste line for
  `.env.local` (e.g. `STELLAR_DEMO_SECRET_KEY=...`).
- On failure: prints the raw Friendbot response body and exits non-zero.
- **Never writes to `.env.local` automatically.** Operator copies manually.

**`scripts/verify-stellar-connection.ts`**
- Standalone Node script, invoked via `npx tsx`.
- Calls `getHorizonServer().ledgers().order('desc').limit(1).call()`.
- Prints `{ network, horizon, latest_ledger, closed_at }` on success.
- Prints the error and exits non-zero on failure.
- No retries.

## 5. Data flow

### 5.1 One-time setup flow (operator-initiated)

```
operator runs:  npx tsx scripts/fund-test-account.ts
   │
   ├─► Keypair.random()                  (local only)
   ├─► fetch friendbot.stellar.org?addr=<public>
   │     ├─ 200 OK  → print keys + .env.local hint
   │     └─ non-200 → print body, exit 1
   └─► operator pastes STELLAR_DEMO_SECRET_KEY into .env.local
```

### 5.2 Verification flow (repeatable)

```
operator runs:  npx tsx scripts/verify-stellar-connection.ts
   │
   ├─► getHorizonServer()                (reads env)
   ├─► server.ledgers().order('desc').limit(1).call()
   │     ├─ success → print network info + latest ledger
   │     └─ throws  → print error, exit 1
   └─► no state mutation
```

## 6. Error handling

- **Missing env vars:** `getHorizonServer()` and the verify script throw
  immediately with a message naming the missing `STELLAR_HORIZON_URL`. No
  silent fallbacks to mainnet.
- **Friendbot non-2xx:** print the raw response body so operators can
  distinguish rate-limit / already-funded / network error cases.
- **Horizon connection failure:** print the underlying error and exit non-zero.
  No retries — these are diagnostic tools and silent retries would mask real
  problems.
- **Scripts never write `.env.local`:** they only print. A buggy script run
  cannot clobber a working config.

## 7. Trust boundaries

- `.env.local` is gitignored (commit B adds `.env*.local` to `.gitignore`),
  holds the funded testnet secret. Acceptable because it is **testnet-only**
  — no real funds — and never leaves the operator's machine.
- `.env.example` is already committed on `main` by Charles with placeholder
  values only. This phase does not touch that file.
- No secrets flow through Supabase or any external system in this phase.

## 8. Environment variables

Required in `.env.local` for scripts (server-side). Names match Charles's
existing `.env.example` on `main`:

```
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
STELLAR_DEMO_SECRET_KEY=<filled in by operator after running fund script>
```

All Stellar vars are **server-side only** (no `NEXT_PUBLIC_` prefix). The
Horizon URL is public information but kept server-side because all chain calls
in this phase run from Node scripts or future API routes — none from the
browser.

## 9. Branching & commit plan

1. Restore the locally-deleted `README.md` on `Rene`:
   `git checkout -- README.md`.
2. Fetch and merge: `git fetch origin && git merge origin/main`. On conflict,
   stop and surface to operator — do not auto-resolve.
3. Commit work in focused, independently-reviewable units on `Rene`:
   - **A** — `docs: add chain bridge bootstrap design spec`
     (this file, committed first so subsequent commits reference it)
   - **B** — `chore: scaffold Next.js at repo root + gitignore .env*.local`
     (folds in the gitignore fix because Charles's modification to `main`
     dropped the `.env*` line, leaving `.env.local` un-ignored)
   - **C** — `chore(stellar): install @stellar/stellar-sdk`
   - **D** — `feat(stellar): add Horizon client + network constants`
   - **E** — `feat(scripts): add fund-test-account + verify-stellar-connection`
4. `git push origin Rene`.
5. Operator opens PR `Rene → main` when ready (not automated).

Charles already committed `.env.example` to `main` after this spec was first
drafted — so the original commit F (add `.env.example`) is dropped. The
`.gitignore` fix that was bundled with F is folded into commit B.

## 10. Verification gate

The work is "done" only when **all** of the following are green and shown to
the operator:

1. `.env.local` exists at repo root with both `NEXT_PUBLIC_*` vars set.
2. `npm run dev` boots without errors (verified by starting in background,
   reading first ~30 lines of output, then stopping).
3. `npx tsx scripts/verify-stellar-connection.ts` prints a recent testnet
   ledger sequence.
4. `git status` is clean.
5. `git log --oneline` shows the 5 commits above (A–E) on top of the
   fast-forwarded `origin/main` baseline. (Local `Rene` was already behind
   `origin/main` before the sync, so the merge was a fast-forward — no
   dedicated merge commit was produced.)

Items 1–5 must be demonstrated with command output. Self-reported success
without output is not acceptable.

## 11. Explicit non-actions

While executing the implementation plan, the agent will NOT:

- Run `scripts/fund-test-account.ts` (operator runs it; it produces a secret
  that the operator must handle).
- Push to `main`.
- Open or merge the PR.
- Modify `lib/supabase.ts`.
- Install any npm package other than `@stellar/stellar-sdk`.
- Set up CI, deploy targets, or branch protection.

## 12. Open questions (none blocking)

- Long-term home of `STELLAR_DEMO_SECRET_KEY` for the team (1Password? shared
  Supabase row?) is out of scope here.
- Whether to add a `lib/stellar/index.ts` barrel export will be decided
  during implementation, based on import ergonomics.
