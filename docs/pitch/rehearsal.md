# Pitch Rehearsal — Day 5

**Owner:** P4 (Charles) drives the stopwatch; P1 (Prince) co-pilots.
**Goal:** 2 timed runs with a post-mortem after each. Bring total deck
+ demo to ≤5:30 (hard ceiling 7:00).

> Rule: **`npm run reset` between every run.** If the DB has leftover
> state from a previous rehearsal, the demo doesn't reflect what a
> judge sees. Stale state hides bugs.

---

## Pre-flight (one-time, before Rehearsal 1)

Run these in order. If any step fails, fix it before starting the
stopwatch — a broken pre-flight is not a rehearsal, it's debugging.

| # | Step | Expected |
|---|---|---|
| 1 | `npm run reset:db-only` | `✓ DB reset in <300ms` |
| 2 | `npm run verify-stellar` | `✓ Stellar testnet reachable` |
| 3 | `npm run test:escrow-wiring` | All checks pass |
| 4 | `npm run build` | Clean (warnings about `sodium-native` ignorable) |
| 5 | `npm run dev`, hit `/login` | 200, demo chips work |
| 6 | Sign in as Maria → land on `/ofw` | dashboard renders, no console errors |
| 7 | Sign in as Cora → land on `/family` | dashboard renders |
| 8 | Sign in as Nena → land on `/store` | dashboard renders |
| 9 | Browser tabs ready in this order | OFW · Family · Store · Stellar Expert · backup video |

**Backup video check (one-time):** Make sure
`docs/pitch/screenshots/demo-fallback.mp4` plays full-screen with no
prompts and the audio is off (we narrate live).

---

## Rehearsal protocol (per run)

**Both rehearsals follow the same script. Don't skip the reset.**

1. **Reset.** `npm run reset` → wait for "Done." line. If it fails,
   stop and triage; don't try to rehearse around it.
2. **Reload all four browser tabs** (OFW / Family / Store / Stellar
   Expert). Stale React state from a previous run can mask issues.
3. **Stopwatch start** the moment Charles says the first word of
   slide 1. Don't start the watch on "OK here we go" — start on
   "Good morning."
4. **Run the deck + demo to the end**, including the closing ask.
   Don't pause to fix things — note them and keep going.
5. **Stopwatch stop** on the last word of slide 10.
6. **Fill in the post-mortem section below** within 5 minutes of
   stopping. Memory degrades fast.

### Stopwatch checkpoints (call these out *quietly* while presenting)

| Mark | Should be at | Run 1 | Run 2 |
|---|---|---|---|
| End of slide 3 (Insight) | 1:15 | ____ | ____ |
| Demo starts | 1:45 | ____ | ____ |
| Demo ends | 3:15 | ____ | ____ |
| End of slide 7 (Why Stellar) | 4:25 | ____ | ____ |
| End of slide 10 (Ask) | 5:30 | ____ | ____ |

If any checkpoint is more than 15s over, you're losing the audience —
note which slide swallowed the time.

---

## Post-mortem — Rehearsal 1

**Date / time:** ____________________
**Charles + ____________** (who else was present)

### Timing

- Final wall-clock: **____:____**
- Over/under target (5:30): **____**
- Slowest slide (where did we lose time?): __________________
- Fastest slide (could we slow down here and not lose anyone?): _____

### What broke

- [ ] Anything in `npm run reset` (write the error verbatim): ______
- [ ] Any UI element that didn't render or rendered stale: ________
- [ ] Any chain call that timed out or returned an unexpected error:
  __________
- [ ] Any moment a presenter looked at their notes mid-sentence:
  __________

### What landed

- One sentence we delivered that felt like a moment: __________
- One number that the room reacted to: __________

### Decisions before Rehearsal 2

- [ ] Add / cut / rephrase: __________
- [ ] Re-record backup video? (Y/N): ____
- [ ] Anything needing a code change: __________
- [ ] Anyone needing to re-memorize a section: __________

---

## Post-mortem — Rehearsal 2

**Date / time:** ____________________
**Charles + ____________**

### Timing

- Final wall-clock: **____:____**
- Delta vs Rehearsal 1: **____** (faster / slower by ____)
- Did Rehearsal 1's fixes work? Y / N — why?

### What broke (this run)

- [ ] Anything new: __________
- [ ] Anything from Rehearsal 1 that still bites: __________

### What landed (this run)

- New moment that worked: __________
- Number that didn't land last time but lands now (or vice versa):
  __________

### Go / no-go for Day 6 lock

- [ ] We can hit ≤5:30 reliably (both runs under 6:00): Y / N
- [ ] No live chain dependency for the critical-path demo (i.e. if the
      network's slow, we still tell the story): Y / N
- [ ] Backup video is up-to-date: Y / N
- [ ] Every speaker can do their slide without notes: Y / N

If all four are Y → **tag `day-5-reset-ready`** and the deck enters
finalization. If any is N → schedule a third rehearsal and decide
which constraint to drop.

---

## Anti-checklist (things that will hurt during the real pitch)

- Don't open dev tools during the demo. The console clutters the
  screen.
- Don't switch tabs to "show something we built." If it's not in the
  90-second demo plan, it's not in the demo.
- Don't apologize for latency. Narrate intent instead — "she's about
  to confirm delivery — watch Nena's screen."
- Don't read the slides. The slides are for the audience, not you.
- Don't end on "and that's it" or "any questions?" — end on the
  scripted closing line (slide 10).
- Don't run `npm run dev` and the demo on the same machine as your
  presentation laptop. Use two — one for the demo, one for the deck.
  If you only have one, at least split it across two desktops.

---

## Notes / observations (free-form)

> Use this space for anything that doesn't fit the structured sections
> — judge questions you imagined, jokes that worked, jokes that
> didn't, accidental insights from the dry runs.

____________________________________________________________________
____________________________________________________________________
____________________________________________________________________
