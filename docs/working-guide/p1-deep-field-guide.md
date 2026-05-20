# P1 DEEP FIELD GUIDE — Contract Lead + Demo Owner
### Windows + WSL2 · Rust beginner · AI-assisted · 7 days

> **Read this once fully before Day 1.** Then work it top to bottom, checking boxes.
> Your job in one sentence: *get ONE Soroban contract doing deposit-split-escrow-release, deployed to testnet, demoable, without being fooled by AI-generated Rust.*

> **📎 OPTIONAL FREIGHTER NOTE:** The default plan uses the confirmation-button demo (no real Freighter) — that decision and everything below is unchanged. IF the team decides to use real Freighter, do NOT change any step below. Instead, read **APPENDIX F — Optional Real-Freighter Track (P1 view)** at the very bottom. It is additive only. Short version: real Freighter is mostly P2's job; it changes very little for you.

---

## THE THREE LAWS OF P1 (tape these above your monitor)

1. **Day 1 is not about features. It's about proving the machine works.** If hello-world isn't on testnet by end of Day 1, you have a Day 1 problem, not a Day 2 plan.
2. **Never trust AI Soroban code. Verify every API against `docs.rs/soroban-sdk` and the official examples.** The AI is trained on old SDK versions and will hallucinate functions that were removed. This is the #1 way P1 loses a day.
3. **One contract. Not three.** Split + escrow are *functions in the same contract*. Every time you feel tempted to add a second contract, re-read this line.

---

## THE AI-VERIFICATION LOOP (your most important skill — use it every time you generate contract code)

You will use Claude Code / Codex to write Rust. That's fine. But run EVERY generated chunk through this loop before you believe it:

1. **Generate** the function with the AI.
2. **Compile immediately.** `cargo build --target wasm32-unknown-unknown --release`. Don't write three functions then compile. One at a time.
3. **If it fails to compile:** do NOT just paste the error back to the AI and loop forever. Open `docs.rs/soroban-sdk` (latest version), find the actual type/function it's complaining about, and read the real signature.
4. **Cross-check against the official examples repo** (the Soroban examples, linked from `developers.stellar.org`). If your AI code structurally differs from how the official example does storage/auth, the example is right and the AI is wrong.
5. **Only after it compiles AND matches the docs pattern**, write the unit test and move on.

> Rule of thumb: if you've pasted an error back to the AI more than **3 times** and it's still broken, STOP looping with the AI. The AI is stuck on a stale API. Go read the doc/example directly. This single rule will save you the most time all week.

---

# DAY 1 — Toolchain & Hello-World (hour-by-hour, this is your danger zone)

Goal: a hello-world Soroban contract deployed to testnet and visible on stellar.expert. Nothing else.

### Hour 0–1 · WSL2 is your home now
- [ ] Confirm you are inside WSL2 (Ubuntu), not PowerShell. Every command for the rest of the week runs in the WSL2 terminal.
- [ ] **Keep your project files inside the Linux filesystem** (e.g. `~/projects/`), NOT on `/mnt/c/...`. Building Rust on the Windows-mounted drive is slow and causes weird file-permission failures. This is the #1 WSL2 gotcha. (concept: WSL2's Linux filesystem is fast; the Windows mount is a bridge and slow for compilers.)
- [ ] Update the box: `sudo apt update && sudo apt upgrade -y`.
- [ ] Install build prerequisites: `sudo apt install -y build-essential pkg-config libssl-dev curl git`. (concept: Rust needs a C linker and SSL headers to build native deps; missing these is the #2 Linux failure.)

### Hour 1–2 · Rust
- [ ] Install Rust via `rustup` (the official installer one-liner from rust-lang.org). Choose the default install.
- [ ] Restart the shell or `source` the env so `cargo` and `rustc` are on PATH. Verify both print versions.
- [ ] Add the WASM target: `rustup target add wasm32-unknown-unknown`.
  - concept: a Soroban contract isn't a normal program — it compiles to **WASM** (a tiny portable bytecode the blockchain can run). Without this target, `cargo build` for the contract silently can't produce the right artifact.

### Hour 2–3 · Stellar CLI
- [ ] Install the **Stellar CLI** (the tool that builds, deploys, and calls contracts). Verify it prints a version.
- [ ] Configure it for **testnet** and generate an identity (a keypair the CLI will use to sign deploys).
- [ ] Fund that identity from **Friendbot** (free fake testnet XLM). 
- [ ] Open `stellar.expert` testnet explorer, paste your address, confirm the balance is there. **You must SEE it on the explorer** — this proves your CLI is really talking to testnet.

> Checkpoint: if by hour 3 you cannot see your funded account on stellar.expert, do not push forward. Pull in P2 now. This is exactly the kind of thing the buddy rule exists for.

### Hour 3–5 · Hello-world, unchanged
- [ ] Initialize the official hello-world Soroban contract (the CLI has a `contract init` that scaffolds it). Do **not** modify the logic.
- [ ] Read the generated files slowly. Identify these four things and say them out loud:
  - the `#![no_std]` line at the top (concept: the contract can't use Rust's standard library — there's a hard size limit on the compiled WASM, so you ship a minimal binary).
  - the `#[contract]` struct (concept: this is "the contract object").
  - the `#[contractimpl]` block (concept: the public functions inside here are what the outside world can call).
  - the function signature taking `env: Env` (concept: `Env` is the contract's window into the blockchain — storage, time, the caller's identity. You'll use it constantly.)
- [ ] Build it to WASM (release, wasm target).
- [ ] Deploy it to testnet with the CLI. Save the returned **contract ID**.
- [ ] Invoke its function from the CLI. See the return value in your terminal.
- [ ] Find the contract on stellar.expert by its ID. Screenshot it. **This screenshot is your Day 1 trophy.**

### Hour 5–6 · Buffer / catch-up
- [ ] If everything worked: stop. Rest. Do NOT start writing your real contract today — a tired first attempt at the split logic creates bugs you'll fight on Day 2. Discipline is part of the job.
- [ ] If something's broken: this hour is why it exists. Use it. Bring in P2.

### 🟥 End-of-Day-1 ALL-4 gate
- [ ] You demo: live hello-world on testnet + the explorer screenshot.
- [ ] **Be brutally honest here.** If you're not deployed, say it plainly: "I need tomorrow morning to finish Day 1." That sentence today saves the whole team on Day 6. P4 runs this meeting; your job is to tell the truth into it.

### "You are behind" recovery (Day 1)
If end of Day 1 you're stuck on toolchain: that's recoverable and common. Tomorrow morning is yours to finish it; the team absorbs the slip now while it's cheap. What is NOT acceptable is hiding it and "catching up later" — the contract is the critical path; a hidden 1-day slip here becomes a 3-day disaster.

---

# DAY 2 — The Split Function (hour-by-hour)

Goal: `deposit_and_split` works and is unit-tested locally. By tonight P3's sliders move real on-chain balances.

### Hour 0–1 · Design before you type
- [ ] On paper (not in the editor), write the function contract in plain words:
  - Inputs: who deposited, total amount, three percentages.
  - Effect: store three balances (utilities, groceries, emergency) for that user.
  - Output: the three resulting balances.
- [ ] Decide the **money representation NOW**: integers only. concept: **Soroban has no decimals/floats.** You represent money in the smallest unit (stroops) as a big integer type (`i128`). ₱1.50 is not `1.5` — it's `15000000` (1.5 × 10^7). Every money value in your whole contract obeys this. Get this wrong and every number in the demo is wrong.
- [ ] Decide percentages as integers too: 60% is `60`, and you compute `share = total * pct / 100`. concept: do the multiply BEFORE the divide, always, or integer division throws away the remainder and money vanishes.

### Hour 1–3 · Write it (pseudocode — you write the real Rust)
```
fn deposit_and_split(env, from, total: i128, pct_util, pct_groc, pct_emerg):
    require: pct_util + pct_groc + pct_emerg == 100      // reject bad input, don't silently fix
    require: total > 0

    util_share  = total * pct_util  / 100
    groc_share  = total * pct_groc  / 100
    emerg_share = total - util_share - groc_share          // remainder trick: last bucket
                                                           // absorbs rounding so nothing is lost

    storage.set( key(from, "UTIL"),  read(from,"UTIL")  + util_share )
    storage.set( key(from, "GROC"),  read(from,"GROC")  + groc_share )
    storage.set( key(from, "EMERG"), read(from,"EMERG") + emerg_share )

    return (util_share, groc_share, emerg_share)
```
Concept notes to keep in your head as you write the real version:
- **The remainder trick** (last bucket = total − others) is the standard fix for integer-division rounding. Memorize it; you'll reuse it in escrow.
- **`require`/panic on bad input is correct behavior**, not a bug. A contract that rejects nonsense is safe. A contract that "helpfully" auto-corrects is how money goes missing.
- **Storage has flavors.** concept: Soroban storage comes in types roughly: *instance* (small global contract data), *persistent* (per-user data that must survive — your balances), *temporary* (cheap, expires). User balances → persistent. **⚠️ VERIFY the exact persistent-storage API names on `docs.rs/soroban-sdk` — this is the #1 thing AI gets wrong because it changed across SDK versions.**
- **Checked arithmetic.** concept: integer overflow in money code is a classic exploit. Use the checked/saturating add the SDK recommends, not raw `+`, for the running totals. **⚠️ VERIFY current recommended pattern in the docs.**

### Hour 3–4 · Compile via the AI-Verification Loop
- [ ] One function, compile, fix using docs (not infinite AI loop), repeat.

### Hour 4–6 · Unit test (this is non-negotiable)
- [ ] Write a local test: deposit `1000_0000000` (i.e. ₱1000 in stroops), split 60/30/10.
- [ ] Assert stored balances are exactly 600, 300, 100 (in stroops). 
- [ ] Add a test that a 60/30/20 (=110) input is **rejected**. If it isn't, your `require` is wrong.
- [ ] concept: Soroban has a built-in test harness that simulates the chain locally — you do NOT need testnet to test logic. Use it. It's 100x faster than deploy-and-check.
- [ ] Deploy the updated contract to testnet, invoke once from CLI with real numbers, verify on stellar.expert.

### 🟨 PAIR with P2 (30 min, mandatory)
- [ ] Walk P2 through the contract. P2 specifically hunts for: overflow on the running-total adds, and whether anyone unauthorized could call it. Two pairs of eyes on money code.

### 🟥 End-of-Day-2 gate
- [ ] P3 moves sliders → calls P2's API → your contract → real balances come back. The number on Lola's screen equals your stored balance. That's the win condition.

### "You are behind" recovery (Day 2)
If split isn't tested by end of Day 2: cut scope, not corners. The split is P0 — it cannot be the thing that's missing. If you're behind, the thing that gives is *escrow polish later*, never split correctness. Tell P4 at the gate so Day 3 is re-planned around it.

---

# DAY 3 — Escrow (task-level)

Goal: `lock_escrow` + `release_escrow` + `get_balances` in the SAME contract, happy path tested.

- [ ] **`lock_escrow(env, family, amount)`** — concept: move `amount` out of the family's GROC balance into a separate "held" entry keyed by an escrow id. The money is recorded as locked: visible to read, but no function lets the merchant take it yet. Reuse the remainder-safe integer discipline. ⚠️ Verify storage API on docs.rs.
- [ ] **`release_escrow(env, escrow_id, confirmation)`** — concept: check the escrow exists and isn't already released (guard against double-release — a real exploit), then add the amount to the merchant's balance and mark the escrow consumed. The "already released?" check is the important security line.
- [ ] **`get_balances(env, user)`** — concept: a read-only view function the UI calls constantly. No writes. Returns the three balances (+ optionally locked total).
- [ ] Run the AI-Verification Loop on each.
- [ ] Local tests: lock 50 then release → merchant +50, escrow empty. Then test **release twice** → second must fail. Then **release without lock** → must fail.
- [ ] 🟨 PAIR with P2 on docs.rs verification of the new functions.
- [ ] 🟥 Gate: a wishlist in the app creates a real locked escrow on-chain.

---

# DAY 4 — Close The Loop (your make-or-break day)

Goal: deposit → split → lock → confirm → release works end-to-end and is verified on the explorer. You tag the safety-net commit.

- [ ] 🟨 PAIR with P2: connect `release_escrow` to the real "Confirm Delivery" button path.
- [ ] 🟦 Run the FULL chain yourself from the CLI first, before involving the UI: deposit → split → lock → release. Verify each on stellar.expert. (concept: prove the chain logic in isolation so that if the full click-through fails, you know it's the UI/API, not your contract.)
- [ ] 🟥 ALL-4 full click-through, P3 clicking, you watching the chain.
- [ ] 🟦 When it works once end-to-end: **commit and tag/label it clearly** (e.g. `golden-path-works`). This frozen point is what you fall back to if anything later breaks. This is the single most valuable git action of the week.

### "You are behind" recovery (Day 4)
If the loop isn't closed by end of Day 4: this is the emergency line. Escrow `release` connected to a button is the irreducible demo. Drop EVERYTHING else (edge cases, polish, stretch) and the whole team converges on this one path Day 5 morning. A demo that shows only deposit→split is weak but survivable; a demo where nothing completes is not. Say this clearly at the gate.

---

# DAY 5 — Make It Unbreakable + Own The Demo

- [ ] 🟦 Hostile testing — make the contract refuse to panic on stage: deposit twice, confirm twice, zero/negative amounts, percentages ≠ 100, release unknown escrow id. Each should fail *gracefully* (clean error), not crash the WASM. concept: a panic in a Soroban call reverts the whole transaction — survivable, but you want a clean predictable failure you can talk over, not a mystery.
- [ ] 🟦 Write the **demo script**: every click in order, and the exact sentence you say at each step. You own this because you alone know what's fragile and what to avoid clicking. Keep it to a tight 3 minutes.
- [ ] 🟦 In the script, mark the "**do not touch**" zones — any input that you know is thin. A good demo drives down the road you paved, not into the ditch you didn't.
- [ ] 🟨 PAIR with P4: P4 plays a skeptical judge and runs you through the script twice, asking "what happens if you put 0?" so nothing surprises you live.
- [ ] Scope freeze acknowledged: no new contract functions after today, no exceptions.

---

# DAY 6 — Lock It Down

- [ ] 🟥 Dress rehearsal ×3, timed, you driving.
- [ ] 🟦 Record a **clean backup video** of one perfect end-to-end run (screen recording). concept: this is insurance — if the live demo hits a network blip on stage, you play the video and keep narrating. Hackathon-saving move.
- [ ] 🟨 PAIR with P2: deploy the FINAL contract, write down the frozen contract ID, confirm the app points at *that exact ID*. Smoke-test the deployed one (deployed ≠ local; they can behave differently). Don't change the contract after this.
- [ ] 🟦 Update your part of the README: contract ID, what the contract does in 5 plain lines, how to call it.

---

# DAY 7 — Buffer & Submission

- [ ] 🟥 Submit EARLY with the team (P4 drives the checklist). You supply: contract ID, the tagged commit, link to the deployed contract on stellar.expert.
- [ ] 🟦 Fix ONLY what broke in rehearsal. Zero new code. concept: every line written on the last day is untested under pressure — it's pure risk with no rehearsal behind it.
- [ ] 🟥 Stop. Rest before pitching. You are the demo owner; a calm clear 3-minute run beats a brilliant exhausted mess.

---

## P1 PANIC BOX — read this when it's 1am and nothing works

- **WASM won't build / weird linker error:** you're probably building on `/mnt/c/`. Move the project into the WSL2 Linux home (`~/`). This fixes a shocking number of "random" failures.
- **AI gave me code using a function that doesn't exist:** stale SDK. Stop asking the AI. Open `docs.rs/soroban-sdk` (latest), find the real name, and check the official examples repo for the current pattern. The example repo is ground truth.
- **Stuck in an AI fix-loop (>3 tries):** the AI cannot fix what it's hallucinating. Close it. Read the doc page for that one type. Fix by hand.
- **Numbers in the demo are wrong by a tiny amount:** integer division rounding. Apply the remainder trick (last bucket = total − the others).
- **Contract panics on a demo input:** add a `require` guard at the top that rejects that input cleanly instead of computing into a panic.
- **Everything is on fire and it's Day 4+:** fall back to the tagged `golden-path-works` commit. A known-working older state beats a broken newer one every time. This is why you tagged it.
- **You're blocked and embarrassed to say so:** the buddy rule and the daily gate exist precisely for this. A blocker said out loud on the day it happens is a team adjusting. A blocker hidden for two days is the team failing. Saying it early is the strong move, not the weak one.

---

# APPENDIX F — Optional Real-Freighter Track (P1 view)

> **Status: OPTIONAL. Everything above this line is the default plan and is unchanged.** Only read/apply this appendix if the team has explicitly decided to put real Freighter on the demo path. This appendix ADDS optional steps; it removes nothing.

## F.0 — The single most important thing to understand (read first)

**Freighter barely touches you, P1.** Freighter is a browser extension that signs transactions on the frontend. Your contract cannot tell the difference between a transaction signed by Freighter, by a CLI test key, or by anything else — a signature is a signature. This is confirmed by the official Stellar docs: every Freighter guide is a React/JS dapp task, none are contract tasks.

**Therefore: your Days 1–3 contract work does NOT change at all.** You still build and unit-test with CLI keys exactly as written above. Do not install or think about Freighter while writing the contract. The real Freighter work belongs to **P2** (Chain Integration), as a Day-4 stretch, from the official guides at `developers.stellar.org/docs/build/guides/freighter`.

The rest of this appendix is just the small set of touchpoints where Freighter is *adjacent* to you, marked optional.

## F.1 — Optional, Day 1 (5 minutes, only if you want dev convenience)

- [ ] 🟦 OPTIONAL: install the Freighter browser extension from `freighter.app`.
- [ ] 🟦 OPTIONAL: create a wallet, then **switch the network to Testnet** (it defaults to mainnet/public — this is the #1 Freighter gotcha; the official "Connect to the Testnet" guide exists specifically for this).
- [ ] 🟦 OPTIONAL: import or note a testnet address so you can eyeball balances visually in the extension.
- Why optional: this only helps you *see* things in a browser. It does NOT advance the contract. **Skip it entirely if your hello-world deploy isn't done yet.** The confirmation-button default path needs none of this.

## F.2 — Optional, Day 2–3 (a clarification, not new work)

- Nothing in your `deposit_and_split` / `lock_escrow` / `release_escrow` / `get_balances` work changes. Same code, same tests, same CLI keys.
- ONE conceptual note to keep in your head: with real Freighter, the *caller identity* arriving at a contract function in the live demo will be the Freighter account's address, not a CLI test key. Your contract logic already treats the caller as a parameter/auth subject — so this is transparent to you **as long as you did not hardcode a specific test address anywhere in contract logic.** Action: 🟨 OPTIONAL PAIR with P2 for 5 minutes to confirm the address P2's Freighter flow will send is the one your tests assume. That's it.

## F.3 — Optional, Day 4 (one extra integration check)

- Default Day 4 is unchanged: prove the full chain from the CLI first.
- 🟨 OPTIONAL ADD: after the CLI proof works, do one extra end-to-end run where P2 triggers the deposit via Freighter signing instead of the API test key, and you watch on stellar.expert that it hits your contract identically. Expected result: identical. If it differs, the problem is in P2's signing/network layer, NOT your contract — this check exists to prove that boundary cleanly so blame is fast to locate on demo day.
- Still tag the `golden-path-works` commit on the **confirmation-button** version FIRST. Freighter is the stretch layer on top of a known-good base, never a replacement for having the safe base tagged.

## F.4 — Optional, Day 5–6 (demo script additions — this is the part that genuinely affects you)

This is the only place real Freighter meaningfully lands on P1, because you own the demo script and live run.

- [ ] 🟦 OPTIONAL: in the demo script, add the Freighter popup as an explicit narrated step ("now the family approves in their wallet…") so a 2-second extension delay looks intentional, not broken.
- [ ] 🟦 OPTIONAL: script a **recovery line** for the three common live Freighter failures: (a) extension on wrong network — say "let me switch to testnet" and do it calmly; (b) user-rejected signature — "I'll re-trigger that"; (c) popup doesn't appear — fall back to the confirmation-button path or the backup video.
- [ ] 🟦 OPTIONAL but STRONGLY RECOMMENDED if Freighter is in the live demo: your Day 6 backup video should be of the **confirmation-button** version (the reliable one), so if Freighter dies on stage you switch narration to the video without the run collapsing. The safe path being tagged + recorded is precisely what makes the risky path safe to attempt live.

## F.5 — P1 decision rule for Freighter (keep this honest)

- If Freighter is "would be cooler" → it stays P2's Day-4 stretch; you do nothing in this appendix except optionally F.1.
- If Freighter is "the hackathon explicitly scores real wallet integration" → still P2's build, but you DO apply F.4 (demo script + recovery + safe backup video), because now the live run has a new failure mode you own.
- Either way: **never let Freighter delay the confirmation-button golden path being tagged and working first.** Reversing the safe default before the safe default exists is the one move this whole guide is built to prevent.
