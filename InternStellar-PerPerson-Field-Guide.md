# InternStellar — Per-Person Step-by-Step Field Guide
### "Standing behind you, pointing at the exact thing to do"

**How to read this:** Find your person (P1–P4). Each day is a numbered checklist in the order you actually do it. Every task is tagged:

- 🟦 **SOLO** — only you do this. Don't wait for anyone.
- 🟨 **PAIR** — you + one named teammate, together.
- 🟥 **ALL-4** — whole team stops and does this together.

> Golden rule taped above everyone's desk: *Money and trust live on Stellar. Everything else lives in Supabase. Protect the golden path.*

---

# P1 — Contract Lead + Demo Owner

You are the highest-risk role. If your part works, the team wins. Your enemy is wasted time on a broken toolchain and AI-generated Rust that lies to you.

## Day 1 — Prove the scary thing works
1. 🟦 Install in this order: Rust (`rustup`), then the wasm target (`rustup target add wasm32-unknown-unknown`), then `stellar-cli`. Do NOT skip ahead until each one prints a version number successfully.
2. 🟦 Generate a testnet identity with the CLI and fund it from **Friendbot** (the free fake-money faucet). Confirm the account shows a balance on `stellar.expert` (testnet).
3. 🟦 Build the official **hello-world Soroban example** unchanged. Compile it to wasm. Don't write your own logic yet — you are testing the *machine*, not your idea.
4. 🟦 Deploy that hello-world contract to testnet. Call its function from the CLI. See it return a value. Open the contract on stellar.expert and screenshot it.
5. 🟥 **ALL-4 end-of-day gate (15 min):** demo your live contract + P2's balance read. If yours isn't deployed, the team's Day 2 = your Day 1 again. Say so honestly tonight, not Day 5.

> Pointing at the exact thing: your ONLY job today is step 4 working. Steps 1–3 are just the road to it. If you're stuck at 2pm, pull P2 in — do not burn the whole day alone.

## Day 2 — The split function
1. 🟦 Start a fresh contract project. Add `#![no_std]` at the top (means: no standard library, keeps the contract tiny enough to be legal — there's a 64KB size limit).
2. 🟦 Write `deposit_and_split(from, total, pct_util, pct_groc, pct_emerg)`. Store three balances in contract storage. Use `i128` integers and treat money as whole "stroops" (no decimals — Soroban can't do decimal points, so 1.5 is stored as 15000000).
3. 🟨 **PAIR with P2:** before you trust ANY AI-generated line, open `docs.rs/soroban-sdk` together and confirm the function names are real and current. AI tools hallucinate old Soroban APIs constantly. This pairing is non-negotiable.
4. 🟦 Write a local unit test: deposit 100, split 60/30/10, assert the three stored balances are exactly 60/30/10. Run it with the CLI.
5. 🟥 ALL-4 gate: P3 moves sliders on screen → real on-chain balances change. If the number on screen matches your stored balance, Day 2 passed.

## Day 3 — Escrow
1. 🟦 In the SAME contract (not a new one), add `lock_escrow(family, amount)` — moves grocery money into a "held" state nobody can withdraw.
2. 🟦 Add `release_escrow(escrow_id, confirmation)` — pays the held money to the merchant address.
3. 🟦 Add `get_balances(user)` — a read-only function the screen uses to show numbers.
4. 🟨 PAIR with P2 again for the docs.rs sanity check on the new functions.
5. 🟦 Local test the happy path: lock 50 → release → merchant balance went up by 50, escrow is empty.
6. 🟥 ALL-4 gate: a wishlist in the app creates a real locked escrow on-chain.

## Day 4 — Close the loop (your make-or-break day)
1. 🟨 PAIR with P2: connect `release_escrow` to the actual "Confirm Delivery" button path end-to-end.
2. 🟦 Run the FULL chain yourself from the CLI first: deposit → split → lock → release. Verify every step on stellar.expert.
3. 🟥 ALL-4: do the full click-through together (P3 clicks, you watch the chain). When it works once, **you personally tag/label this commit as the safety net.**

## Day 5 — Make it unbreakable + own the demo
1. 🟦 Test the ugly cases so the contract never panics: deposit twice, confirm twice, zero balance, weird percentages. A crash on stage is fatal — a graceful "no" is fine.
2. 🟦 Write the **demo script**: the exact clicks, in order, with the exact sentence you'll say at each step. You own this because you know what's fragile.
3. 🟨 PAIR with P4: rehearse the script start to finish at least twice.

## Day 6 — Lock it down
1. 🟥 ALL-4: dress rehearsal ×3, timed.
2. 🟦 Record a **backup video** of one perfect run. This is your insurance if the live demo dies.
3. 🟨 PAIR with P2: confirm the final frozen contract address is the one the app points to.

## Day 7 — Buffer
1. 🟥 ALL-4: submit early. Fix only what broke in rehearsal. No new contract code. Rest your hands and brain before pitching.

---

# P2 — Chain Integration + Backup Contract Dev

You are the bridge and the safety net. The app never touches the blockchain directly — it touches *you* (your API routes). And if P1 is drowning in Rust, you're the second swimmer.

## Day 1 — Plumbing
1. 🟦 Create the shared GitHub repo, set up a simple branch rule (everyone branches off `main`, no direct pushes to `main`). Tell the team the rule.
2. 🟦 Scaffold the **Next.js** project (this is both frontend home AND your API routes — there is no separate backend).
3. 🟦 Install the **Stellar JS SDK**. Write a tiny script that connects to testnet and reads a funded account's balance. Print it.
4. 🟨 PAIR with P1 if they're stuck on toolchain install — two heads on the scary part.
5. 🟥 ALL-4 end-of-day gate (you show: app can read a balance).

## Day 2 — First API route
1. 🟦 Build `POST /api/deposit`. It receives the amount + percentages from the screen, calls P1's contract, returns the new balances as clean JSON.
2. 🟨 **PAIR with P1:** code-review their Rust specifically for two things — (a) integer overflow (every math op should use *checked* arithmetic) and (b) access control (can a random person call admin functions? they shouldn't). You are the second pair of eyes that catches the bug that loses the demo.
3. 🟦 Make the API return a *friendly* error object on failure, never a raw crash. Decide the error shape now so P3 can rely on it.
4. 🟥 ALL-4 gate.

## Day 3 — Escrow routes
1. 🟦 Build `POST /api/escrow/lock` and `POST /api/escrow/release`, each calling the matching contract function.
2. 🟦 All error handling lives HERE in your layer, not in P1's contract and not in P3's screens. One place. This is why the demo won't crash.
3. 🟨 PAIR with P1 on the docs.rs verification of the new contract functions.
4. 🟥 ALL-4 gate.

## Day 4 — Connect everything (make-or-break)
1. 🟨 PAIR with P1: wire the complete chain deposit → split → lock → release so every step flows through your API routes and the result reaches the UI state.
2. 🟦 Add a tiny "health check" route that pings the contract, so on demo day you can prove in 1 second that the chain connection is alive.
3. 🟥 ALL-4: full click-through. Help P1 tag the safety-net commit.

## Day 5 — Bulletproof the seams
1. 🟦 Every chain call gets: a loading state signal the UI can show, a timeout, and a friendly failure message. Test by deliberately feeding bad input.
2. 🟨 PAIR with P3: make sure every error your API returns has a matching friendly screen, not a blank page.

## Day 6 — Freeze
1. 🟨 **PAIR with P1:** deploy the FINAL stable contract to testnet, write down the frozen address, and point the app at it. Smoke-test the deployed version, not just local — they behave differently.
2. 🟦 Clean up the README: how to run it, the contract address, the architecture in 5 lines.
3. 🟥 ALL-4 dress rehearsal ×3.

## Day 7 — Buffer
1. 🟥 ALL-4: submit early. You handle the technical submission (repo link, contract address, deployed URL). Fix only breakage.

---

# P3 — Frontend + UX (Owner of the "Lola Test")

You write the most code, but in the area AI tools are *best* at, so you can move fast. Your real job isn't "make it work" — it's "make it so Lola never sees a scary word."

## Day 1 — Empty shells
1. 🟦 With P2's Next.js scaffold, build three empty screen shells: **OFW view**, **Family view**, **Store view**, plus a simple role-switcher button to flip between them while testing.
2. 🟦 Fill them with fake hard-coded data so they *look* alive. Zero real logic today.
3. 🟦 Set the visual direction now: big buttons, large text, GCash-like, no blockchain words anywhere. Get the team to agree on it.
4. 🟥 ALL-4 end-of-day gate (you show: three screens exist and you can switch between them).

## Day 2 — OFW sliders
1. 🟦 Build the OFW allocation screen: three sliders (Utilities / Groceries / Emergency) that are *forced* to always total 100%.
2. 🟦 Add a "Send Funds" button that calls P2's `/api/deposit`.
3. 🟦 Show the three returned sub-balances back on screen in plain language ("Grocery wallet: ₱600"), never raw numbers or hashes.
4. 🟨 PAIR with P2 briefly to agree on exactly what JSON the API sends back so you're not guessing.
5. 🟥 ALL-4 gate (you click send, real balances appear).

## Day 3 — Family + Store screens
1. 🟦 Family view: list the store's inventory (P4 gives you the Supabase data), let Lola tap items into a "Wishlist," and a "Request Approval" button.
2. 🟦 Store view: show the incoming order and a "Mark Delivered" button.
3. 🟦 Keep every label human: "Waiting for your family to confirm delivery," not "escrow_state: LOCKED."
4. 🟥 ALL-4 gate.

## Day 4 — Close the loop (make-or-break)
1. 🟦 Build the "Confirm Delivery" button on the Family screen → calls release → shows a happy success state.
2. 🟦 Make the Store screen flip to "PAID ✅" after release.
3. 🟦 Build the **receipt card**: a clean little card showing what was bought + a tiny reference code. Pretty, not technical.
4. 🟥 ALL-4: you are the one clicking during the full team click-through. Go slow, narrate.

## Day 5 — The Lola Test polish (your spotlight day)
1. 🟦 Hunt down and delete every piece of jargon on every screen ("gas," "hash," "wallet address," "XDR" — gone or hidden).
2. 🟦 Add success animations, loading spinners (using P2's loading signals), and friendly empty states.
3. 🟦 Add Tagalog labels on the most important buttons (Send / Confirm / Approve).
4. 🟨 PAIR with P2: make sure every API error has a friendly screen, no blank pages or red console text ever visible.

## Day 6 — Final coat of paint
1. 🟦 Check it on a phone-sized screen. Judges may look on mobile. Fix anything that overflows or is too small to tap.
2. 🟦 One consistency pass: same fonts, spacing, button style everywhere.
3. 🟥 ALL-4 dress rehearsal ×3 — watch for any moment the UI confuses the person clicking.

## Day 7 — Buffer
1. 🟥 ALL-4: submit early. You fix only visual breakage from rehearsal. No new screens.

---

# P4 — Data + Integration Glue + Project Manager

You own the filing cabinet, the "do the pieces actually talk to each other" job, and keeping everyone honest about the plan. You are the calm center.

## Day 1 — Foundations
1. 🟦 Create the **Supabase** project. Draft the tables: `profiles` (who is OFW/Family/Store), `inventory`, `wishlist`, `settlements`.
2. 🟦 Set up the **ClickUp** board from the import file. Make sure every person can see their own tasks.
3. 🟦 Write the one-paragraph pitch ("What is this and why does it matter") — you'll grow this into the deck.
4. 🟥 ALL-4 end-of-day gate: **you run this meeting.** Go person by person: is your gate green? Be the one who says out loud "P1 isn't deployed, so tomorrow we fix that first." Protecting the truth is your job.

## Day 2 — Lock the data
1. 🟦 Finalize the schema. Turn on **RLS** (Row-Level Security — a rule so a Family user can only see their own data and a Store only sees its own; the database itself enforces it).
2. 🟦 Seed realistic demo data: one OFW, one Family, one Store, ~8 believable sari-sari items with prices.
3. 🟦 ClickUp hygiene: move done tasks, flag anything slipping. 5 minutes, every day, forever.
4. 🟥 ALL-4 gate (you run it).

## Day 3 — Realtime + deck
1. 🟦 Wire `wishlist` + `settlements` tables to Supabase **realtime** so when something changes, the Store screen updates live without a refresh.
2. 🟨 PAIR with P3: hand over exactly how to read inventory data so their Family screen shows real items.
3. 🟦 Start the pitch deck outline (Problem → Solution → Demo → Stellar's role → Roadmap of the cut features).
4. 🟥 ALL-4 gate (you run it).

## Day 4 — Glue the loop (make-or-break)
1. 🟦 On `release_escrow` success, your system decrements the right inventory item and marks the settlement "settled."
2. 🟦 Confirm the Store dashboard updates live via realtime when this happens.
3. 🟦 Write a **demo reset script**: ONE command that wipes back to clean demo state (full balances, full inventory, no settled orders). You will bless this script's name; it saves every rehearsal.
4. 🟥 ALL-4: full click-through. You watch that the *data side* (inventory down, settlement marked) actually happened, not just the chain side.

## Day 5 — Rehearsal infrastructure
1. 🟦 Test the reset script ten times until it's flawless. Everything depends on it on demo day.
2. 🟦 Pitch deck to near-final. Decide who says which slide.
3. 🟨 **PAIR with P1:** run the demo script together start to finish twice; you play "the judge" and ask hard questions so P1 isn't surprised on stage.

## Day 6 — Demo day readiness
1. 🟦 Pitch deck FINAL. Print/screenshot a backup copy in case the internet dies.
2. 🟦 Assign exact speaking parts: who opens, who narrates the demo, who handles Q&A.
3. 🟥 ALL-4: dress rehearsal ×3, timed. You hold the stopwatch and call out if you're over time.

## Day 7 — Buffer + submission
1. 🟥 ALL-4: **you drive the submission.** Submit EARLY (portals crash at the deadline — this is not a joke). Checklist: repo link, deployed URL, contract address, deck, demo video. Tick each one out loud.
2. 🟦 Final ClickUp pass: everything that's done is marked done; nothing new gets added.
3. 🟥 ALL-4: stop building. Rest. Calm team > exhausted team.

---

# Quick reference: who needs whom, and when

| Moment | Who pairs | Why it matters |
|---|---|---|
| Day 1 toolchain hell | P1 + P2 | Two heads on the scariest unknown |
| Every contract function written | P1 + P2 at docs.rs | AI lies about Soroban APIs — verify or die |
| API ↔ screen data shape | P2 + P3 | Stops "I guessed the JSON" bugs |
| Inventory data ↔ Family screen | P4 + P3 | Real items show up, not fake ones |
| Demo script rehearsal | P1 + P4 | The person who knows the chain + the person playing judge |
| Final contract freeze | P1 + P2 | Deployed ≠ local; must verify the real one |
| Every end-of-day gate | ALL 4 | The anti-silo rule. This is what prevents Day 6 disaster. |
| Day 7 submission | ALL 4, P4 drives | One calm checklist, early, together |

**The one sentence to remember:** the daily ALL-4 gate is not optional ceremony — it is the single thing that stops you discovering on Day 6 that nothing connects.
