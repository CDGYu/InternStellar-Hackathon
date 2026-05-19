# InternStellar — P4 Field Guide
### Data + Integration Glue + PM · 7-Day Hackathon

---

## What "P4" actually means on this team

You are the team's **connective tissue**. You don't own the contract (P1 does), you don't own the chain integration (P2 does), and you don't own the visual UI (P3 does). What you own is everything that makes those three pieces behave like one product:

1. **Data** — the Supabase project, schema, row-level security (RLS), realtime channels, and seed data. Every UI screen and every API route reads from or writes to something you set up.
2. **Integration glue** — the boring but lethal middle layer. When P3's "Mark delivered" button needs to both call P2's API *and* decrement inventory in Supabase *and* push a realtime update to the Store dashboard, that wiring is yours.
3. **Project management** — ClickUp, daily integration sync, scope discipline, demo data hygiene, pitch deck, README, submission. You are the person who notices on Day 4 that two teammates are building incompatible things and forces a 10-minute call.

The Day 0 mantra applies hardest to you: **Protect the Golden Path.** P1 has the scariest single task (Rust toolchain). You have the most *surface area*. If anything falls between the cracks, it falls on yours.

---

## How to read this guide

Each day has four parts:

- **Outcome** — what must be true at end of day. If this isn't true, the day failed.
- **Tasks** — the concrete to-do list, in order.
- **Watch out for** — the failure modes I've seen kill hackathons.
- **Hand-offs** — what you owe other people, and what they owe you.

Tasks are written in the order you should do them. Don't reorder unless something is blocking you and you're switching to unblock it.

---

# DAY 1 — Foundations

## Outcome
Supabase project exists with a real (not draft) schema. ClickUp board mirrors the 7-day plan. A one-paragraph pitch is written down somewhere everyone can see. Other teammates are unblocked on the data side.

## Tasks

### 1. Create the Supabase project (first 30 minutes)
1. Sign up at supabase.com, create a new project. Pick the region closest to Manila (Singapore is the usual choice).
2. Save the project URL and the `anon` public key somewhere the team can access (shared password manager, a pinned message, a `.env.example` in the repo). Do **not** paste the `service_role` key into chat or commit it.
3. Add P1, P2, P3 as collaborators on the project so they can see the dashboard.
4. Decide on table naming convention now and stick to it. Recommendation: `snake_case`, singular table names (`profile`, `wishlist_item`) — or plural if the team prefers (`profiles`, `wishlist_items`). Pick one and write it down.

### 2. Draft the schema (next 1–2 hours)
You need five tables minimum. Draft them on paper or in a doc first, then create in Supabase.

**`profiles`** — extends Supabase auth users with role info.
- `id` (uuid, references `auth.users.id`, primary key)
- `role` (text, one of: `ofw`, `family`, `store`)
- `display_name` (text)
- `stellar_public_key` (text, nullable for now)
- `created_at` (timestamptz, default `now()`)

**`inventory`** — what the store has in stock.
- `id` (uuid, primary key, default `gen_random_uuid()`)
- `store_id` (uuid, references `profiles.id`)
- `name` (text) — e.g., "Rice 5kg"
- `category` (text) — e.g., "grocery", "medicine"
- `price_stroops` (bigint) — store everything in stroops (integers), never floats
- `stock` (int)
- `image_url` (text, nullable)
- `created_at` (timestamptz, default `now()`)

**`wishlist`** — a family's pending order.
- `id` (uuid, primary key)
- `family_id` (uuid, references `profiles.id`)
- `status` (text, one of: `draft`, `pending_approval`, `locked`, `delivered`, `released`, `cancelled`)
- `total_stroops` (bigint)
- `escrow_tx_hash` (text, nullable) — filled in when escrow locks
- `release_tx_hash` (text, nullable) — filled in when funds release
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, default `now()`)

**`wishlist_item`** — line items on a wishlist.
- `id` (uuid, primary key)
- `wishlist_id` (uuid, references `wishlist.id`, on delete cascade)
- `inventory_id` (uuid, references `inventory.id`)
- `quantity` (int)
- `price_stroops_at_add` (bigint) — snapshot the price at add-time so it doesn't drift if inventory price changes

**`settlement`** — the audit trail of contract events.
- `id` (uuid, primary key)
- `wishlist_id` (uuid, references `wishlist.id`)
- `event_type` (text, one of: `deposit`, `lock`, `release`)
- `tx_hash` (text)
- `amount_stroops` (bigint)
- `created_at` (timestamptz, default `now()`)

Use `bigint` for stroops because 1 XLM = 10,000,000 stroops and `int4` will overflow on realistic balances. Use `text` for tx hashes (they're 64 hex chars).

### 3. Enable Row-Level Security (RLS)
Do this **today**, not later. Adding RLS retroactively breaks everything because policies block reads your existing code depends on. Easier rule: enable RLS on every table from the start, write permissive policies you tighten later.

For Day 1, write one read-everything policy per table just to unblock development:
```sql
alter table profiles enable row level security;
create policy "read_all_profiles" on profiles for select using (true);
```
Repeat for every table. You'll tighten these on Day 4–5.

### 4. Seed the demo data
You need at minimum:
- 1 OFW user (Auntie Maria, in Dubai)
- 1 Family user (her sister Lola Cora, in Quezon City)
- 1 Store user (Aling Nena's Sari-Sari)
- 6–10 inventory items at the store: rice, canned goods, instant noodles, cooking oil, paracetamol, a couple of vitamins. Mix grocery and medicine so the 3-category split makes sense in the demo.

Create these via the Supabase dashboard (Auth → Users) or via a `seed.sql` script. A script is better because P4 (you) will rerun it many times. See Day 5 for the reset-script task — start the script today, even if it's basic.

Use sensible-looking stroop prices: a 5kg rice bag at maybe 3,500,000 stroops (0.35 XLM) so the demo numbers look reasonable, not 0.0000001 XLM.

### 5. Set up ClickUp
Mirror the 7-day plan. One list per day. Each task in the plan becomes a card. Assign owners. Don't over-detail — this is a tracker, not a Gantt chart.

Quick structure:
- List: "Day 1 — Foundations"
  - Card: "P1: Hello-world Soroban contract deployed"
  - Card: "P2: Next.js repo + Friendbot funding works"
  - Card: "P3: 3 role-view shells with role switcher"
  - Card: "P4: Supabase schema + RLS + seed + ClickUp + pitch paragraph"
- (repeat for days 2–7)

### 6. Write the one-paragraph pitch
You will rewrite this five times before Day 7. That's fine. Get a v1 down today so the team has a shared answer to "what are we building?"

Template to fill in:
> InternStellar is a Stellar-based remittance app for OFWs (Overseas Filipino Workers) and their families back home. Instead of sending one big lump sum that gets spent on the wrong things, an OFW sets a percentage split — say 50% groceries, 30% medicine, 20% savings — and the funds land in three on-chain sub-balances. The family browses a local sari-sari store's inventory, builds a wishlist, and when the OFW approves, the grocery balance is locked in escrow. The store delivers, the family confirms, the escrow releases, and everyone sees the receipt on-chain. We replace a system built on trust and prayer with one built on programmable money.

Tweak for voice, but keep the "lump sum → split → escrow → release" arc. That arc is the pitch.

## Watch out for
- **Don't skip RLS today.** Adding it Day 4 will break working code and eat 3 hours.
- **Don't over-engineer the schema.** Five tables, no fancy normalisation, no audit tables, no soft-deletes. You can always add columns; you can't always remove them safely.
- **Don't seed real-looking PII.** Use obvious-fake names. "Auntie Maria Dela Cruz," not someone's actual relative.

## Hand-offs
- **You owe P2** by end of day: the Supabase URL + anon key in the repo's `.env.example` so they can wire the Next.js client.
- **You owe P3** by end of day: the schema diagram (even a screenshot of the Supabase table editor is fine) so they know what fields exist for the UI.
- **P2 owes you** the GitHub repo URL so you can commit `seed.sql` and the pitch doc.

---

# DAY 2 — Schema Lock + Seed Solid

## Outcome
Schema is finalised (no more changes after today without a team conversation). RLS policies exist on every table. Seed data is deterministic — same script, same data, every time. OFW view can read inventory through Supabase.

## Tasks

### 1. Finalise the schema
Walk through the schema with P3 (UI knows what fields it needs) and P2 (API routes know what tables they read/write). Anything you forgot? Add it now. After today, schema changes require a sync call — they break everyone.

Common additions you might have missed:
- `wishlist.notes` (text, nullable) — the family adds a message like "Lola needs her maintenance meds"
- `inventory.unit` (text) — "5kg", "12 pcs", "30 tabs"
- `profiles.country` (text) — for the OFW location, just for demo flavour

### 2. Tighten RLS policies (just enough)
Don't go full production-grade. Just enough that the demo doesn't accidentally show one family's wishlist to another. Sample policies:

```sql
-- A family only sees their own wishlists
create policy "family_reads_own_wishlist" on wishlist
  for select using (auth.uid() = family_id);

-- A store sees wishlists targeting their inventory
-- (For demo, you can keep this permissive: select using (true))

-- Anyone authenticated can read inventory
create policy "auth_reads_inventory" on inventory
  for select using (auth.role() = 'authenticated');
```

You don't need perfect policies. You need policies that don't block the demo and don't leak between roles. If in doubt, leave the policy permissive and tighten on Day 5.

### 3. Make the seed script idempotent
The seed script should be runnable many times without breaking. Two ways:

**Option A (simpler):** Truncate then insert.
```sql
truncate wishlist_item, wishlist, settlement, inventory, profiles cascade;
-- then your inserts
```

**Option B (safer):** `insert ... on conflict do nothing`. Use fixed UUIDs for seed rows so conflicts can resolve.

Pick A. It's a hackathon, not a bank. Speed of iteration matters more than transactional purity. Save the file as `db/seed.sql` in the repo.

### 4. Add Supabase realtime to the wishlist table
Enable realtime on the `wishlist` and `wishlist_item` tables (Supabase dashboard → Database → Replication → toggle for those tables). P3 will use this on Day 3 to make the Store dashboard live-update when a family submits a wishlist.

Test the realtime subscription works using the Supabase JS client in a throwaway script before you hand it to P3. If it doesn't, you'd rather find out today than tomorrow.

### 5. Help P3 wire the OFW view to inventory (if asked)
P3 is building OFW allocation sliders today, not the family inventory browser, so they may not need this yet. But if P3 has time and wants to start the family browser, give them a quick snippet for reading inventory:

```typescript
const { data, error } = await supabase
  .from('inventory')
  .select('*')
  .order('category');
```

### 6. Daily integration sync (15 min, end of day)
You run this every day starting today. The format:
- P1: contract status. Deployed? What functions work?
- P2: chain integration status. What API routes exist? What do they return?
- P3: UI status. What screens exist? What do they call?
- P4: data status. Any schema changes? Anything blocked?
- Round-table: "Is anyone blocked by anyone else?" Five-minute rule — if a block can be cleared in 5 minutes, clear it now, not tomorrow.

Write a one-line summary in ClickUp or the team chat. End of day. Done. Do not let this become a 45-minute meeting.

## Watch out for
- **Schema thrash.** If you find yourself changing the schema 3+ times today, stop and talk to P2 and P3 — there's a misunderstanding somewhere about what the app does.
- **Stroops vs XLM confusion.** Pick stroops (integers) everywhere in the DB. Never store XLM as a float. Mention this loudly in the team chat today so P2 doesn't introduce floats in API responses.
- **Realtime gotcha.** Supabase realtime requires the table to be added to the `supabase_realtime` publication. The dashboard toggle does this; if you do it via SQL, don't forget the publication step.

## Hand-offs
- **You owe P3** working realtime on `wishlist` (they'll consume on Day 3).
- **You owe P2** the finalised schema (they may need new columns for API responses today).

---

# DAY 3 — Wire Realtime + Start Pitch Deck

## Outcome
The Store view updates live when a family submits a wishlist (you don't build the UI, P3 does — but the data flow underneath is yours). Wishlist and settlement tables behave correctly. Pitch deck outline exists.

## Tasks

### 1. Wishlist status state machine (write it down)
The `wishlist.status` field drives a lot of UI. Write down the valid transitions so nobody (especially you, at 2am Day 5) gets confused:

```
draft ──► pending_approval ──► locked ──► delivered ──► released
   │                                                      ▲
   └──► cancelled                                         │
                                                          (terminal)
```

Rules:
- A family creates a wishlist in `draft`.
- "Request approval" moves it to `pending_approval`.
- OFW approval (or in the demo path: a button on the wishlist) triggers `lock_escrow` on the contract and moves status to `locked`.
- Store marks delivered → status `delivered`.
- Family confirms → triggers `release_escrow` → status `released`.

Put this in the README under "App States" so the team can refer to it.

### 2. Help P2 design the settlement-writing flow
When P2's API routes call the contract and get a tx hash back, they need to write to `settlement`. Agree on the pattern: does P2 write directly to Supabase, or does P4 expose a helper? For a 4-person team in a hackathon, **P2 writes directly** — fewer hops. Just make sure P2 knows the table shape and the expected `event_type` values.

Example call P2 should make after a successful `lock_escrow`:
```typescript
await supabase.from('settlement').insert({
  wishlist_id: wishlistId,
  event_type: 'lock',
  tx_hash: contractResponse.txHash,
  amount_stroops: lockedAmount,
});

await supabase
  .from('wishlist')
  .update({ status: 'locked', escrow_tx_hash: contractResponse.txHash })
  .eq('id', wishlistId);
```

### 3. Wire realtime properly for the Store view
P3 will subscribe to `wishlist` changes filtered by `status = 'pending_approval'` (incoming orders) and `status = 'locked'` (orders ready to deliver). Confirm this filter works in a quick test. Supabase realtime filters look like:

```typescript
supabase
  .channel('store-orders')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'wishlist', filter: 'status=in.(pending_approval,locked)' },
    (payload) => { /* update UI */ }
  )
  .subscribe();
```

Note: Supabase realtime filters support equality and `in.(...)` but not arbitrary SQL. If a filter doesn't work, fall back to subscribing to all changes and filtering client-side. For demo scale (one store, one family) this is fine.

### 4. Pitch deck outline
Start a Google Slides or Pitch deck. Skeleton:

1. **Title slide** — InternStellar, team name, one tagline.
2. **The problem** — OFW remittance is a $36B/year flow into the Philippines (cite worldbank.org). Money lands as a lump sum, no visibility on spend, frequent misuse. Real human story (one sentence, one face).
3. **The insight** — programmable money lets the sender shape *how* funds are used, not just *that* they're sent.
4. **The product** — three screens (OFW, Family, Store). Show, don't tell. Screenshot or mockup per screen.
5. **The demo** — live, or recorded backup. (Don't fill this slide with text; it's a placeholder for the live demo.)
6. **How it works** — one diagram: deposit → split → escrow → release. Stellar logo. Soroban logo.
7. **Why Stellar** — low fees, fast finality, native asset issuance, real-world remittance traction.
8. **What's next** — Freighter signing, real on/off-ramps via Anchors, multi-store marketplace, on-chain credit history for receivers.
9. **The team** — four faces, four roles.
10. **Ask** — what you want from judges/partners. (Mentorship? Pilot? Grant?)

Don't design slides today. Just put the headlines and 1-2 bullet placeholders per slide. P3 (or you) can pretty it up on Day 5–6.

### 5. End-of-day integration sync
Same format as Day 2. Today's likely friction: the chain integration ↔ data write pattern. Make sure P1, P2, and you all agree on who writes `settlement` rows and when. Write the answer in the README so nobody re-litigates it Day 4.

## Watch out for
- **Settlement writes on failed contract calls.** P2's API route must only write to `settlement` *after* the contract call succeeds. Otherwise you log fake events. Easy bug to introduce.
- **Realtime tax.** Don't subscribe to too many channels at once during dev — it slows things down and burns through Supabase free-tier limits. One channel per role view is enough.
- **Pitch perfectionism.** Don't spend 4 hours on the deck today. You're building, not pitching, until Day 6.

## Hand-offs
- **You owe P3** confirmation that realtime fires on wishlist inserts/updates with the right payload shape.
- **You owe P2** a written agreement on who writes `settlement` (answer: P2 does, after successful contract calls).

---

# DAY 4 — Golden Path Closes (the make-or-break day)

## Outcome
The full loop works end-to-end. When the family clicks "Confirm delivery," the on-chain release fires, `settlement` gets a `release` row, the wishlist flips to `released`, inventory decrements, and the Store dashboard updates live. Pitch deck has a first full draft.

This is the day P4's role matters most. If integration breaks, it's because two pieces don't know about each other's shape. That's your beat.

## Tasks

### 1. Wire inventory decrement on release
When the family confirms delivery and the release succeeds, you need to:

1. Update `wishlist.status` to `released` (P2's API route does this, but verify).
2. Insert a `settlement` row with `event_type = 'release'` (P2 does this too).
3. **Decrement inventory** for each `wishlist_item` in the wishlist. This is yours.

Two ways to do the decrement:

**Option A — Supabase RPC (best):**
Write a Postgres function that takes a `wishlist_id` and does the decrement atomically. Then P2's API calls `supabase.rpc('finalize_wishlist', { wishlist_id })` after the contract release succeeds.

```sql
create or replace function finalize_wishlist(p_wishlist_id uuid)
returns void
language plpgsql
as $$
begin
  update inventory i
  set stock = i.stock - wi.quantity
  from wishlist_item wi
  where wi.wishlist_id = p_wishlist_id
    and wi.inventory_id = i.id;
end;
$$;
```

**Option B — client-side loop (simpler, riskier):**
P2 reads `wishlist_item` rows, loops, updates each inventory row. Not atomic. Fine for demo scale.

Pick A. It's not much harder and it teaches you something useful.

### 2. Test the full loop yourself (don't wait for P1)
Do not wait for P1 to test the full loop. Open three browser windows (OFW, Family, Store), step through:

1. OFW logs in → adjusts sliders → deposits → sees 3 sub-balances. ✅
2. Family logs in → sees inventory → builds wishlist → "Request approval." ✅ (Wishlist status: `pending_approval`)
3. OFW (or demo button) approves → `lock_escrow` fires → wishlist status: `locked`. ✅ Store dashboard updates live.
4. Store clicks "Mark delivered" → wishlist status: `delivered`. ✅
5. Family clicks "Confirm delivery" → `release_escrow` fires → wishlist status: `released`. ✅
6. Inventory stock decrements. ✅
7. Receipt card renders with tx hash from `settlement.release`. ✅

Any step that breaks: find the team member who owns it, sit next to them, fix it now. **Not tomorrow.**

### 3. Stellar.expert receipts
The receipt card on P3's UI should link to `stellar.expert` for each tx hash. Pattern:

```
https://stellar.expert/explorer/testnet/tx/<tx_hash>
```

Confirm with P3 that all three tx hashes (deposit, lock, release) from `settlement` are reachable from the receipt UI. Judges *will* click these.

### 4. First full pitch deck draft
Now that the loop works, you know exactly what to put on slide 4 (the product). Real screenshots, not mockups. Take them today while everything's working — Day 5 polish may briefly break things.

### 5. Tag the working commit (with P2)
End of day, when the loop works: P2 tags the commit. `git tag -a golden-path-v1 -m "Full loop works end to end"`. This is your safety net. If Day 5 polish breaks things, you can always roll back to this tag and demo from here.

## Watch out for
- **The "works on my machine" trap.** Your local Next.js dev server is not the same as P2's. If a thing works for you and not for P2, the bug is usually environment (different `.env`, different Supabase project, different Friendbot-funded account). Compare `.env` files first.
- **Realtime not firing.** If the Store dashboard isn't updating, check (a) the table is in the realtime publication, (b) RLS isn't blocking the row from being seen, (c) the channel filter syntax. In that order.
- **Inventory going negative.** If demo runs the loop twice without reseeding, stock goes below zero. Either prevent it in the function (`set stock = greatest(0, i.stock - wi.quantity)`) or just reseed before each demo. Reseed is easier.

## Hand-offs
- **By end of day, you owe everyone** a working `finalize_wishlist` RPC and confirmation it ran successfully at least once.
- **By end of day, P1 owes you** a tagged commit (`golden-path-v1`).

---

# DAY 5 — Harden, Reset Script, Pitch Near-Final

## Outcome
A one-command demo reset script exists and works. Pitch deck is 90% done. RLS policies tightened. You're rehearsing with P1.

## Tasks

### 1. Build the demo reset script
This is the most important thing you do today. You will run the demo many times. Every run consumes inventory, dirties wishlists, creates settlement rows. You need to get back to a clean state in one command.

Two parts:

**Part A — `db/reset.sql`:** truncates and reseeds.
```sql
truncate settlement, wishlist_item, wishlist cascade;
update inventory set stock = 50;  -- or whatever your seed values are
-- if you want to reset everything including users:
-- truncate profiles cascade;
-- then re-run your seed.sql
```

**Part B — a runner script** that anyone on the team can execute. Easiest path: a small Node script in `scripts/reset-demo.ts` that:
1. Runs `reset.sql` against Supabase (using the service-role key from `.env.local`).
2. Optionally re-funds the demo Stellar accounts via Friendbot if they're low.
3. Prints "Demo reset complete ✅".

Add it to `package.json`: `"reset": "tsx scripts/reset-demo.ts"`. Now `pnpm reset` (or `npm run reset`) gets you to a clean state.

Test this 3 times in a row. It must be boring and reliable.

### 2. Pitch deck near-final
Today the deck stops being skeletal. Real visuals, real numbers, real screenshots.

- Slide 2 (problem): pull a real OFW remittance stat. Worldbank or BSP (Bangko Sentral ng Pilipinas) figures. Cite the source on the slide footer.
- Slide 4 (product): three screenshots from your working app. Caption each.
- Slide 6 (how it works): one clean diagram. If nobody on the team can design, use a tool like Excalidraw or Mermaid and screenshot.
- Slide 9 (team): four faces, four roles, no LinkedIn URLs (judges won't click them, they take up space).

### 3. Rehearse with P1
P1 owns the demo script. They drive, you watch. Your job during rehearsal:
- Time it. The demo should be under 3 minutes if there's a 5-min pitch slot, under 5 if there's a 10-min slot.
- Note every moment that's confusing or slow. After the run, give P1 feedback. Don't interrupt mid-run.
- Make sure the reset script gets run between rehearsal takes.

Run it twice today, end-to-end.

### 4. Tighten RLS (only what's needed for demo safety)
Don't go full production. Just make sure:
- Family A can't read Family B's wishlist (if you have multiple seeded families).
- Store can't write to a wishlist they don't own a settlement on.

For the demo with one family and one store, this barely matters. If you only have time for one thing today, skip RLS and finish the reset script.

### 5. End-of-day integration sync
The last "real" sync. Tomorrow is rehearsal day. Today's sync question: **what's still flaky?** Flaky things kill demos. List them. Decide tonight: fix or accept (with a workaround).

## Watch out for
- **New features.** Today is scope freeze. If anyone — including you — says "wouldn't it be cool if...", the answer is "yes, that goes in slide 8 (what's next)." Not in the build.
- **Reset script that doesn't reset.** If your reset script leaves residue (an orphaned settlement, a stale realtime subscription, a stuck wishlist), you'll demo on a polluted state. Test thoroughly.
- **Pitch deck rabbit holes.** Don't pick fonts for 2 hours. Use the default theme, fill the content, move on.

## Hand-offs
- **You owe the team** a working `pnpm reset` by end of day.
- **You owe P1** notes from at least one full rehearsal.

---

# DAY 6 — Demo Day Readiness

## Outcome
You could be judged today and win. README is clean, repo is presentable, pitch deck is locked, you have a recorded backup video, submission materials are ready.

## Tasks

### 1. Three full rehearsals
The whole team. Time each one. The third should be the smoothest.

After each rehearsal:
- Run the reset script.
- Take a 10-minute break. (Three rehearsals back-to-back makes people robotic.)
- Note what broke or felt slow. Fix only what's a real risk.

### 2. Record the backup demo video
After rehearsal 3, when the team is at peak performance: P1 drives, you record screen. Get a clean 2–3 minute run with narration. Save it to Drive, Loom, wherever. Share the link in the team chat.

This is your insurance. If the live demo crashes on stage, you switch to the video without missing a beat. Many winning teams use a backup video; nobody loses points for it.

### 3. Pitch deck final lock
- Spelling check.
- Make sure every screenshot is current (post-Day 5 polish).
- Export to PDF as backup, even if you'll present from Slides.
- Decide who says what on each slide. Write speaker names in the slide notes.

### 4. README + repo cleanup
The judges *will* skim the repo. Make it presentable.

`README.md` structure:
```markdown
# InternStellar

> One-line tagline.

## What it does
The one-paragraph pitch from Day 1.

## The Golden Path
Deposit → Split → Wishlist → Lock → Deliver → Confirm → Release.

## How to run locally
1. `cp .env.example .env.local` and fill in Supabase + Stellar keys.
2. `pnpm install`
3. `pnpm db:seed` (runs `db/seed.sql`)
4. `pnpm dev`
5. Visit `http://localhost:3000`.

## Tech
- Stellar Testnet + Soroban (Rust)
- Next.js 14 + Tailwind
- Supabase (Postgres + Auth + Realtime + RLS)

## Contract
Deployed at: `C...` (testnet). Verify on [stellar.expert](https://stellar.expert/explorer/testnet/contract/C...).

## Demo reset
`pnpm reset` — returns the DB to clean demo state.

## Team
- P1 — Contract Lead
- P2 — Chain Integration
- P3 — Frontend / UX
- P4 — Data + Integration + PM

## Roadmap (post-hackathon)
Bullet list from pitch slide 8.
```

Make sure `.env.example` is in the repo. Make sure `.env.local` is in `.gitignore`. Make sure no service-role key is in any committed file. Search the repo for the string before pushing: `git grep "service_role"` should turn up nothing in committed files.

### 5. Submission materials
Check the hackathon submission portal. Typical asks:
- Project name and tagline
- One-paragraph description (use the pitch paragraph)
- Demo video URL (your backup video — kills two birds)
- Live URL (Vercel deploy if you have one, otherwise the contract address)
- GitHub repo URL
- Team member info

Fill the form **today**, even if you don't submit yet. The form will surface anything missing. Tomorrow you'll just review and click submit.

### 6. Last integration sync (5 min, not 15)
"Anything still flaky? Speak now." If yes, decide: fix tonight or accept. Either is OK. Pretending it's fine is not OK.

## Watch out for
- **Last-minute features.** Day 6 is not for features. If someone shipped a "small thing" today, demo without it. Untested code is a liability.
- **The "we'll just demo it live" trap.** Always have the backup video. Always.
- **Forgetting submission.** Tomorrow morning, the submission portal will be overloaded. Submit early in the day, not at the deadline.

## Hand-offs
- **You owe the team** the recorded backup video link.
- **You owe the judges (via submission)** a complete, clean repo and pitch deck.

---

# DAY 7 — Buffer + Submission

## Outcome
Submission is in. Team is rested. Demo runs clean on whatever device you're presenting from.

## Tasks

### 1. Submit early (morning)
Don't wait for the deadline. Portals crash. Submit in the morning, then your day is about polish and rest.

### 2. Run the demo on the actual presentation device
If you're presenting on a venue laptop, you can't. But if you're presenting from a team laptop, run the full demo on *that specific laptop* with *that specific browser* with *that specific WiFi*. Surprises here are common: missing extension, wrong screen resolution, mic permissions, ad blocker breaking Supabase.

### 3. Fix only what broke in rehearsal yesterday
Nothing new. No new features. Not even small ones. Not even "while I'm in there."

### 4. Rest
A calm team that demos a working loop beats an exhausted team with an ambitious broken thing. Eat a real meal. Take a walk. Don't pull an all-nighter on Day 6→7.

### 5. Final check, 1 hour before demo
- Reset script run? ✅
- Stellar accounts funded? ✅
- Contract address still working? Check stellar.expert. ✅
- Backup video accessible offline? ✅
- Pitch deck open in two places (laptop + phone as backup)? ✅
- Team knows who says what? ✅

## Watch out for
- **The submission deadline myth.** "We have until midnight" turns into "the portal won't accept our submission at 11:58 PM." Submit by noon.
- **WiFi failure.** Have a phone hotspot ready. Test it before the demo.
- **One teammate going off-script.** Brief the team 30 min before: stay tight on the pitch slides, P1 drives the demo, no improvising new features mid-demo.

## Hand-offs
- **You owe yourself** a calm presentation.

---

# Cross-cutting playbooks

## How to run the daily integration sync (15 minutes, every day from Day 2)

Same structure every time. Predictability matters more than depth.

1. **P1:** "Today I shipped X. Tomorrow I'm working on Y. I'm blocked by Z (or: I'm not blocked)."
2. **P2:** Same format.
3. **P3:** Same.
4. **P4 (you):** Same. Then add: "Schema changes today: \[list, or 'none']. Anything I need from anyone?"
5. **Round-table:** "Is anyone blocked by anyone else, that wasn't called out?"
6. **One-line summary** posted to team chat.

Hard rule: no design discussions in the sync. If a design discussion erupts, P4 says "let's take this offline, P1 and P2 sync after." You are allowed to be slightly annoying about this.

## How to handle scope creep

Three signals you're in scope creep:

1. Someone says "wouldn't it be cool if..."
2. Someone is building a feature that isn't on the day's task list.
3. Someone is making the demo *fancier* before the demo *works*.

Your response, always: "Park it. Add it to the stretch goals list. We revisit after Day 4's tag is green." Then actually add it to the list. Make people feel heard, not blocked. The stretch list is also useful for the pitch deck's "what's next" slide.

## How to handle a teammate stuck for too long

Two hours is the threshold. After two hours stuck on the same problem with no visible progress:

1. Walk over, pair on it for 15 min.
2. If still stuck, escalate: get a second teammate involved.
3. If still stuck after 30 min more, ask: "Can we swap this out for a stub and come back later?" Often yes. The Golden Path doesn't need every feature working; it needs the *path* working.

## The "Lola Test"

P3 owns this, but you co-own it. The test: would Lola Cora (the family member in the demo, an older Filipina who's not technical) be able to use the app without help?

Concrete checks you can do without P3:
- No word like "blockchain," "wallet," "transaction" visible on the family or store views.
- Every important button is large enough to tap with a thumb.
- Success states have a green checkmark or similar — never just a "200 OK" feel.
- Tagalog labels on the most critical buttons (the OFW view can stay English — that user is more sophisticated).

If you see English jargon on the family view, raise it. Now, not Day 6.

## Stroops vs XLM: the conversion rule

- **DB columns:** always stroops, always integer (`bigint`).
- **API responses:** stroops by default; if the UI wants XLM, convert at the boundary.
- **UI display:** XLM, formatted to at most 4 decimal places, with the unit "XLM" visible. Do not show "0.0000037 XLM" — round to "<0.001 XLM" or similar.
- **Conversion:** 1 XLM = 10,000,000 stroops. Always. There is no floating-point version of this.

Put this in the README under "Conventions" so nobody forgets.

## Files you should own in the repo

By end of Day 2:
- `db/schema.sql` — the table definitions.
- `db/seed.sql` — the demo data.
- `db/policies.sql` — the RLS policies.
- `.env.example` — the env vars without secrets.

By end of Day 4:
- `db/functions.sql` — the `finalize_wishlist` RPC.

By end of Day 5:
- `db/reset.sql` — the reset SQL.
- `scripts/reset-demo.ts` — the reset runner.

By end of Day 6:
- `README.md` — finalised.
- The pitch deck (in `docs/` or linked from the README).

This is your footprint in the repo. Easy to grep, easy to audit.

---

# When to interrupt vs when to let people work

P4 is the most interrupt-prone role. You're glue, so you naturally want to ask everyone how it's going. Don't. Three rules:

1. **Sync at the daily integration meeting.** Save your questions for there.
2. **Async beats sync.** Drop a question in the team chat. Let people answer when they break.
3. **Interrupt for blocks only.** If you discover that P3 is building the wrong UI for the schema, that's a block — interrupt. If you're just curious how P2's API is going, wait.

The exception: Day 4. On Day 4 you should be in everyone's face, because the loop has to close. Interrupt freely. Sit next to people. Pair-test. Day 4 is your day.

---

# Closing reminder

You're not the most visible role on this team. P1 will be the one demoing live; P3 will be the one with the prettiest screenshots in the deck. That's fine. The reason your team will finish on time and demo a working product is **because P4 made sure no part of the system was waiting on another part.**

That's the win. Protect the Golden Path. Be the glue. Submit early. Rest.

Good luck. 🌟
