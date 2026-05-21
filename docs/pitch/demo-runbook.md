# Demo Runbook (Pitch Day) — Print This

**Driver:** P1 (Prince) at the keyboard. **Narrator:** Charles. **Watcher (timer + fallback trigger):** P4.

**One-line job:** drive deposit → wishlist → lock → release end-to-end in **≤ 90 seconds**, calm hands, no apologies.

**Hard stop:** if the live demo isn't visibly working by **0:30**, the watcher says *"jump to video"* and the narrator continues on the backup tab without comment.

---

## Pre-flight (≤ 5 min before going on)

Run top-to-bottom. Any failure = stop and triage, do not improvise.

| # | What | Where | Expected |
|---|---|---|---|
| 1 | `npm run reset` | terminal | `Demo reset complete. {wishlists=0, settlements=0, stock=50}` |
| 2 | `npm run verify-stellar` | terminal | latest testnet ledger JSON, exit 0 |
| 3 | `curl -s http://localhost:3000/api/health \| jq` | terminal | `{ chain: "ok", db: "ok" }` |
| 4 | Sign in as **Maria** (`maria.ofw@internstellar.demo` / `demo123456`) → `/ofw` | browser tab 1 | dashboard loads, no console red |
| 5 | Sign in as **Cora** (`cora.family@…`) → `/family` | tab 2 | wishlist UI loads |
| 6 | Sign in as **Nena** (`nena.store@…`) → `/store` | tab 3 | inventory + queue load |
| 7 | Open Stellar Expert testnet, blank | tab 4 | `https://stellar.expert/explorer/testnet` |
| 8 | Backup video on second monitor / second desktop | offline copy | plays muted, full-screen, no prompts |

Tab order (left to right): **OFW · Family · Store · Stellar Expert · Backup video**.

Browser zoom: 100%. Dev tools: closed. Slack/Discord notifications: off.

---

## The 90-second demo (read the *Say* column out loud)

> Watcher quietly calls each checkpoint at 0:25 / 0:50 / 1:15. If we're more than ~5s past a checkpoint, narrator skips ahead — never apologize.

| Beat | Tab | Click | Say |
|---|---|---|---|
| **0:00** | OFW | (already on `/ofw` as Maria) | *"I'm Maria, an OFW in Dubai. I want to send my mother in QC ₱1,000 — but not as a lump sum. Specifically: groceries, medicine, emergency."* |
| **0:10** | OFW | Click **Send** → 60 / 30 / 10 split visible | *"60% groceries, 30% medicine, 10% emergency. One on-chain call, three persistent buckets."* |
| **0:25** | Family | Switch to Cora's tab | *"My mother sees her allocation. She shops from Aling Nena's actual inventory — not a catalog."* |
| **0:30** | Family | Add rice + sardines + BP medicine → **Submit wishlist** | *"She submits. Watch what happens to Aling Nena's screen."* |
| **0:45** | Store | Switch to Nena's tab — order in queue (realtime) | *"That just appeared. No refresh — Supabase Realtime. Nena approves, escrow locks on-chain."* |
| **0:55** | Store | Click **Lock escrow** | *"That's a real `lock_escrow` call to Soroban — money is now held, not yet released."* |
| **1:05** | Stellar Expert | Paste contract id, show lock tx | *"Real transaction. Real testnet. Real time."* |
| **1:15** | Store | **Mark delivered** | *"Nena confirms delivery. One step left."* |
| **1:20** | Family | Switch to Cora's tab → **Confirm delivery** | *"My mother confirms. Funds release to Aling Nena. Stock decrements."* |
| **1:28** | Store | Revenue + stock visible | *"Done. One minute thirty. End-to-end."* |

Hard ceiling: **1:30**. If you cross it, the watcher cuts narration to *"and that's our demo"* and moves to slide 6.

---

## Fallback decision tree

```
Live UI broken at 0:30?            → Watcher: "jump to video"
                                     Narrator continues on backup tab,
                                     same script, no apology.

Chain call hangs > 5s?             → Narrator: "while that confirms…"
                                     Skip to next beat verbally;
                                     don't wait for the spinner.

Stellar Expert won't load tx?      → Skip Beat 1:05 entirely.
                                     Say "we'll show the explorer link
                                     in the deck" and continue.

Supabase realtime doesn't fire?    → Manually reload Nena's tab.
                                     Cover with: "let me bring up
                                     Aling Nena's view."

Two things break in a row?         → Watcher says "video".
                                     This is non-negotiable. Stop the
                                     live attempt.
```

The backup video **is not failure**. The audience doesn't know which path was the original plan; only the team does.

---

## Anti-checklist (do not, under any circumstance)

- Open dev tools mid-demo. Console output kills credibility.
- Apologize for latency. Narrate the *intent* of the next step instead.
- Read the deck. The deck is for them, not you.
- Improvise new features mid-demo. Anything not on this card stays off-screen.
- End on *"any questions?"*. End on the scripted closing line of slide 10.
- Run `npm run reset` mid-demo. The reset only happens during pre-flight or between full rehearsal runs.

---

## After every full rehearsal

- Reset state: `npm run reset` (re-arms the demo).
- Fill in [docs/pitch/rehearsal.md](rehearsal.md) post-mortem.
- Decide go/no-go on next rehearsal before stepping away.

---

## Cross-references

- [`pitch-deck-outline.md`](pitch-deck-outline.md) — full deck (slide 5 has the same script in long form).
- [`rehearsal.md`](rehearsal.md) — stopwatch + post-mortem template.
- [`../../internstellar-contract/scripts/demo.sh`](../../internstellar-contract/scripts/demo.sh) — CLI fallback if the UI is dead.
- [`../../DAY-6-TASKS.md`](../../DAY-6-TASKS.md) — Day 6 task list (where this runbook is gated).
