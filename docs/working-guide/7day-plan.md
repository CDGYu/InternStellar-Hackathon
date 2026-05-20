# InternStellar — 7-Day Hackathon Execution Plan
### Build on Stellar Philippines Hackathon · Team of 4 · AI-assisted (Claude Code / Codex)

---

## 0. The One Thing To Remember

**Protect the Golden Path. Everything else is negotiable.**

> OFW sets split % → deposits test funds → **Soroban contract** splits into 3 sub-balances → Family builds wishlist from **Supabase** inventory → triggers escrow lock → Store delivers → Family confirms (button) → escrow releases to store → inventory decrements → receipt card shows.

If by Day 5 only that loop works end to end, you have a winning demo. If you have 8 half-built modules and that loop is broken, you have nothing.

---

## 1. Corrected Tech Stack (final)

| Layer | Decision | Why |
|---|---|---|
| Blockchain | Stellar Testnet + **one** Soroban contract (Rust) | Locked by hackathon; one contract = realistic for Rust beginners |
| Contract scope | `deposit_and_split`, `lock_escrow`, `release_escrow`, `get_balances` | Split + escrow as functions, NOT 3 contracts |
| Frontend | Next.js + Tailwind | AI tools strongest here; mobile-first "Lola Test" |
| Backend | Next.js API routes (NO separate Node/Vercel functions service) | One less moving part |
| DB / Auth / Realtime | Supabase (Postgres + Auth + Realtime + RLS) | Replaces Firebase entirely |
| Wallet | Test keypairs + Friendbot funding; **Freighter = stretch only** | Confirmation-button demo path chosen — no Freighter on critical path |
| Tooling | `stellar-cli`, Stellar Lab, stellar.expert (testnet) | Build / deploy / verify |

**CUT (do not build):** Firebase, Passkeys/Secp256r1, multi-sig emergency, SEP-12/24/38, real utility-API auto-detection, offline-first sync, Tingi conversion math, on-chain credit scoring. These go in the pitch as "roadmap."

---

## 2. Roles

| Person | Role | Owns |
|---|---|---|
| **P1** | Contract Lead + Demo Owner | The Soroban contract end-to-end; final demo script & live run |
| **P2** | Chain Integration + Backup Contract | Stellar JS SDK, API routes calling contract, contract code review/backup |
| **P3** | Frontend + UX (Lola Test owner) | 3 role views in Next.js/Tailwind; making it look like GCash |
| **P4** | Data + Integration Glue + PM | Supabase schema/RLS/realtime/seed; ClickUp; pitch deck; daily integration |

**Anti-silo rule:** Every day ends with a 15-min integration sync. Wire pieces against stubs from Day 2. No "big bang" integration on Day 6 — that is the #1 killer.

---

## 3. Day-by-Day Plan

### DAY 1 — Foundations & De-risking (NO feature work yet)
The whole point of Day 1 is to prove the scariest thing (Rust/Soroban toolchain) works before you depend on it.

- **P1:** Install `stellar-cli`, Rust, target wasm. Build & deploy the **hello-world Soroban contract** to testnet. Verify it on stellar.expert. *(This is the single most important task of the week — if the toolchain fights you, you find out Day 1, not Day 5.)*
- **P2:** Set up the Next.js repo, shared GitHub, branch strategy. Get Stellar JS SDK connecting to testnet; fund a test keypair via Friendbot. Confirm a balance read works.
- **P3:** Next.js + Tailwind scaffold. Build the 3 empty role-view shells (OFW / Family / Store) with fake data and a role switcher. No logic.
- **P4:** Supabase project up. Draft schema (profiles, inventory, wishlist, settlements). ClickUp board mirrors this plan. Write the one-paragraph pitch.
- **End of day:** Hello-world contract is live on testnet AND the frontend can read *a* balance. If not, Day 2 starts here — do not advance.

### DAY 2 — Core Contract + Schema
- **P1:** Write `deposit_and_split`: takes total + 3 percentages, stores 3 sub-balances in contract storage. Use `i128`, fixed-point integers (stroops), `#![no_std]`. Unit-test locally with `stellar-cli`.
- **P2:** API route `POST /api/deposit` that calls the contract and returns balances. Review P1's Rust for integer overflow (use checked arithmetic) and access control.
- **P3:** OFW view: working allocation sliders (3 categories, must sum to 100%), "Send funds" button → hits P2's API → shows returned sub-balances.
- **P4:** Finalize Supabase schema, enable RLS, seed inventory + demo users (1 OFW, 1 Family, 1 Store).
- **End of day:** OFW can move sliders, click send, see 3 real on-chain sub-balances.

### DAY 3 — Escrow Logic + Inventory UI
- **P1:** Add `lock_escrow` and `release_escrow` to the same contract. Lock moves grocery funds to held state; release sends to merchant address. Test the happy path locally.
- **P2:** API routes `POST /api/escrow/lock` and `POST /api/escrow/release`. Wire contract responses back. Keep error handling in this layer.
- **P3:** Family view: browse inventory (from Supabase), build wishlist, "Request approval" button. Store view: see incoming order, "Mark delivered" button.
- **P4:** Wishlist + settlement tables wired to realtime so Store view updates live. Start pitch deck outline.
- **End of day:** Escrow lock works on-chain; Family can build a wishlist that creates a real locked escrow.

### DAY 4 — Close the Golden Path Loop
This is the make-or-break day. The full loop must run end to end by tonight.
- **P1:** Wire `release_escrow` to the Family "Confirm delivery" button path. Test: lock → confirm → funds land at store address → verify on stellar.expert.
- **P2:** Connect the full chain: deposit → split → lock → release, all through API routes, all reflected in UI state.
- **P3:** Family "Confirm Delivery" button → triggers release → success state. Store view shows "Paid". Receipt card UI (just renders tx hash + items nicely).
- **P4:** On release, decrement Supabase inventory + mark settlement. Realtime updates Store dashboard. Pitch deck first full draft.
- **End of day:** FULL GOLDEN PATH WORKS END TO END with one happy-path click-through. Tag this commit. This is your safety net.

### DAY 5 — Harden, Polish, Lola Test
Scope freeze at start of day. No new features after this point.
- **P1:** Edge cases: re-deposit, double-confirm, zero balances. Make the contract not panic. Write the demo script (exact clicks, exact narration).
- **P2:** Error states everywhere — failed tx shows a friendly message, never a stack trace. Loading spinners on every chain call.
- **P3:** "Lola Test" polish: hide all blockchain jargon, big buttons, GCash-like styling, success animations, optional Tagalog labels on key buttons.
- **P4:** Demo data reset script (one command to return to clean demo state). Pitch deck near-final. Rehearse with P1.
- **End of day:** The demo looks like a product, not a prototype. Reset script works.

### DAY 6 — Demo Day Readiness (treat as if judging is today)
- **All:** Full dress rehearsal 3x. Time it. P1 drives, others watch for breaks.
- **P1:** Lock the demo script. Have a recorded backup video of a perfect run (insurance against live failure).
- **P2:** Deploy a stable final contract to testnet, freeze the address. Smoke-test the deployed version, not just local.
- **P3:** Final visual pass, mobile viewport check (judges may look on a phone).
- **P4:** Pitch deck final. Assign who says what in the pitch. README + repo cleanup for submission.
- **End of day:** You could demo right now and win.

### DAY 7 — Buffer + Submission
Your doc says "6-day"; the hackathon is 7. Day 7 is **buffer, not extra scope.**
- Submit early (don't wait for the deadline — submission portals crash).
- Fix only what broke in rehearsal. No new features. Ever. Under any circumstance.
- Rest before pitching. A calm team that demos a working loop beats an exhausted team with an ambitious broken thing.

---

## 4. Stretch Goals (ONLY if Day 4 finished on time)
In strict priority order. Touch these only after the golden path is locked and tagged:
1. Real Freighter signing on the deposit step
2. Receipt rendered as a real on-chain asset (simplified SEP-39)
3. Utang ledger basic CRUD in Store view
4. Tagalog full localization

If you're tempted to start a stretch goal before Day 4's loop is tagged and working: **don't.**

---

## 5. Top Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| AI tools generate broken/outdated `soroban-sdk` code | **High** | P1+P2 verify every contract API against docs.rs & `stellar-cli` output; never trust AI Soroban code blindly |
| Toolchain setup eats Day 1–2 | High | Day 1 hello-world deploy is a hard gate; don't advance until green |
| Big-bang integration fails Day 6 | High | Daily integration sync from Day 2; tag working loop Day 4 |
| Scope creep ("just one more module") | High | Scope freeze Day 5; stretch goals gated behind Day 4 completion |
| Live demo crashes on stage | Medium | Recorded backup video (Day 6); frozen contract address |
| One person blocked on Rust alone | Medium | P2 is backup contract dev — two brains on Rust, never zero |
