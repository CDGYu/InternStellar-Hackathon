# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

InternStellar is a 7-day hackathon project: a smart remittance escrow platform for OFWs
(Overseas Filipino Workers) and their families, built on Stellar & Soroban. An OFW funds
an on-chain split (e.g. groceries / medicine / savings); the family builds a wishlist from
a local store's inventory; on approval the funds lock in escrow; the store delivers; the
family confirms; the escrow releases.

This repo currently contains **only the P4 (data + integration) slice**: the Supabase
database layer. There is no `package.json`, no Next.js app, and no contract code yet —
those belong to teammates P1/P2/P3 and are expected to land in (or alongside) this repo.
`InternStellar-P4-FieldGuide.md` is the day-by-day plan and is the source of truth for
what gets built when.

## Database setup

The SQL files in `db/` must run in this exact order — each depends on the previous:

```
db/schema.sql  ->  db/policies.sql  ->  db/realtime.sql  ->  db/seed.sql
```

Run them in the Supabase SQL editor (they run privileged, so RLS does not block seeding).
`policies.sql`, `realtime.sql`, and `seed.sql` are all idempotent and safe to re-run.

The schema is **LOCKED** as of Day 2 — it was walked through with P2 (API routes) and P3
(UI). Any schema change now breaks downstream code and requires a team sync first.

## Realtime test

`scripts/test-realtime.ts` verifies Supabase Realtime broadcasts `wishlist` changes to an
anon-key client (the path P3's Store dashboard uses). No `package.json` exists yet, so run
it from inside the Next.js repo once that exists, or install deps ad hoc:

```
npm i -D tsx && npm i @supabase/supabase-js dotenv
npx tsx scripts/test-realtime.ts
```

It needs a `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
and `SUPABASE_SERVICE_ROLE_KEY`. Exit 0 = pass, exit 1 = fail.

## Environment

Copy `.env.example` to `.env.local` and fill in real values. `.env.local` is gitignored;
`.env.example` is committed and must stay placeholders-only. The `service_role` key bypasses
RLS — it is server-side only, must never be prefixed `NEXT_PUBLIC_`, and must never be
committed.

### Supabase Auth Site URL

Email confirmation links use Supabase's **Site URL** as the prefix
(see `app/auth/confirm/route.ts`). For each deploy environment:

- Local dev: Site URL = `http://localhost:3000`
- Production: Site URL = the Vercel production domain (e.g. `https://internstellar-eight.vercel.app`)

Set this in Supabase Studio → Authentication → URL Configuration. Also
add both `https://<production>/**` and `http://localhost:3000/**` to the
**Redirect URLs** allow-list there so preview deploys + local dev can
each receive the email's verify redirect.

`app/auth/actions.ts` also passes `emailRedirectTo: ${requestOrigin}/auth/confirm`
on signup so password-reset and any future default-template flows
follow whichever deploy host the user signed up from.

## Key conventions

- **Money is always stroops, always `bigint` integers.** 1 XLM = 10,000,000 stroops.
  Never store or pass XLM as a float. DB and API use stroops; convert to XLM only at the
  UI boundary, formatted to ≤4 decimals with the "XLM" unit visible.
- Postgres: `snake_case` columns, **singular** table names (`wishlist`, `wishlist_item`).
- Transaction hashes are stored as `text` (64 hex chars).

## Data model

Five tables (`db/schema.sql`):

- `profiles` — extends `auth.users` with a `role` of `ofw` / `family` / `store`.
- `inventory` — a store's stock; `price_stroops`, `stock`.
- `wishlist` — a family's order; has the status state machine below.
- `wishlist_item` — line items; snapshots `price_stroops_at_add` so it doesn't drift if
  inventory price changes.
- `settlement` — append-only audit trail of on-chain events (`deposit` / `lock` / `release`).

### Wishlist status state machine

```
draft -> pending_approval -> locked -> delivered -> released   (terminal)
  |
  +-> cancelled
```

`locked` is set when `lock_escrow` fires on the contract; `released` when `release_escrow`
fires. P2's API routes write `settlement` rows and update `wishlist` status — and only
*after* the contract call succeeds (writing on a failed call logs fake events).

## RLS — current state vs. Day 4-5 plan

`db/policies.sql` enables RLS on every table. Right now:

- READ policies are tightened "just enough" — a family sees only its own wishlists; the
  store sees all of them (single-store demo).
- WRITE policies are wide-open `dev_write_*` (`FOR ALL`) policies so the build isn't
  blocked. These are **temporary**: on Day 4-5 every `dev_write_*` policy must be dropped
  and replaced with narrow per-role write policies. If all writes instead go through P2's
  server-side routes using the `service_role` key, the `dev_write_*` policies can simply
  be dropped (that key bypasses RLS).

## Realtime

`db/realtime.sql` adds `wishlist` and `wishlist_item` to the `supabase_realtime`
publication and sets `replica identity full` on them (so UPDATE/DELETE broadcasts ship the
whole row, not just the PK). A change is broadcast **only** if its table is in that
publication. Do this via this SQL file *or* the dashboard toggle — never both.

## Demo seed data

`db/seed.sql` creates 3 demo users (password `demo123456` for all): `maria.ofw@`,
`cora.family@`, `nena.store@` (`@internstellar.demo`), with fixed UUIDs `1111…`, `2222…`,
`3333…` respectively. Those UUIDs are referenced from other code (e.g. `test-realtime.ts`
uses `2222…` as the family id) — keep them stable. If `crypt()`/`gen_salt()` error, create
the users via the dashboard instead but keep the same UUIDs.
