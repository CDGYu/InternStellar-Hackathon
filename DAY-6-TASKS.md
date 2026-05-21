# Day 6 — Tasks (Final deploy + dress rehearsals + submission)

**Prereq:** Day 5 hardening, reset script, request_id/Retry-After/AbortSignal/idempotency, `/api/health`, and `npm run test:no-leaks` all landed and green. See [`DAY-5-TASKS.md`](DAY-5-TASKS.md) for the state Day 6 builds on.

**Day 6 outcome:** the contract is deployed from a frozen Rust source at a frozen address, the team has rehearsed three full timed runs with a backup video on hand, the pitch deck is content-final, and the repo is in submission shape.

---

## ⏱️ Status at start of 2026-05-22

| Owner | Item | Status |
|---|---|---|
| P2 | Deploy stable final contract from frozen Rust source | ✅ done (no new deploy needed — `CB3V…GRDF` is the frozen final; `cargo test` 27/27 from same source) |
| P2 | Freeze contract address in `.env.example` + handoff doc | ✅ done (inventoried — `.env.example` + `demo.sh` + `DAY-5-SUMMARY.md` + `DAY-6-TASKS.md` all consistent on `CB3V…GRDF`; no orphans) |
| P2 | Smoke-test deployed version (demo.sh + `/api/health` + UI) | 🟡 operator step (run `bash demo.sh`, `npm run test:no-leaks` with `next dev` up, then one UI golden path) |
| P4 | Three timed full dress rehearsals (< 3 min each), P1 drives | 🟡 operator step (template in [docs/pitch/rehearsal.md](docs/pitch/rehearsal.md); needs the team in a room) |
| P4 | Lock down the demo script (runbook frozen, no live edits) | ✅ done ([docs/pitch/demo-runbook.md](docs/pitch/demo-runbook.md) — one-page printable, beat-by-beat narration + fallback decision tree) |
| P4 | Record backup video of one perfect run | 🟡 operator step (needs screen capture during a clean rehearsal — runbook in demo-runbook.md tells you exactly what to record) |
| P4 | Pitch deck final — placeholders filled, content frozen | ✅ done (content draft locked in [docs/pitch/pitch-deck-outline.md](docs/pitch/pitch-deck-outline.md); remaining `[TODO]` tags are operator-side: 3× UI screenshots + 2024 BSP figure confirmation + team photos) |
| P4 | Assign speaking parts per slide | ✅ done (run-of-show table in the deck — Charles / P3 / P2 / P1 / Charles per slide) |
| P4 | README + repo cleanup for submission | ✅ done ([README.md](README.md) rewritten as project front door; npm-scripts table matches `package.json`; no orphan contract ids; `.env*` confirmed gitignored + untracked) |
| All | `golden-path-v1` git tag (Day 4-5 carry-over — fires after first perfect rehearsal) | 🟡 operator step (fire after first clean rehearsal: `git tag -a golden-path-v1 -m "..."; git push origin golden-path-v1`) |
| P4 | Hackathon submission form | 🟡 operator step (needs platform login + the artifacts above) |

Carry-overs subsumed by Day 6 work: Day 5's "three reset reliability runs" gets folded into the dress rehearsals (each rehearsal opens with `npm run reset`); Day 5's "two timed rehearsals" is superseded by Day 6's three.

---

## P2 (Rene) — Final deploy + freeze

### Deploy the stable final contract

Hard rule: no further edits to `internstellar-contract/contracts/internstellar/src/lib.rs` after the deploy starts. P1 owns the source; P2 owns the deploy + address freeze.

Pre-deploy gate:

```
cd internstellar-contract
cargo test          # must be 27/27 green (Day 5 tests + originals)
stellar contract build
# produces target/wasm32v1-none/release/internstellar.wasm
```

Deploy:

```
stellar contract deploy \
  --wasm target/wasm32v1-none/release/internstellar.wasm \
  --source <funded-deployer-key> \
  --network testnet
```

Capture the new contract id. Update everywhere it's hardcoded — the current id is referenced in:

- `.env.example` → `NEXT_PUBLIC_CONTRACT_ID`
- `.env.local` (operator's local file)
- `internstellar-contract/scripts/demo.sh` (`CONTRACT_ID` default)
- Anywhere else: `grep -rn CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF .`

Out-of-band share with the team (Slack/DM). No further deploys after this point.

### Smoke test the deployed version

Three independent confirmations the new address actually works:

1. **CLI fallback path**
   ```
   bash internstellar-contract/scripts/demo.sh
   ```
   Must print three stellar.expert tx URLs and end with "Golden Path complete ✓".

2. **API surface**
   With `next dev` running:
   ```
   npm run test:no-leaks                        # green
   curl -i http://localhost:3000/api/health     # 200 { chain: "ok", db: "ok" }
   ```
   Both must pass before declaring the deploy good.

3. **UI golden path**
   OFW deposit → family lock → family release end-to-end through the browser. One run is enough; what matters is no `contract_error` or `503 contract_not_configured` against the new address.

### P2 Day 6 gate
- One frozen contract id in `.env.example`, committed to main.
- `demo.sh` + `test:no-leaks` + `/api/health` + UI golden path all green against that id.
- Commit pushed; no further deploys planned.

---

## P4 (Charles) — Rehearsal + pitch + submission

### Three timed full dress rehearsals (P1 drives)

- Target: **< 3 minutes per run** (the slot is 5 min; leave headroom for Q&A).
- P1 drives the demo; P2 + P4 watch, time, and note every confusing/slow moment.
- `npm run reset` between runs — proves the reset script holds up under repeated load (this also closes out Day 5's "3× reset reliability" item).
- After each rehearsal, a 2-minute post-mortem: pick fixes vs. accept-with-workaround. No new scope.
- At least one rehearsal exercises the CLI fallback (`bash demo.sh`) so the team knows the fallback path cold.

### Lock down the demo script

Freeze the runbook: exact words P1 says on each slide / each click, exact data shown. No live ad-libbing during the real pitch.

- One-page printable runbook (PDF or plain markdown), one row per beat.
- Click-by-click for the live demo segment.
- The reset command, the deposit amount, the wishlist contents — all named.
- Filed in `docs/pitch/` next to the deck.

### Record backup video of a perfect run

- One full end-to-end run, recorded screen-only (no faces, no audio).
- Trim to the same < 3 min target.
- Host link reachable from the deck (and offline copy on every team member's laptop).
- This is the fallback if the live demo breaks during the pitch — *not* a replacement for the live demo.

### Pitch deck final

Pull the placeholders from Day 5 to full content:

- **Slide 2** — real OFW remittance stats (World Bank or BSP figures, cite source visibly).
- **Slide 4** — real screenshots of OFW / Family / Store views, captured from the deployed UI on a clean reset.
- **Slide 6** — clean architecture diagram (Excalidraw or Mermaid export), screenshot embedded.
- **Slide 9** — team photos + role labels matching the merged `README.md`.
- **Slide 10** — the ask (mentorship / pilot / grant), one sentence.
- Speaker notes per slide finalized.

Don't theme-hunt. Don't pick fonts. Content beats polish.

### Assign speaking parts

Per-slide owner table — name the person, the slide range, the target seconds. Put it in the runbook above.

### README + repo cleanup

The README is what judges read **before** running anything. Make it the front door.

- Project description (one paragraph — what InternStellar is and who it's for).
- 30-second quickstart: clone → `.env.local` → `npm install` → `npm run dev`.
- Deployed contract id (the frozen one from P2).
- Link to demo video.
- Architecture diagram from the deck.
- `npm run` table (dev, reset, test:* scripts).
- Team + roles (mirror Slide 9).

Cleanup pass:

- `grep -rn "TODO\|FIXME\|XXX"` — resolve or open issues.
- Confirm `.env` and `.env.local` are gitignored and not in any commit (the service-role key was rotated on Day 5 — Day 6 is the last day to spot any other leak).
- Dead branches: list them in a comment, but don't delete without team OK.
- `internstellar-contract/scripts/demo.sh` uses the frozen contract id.
- All docs (`DAY-*-TASKS.md`, `docs/handoffs/*`, `docs/pitch/*`) consistent on contract id + deploy date.

### Hackathon submission

Package and submit. Include:

- Deck PDF.
- Demo video link.
- Repo link (at the `golden-path-v1` tag).
- Deployed contract id + testnet RPC endpoint.
- Team names + roles.
- Anything else the submission form asks for.

Verify the form returned a confirmation. Screenshot it.

### P4 Day 6 gate
- Three rehearsals on the record, all < 3 min, post-mortem notes filed.
- Demo runbook frozen; speaking parts assigned.
- Backup video recorded and accessible.
- Deck content-final.
- README + repo at submission state; `golden-path-v1` tag applied to the commit the submission points at.
- Submission confirmation captured.

---

## Cross-cutting

### Git tags

After the **first perfect rehearsal** (no UI glitch, < 3 min, clean reset between):

```
git tag -a golden-path-v1 -m "Day 6 — golden-path demo verified end-to-end"
git push origin golden-path-v1
```

The hackathon submission should point at this tag, not `main`, so judges see exactly the code that was rehearsed.

Optional: `git tag -a day-6-final -m "Day 6 — final deploy + submission"` on the final commit.

### Emergency rollback plan

If something breaks after the final deploy:
- `.env.example` git history holds the previous frozen contract id.
- `git revert` the deploy commit — the code referencing the new id reverts with it.
- Keep the old contract address funded on testnet until after judging, just in case.

---

## What "done" looks like end-of-Day-6

| Gate | Owner | Acceptance |
|---|---|---|
| Final contract deployed | P2 | Frozen id in `.env.example`; demo.sh + UI golden path + `/api/health` + `test:no-leaks` all green against that id |
| Three timed rehearsals | All | All < 3 min, post-mortems filed, at least one CLI-fallback run on record |
| Demo runbook frozen | P4 | One-page printable runbook + speaking-parts table in `docs/pitch/` |
| Backup video | P4 | One full run recorded, link accessible from the deck and the team's laptops |
| Pitch deck | P4 | Every slide content-final, source cited where applicable |
| README + repo cleanup | P4 | README current, no orphan secrets, `npm run` table accurate |
| `golden-path-v1` git tag | All | Tag points at the rehearsed commit |
| Submission | P4 | Hackathon form submitted, confirmation screenshot saved |

If all eight gates are green, InternStellar is shipped.

---

## Cross-references

- [`DAY-5-TASKS.md`](DAY-5-TASKS.md) — what shipped through Day 5 and which carry-overs Day 6 absorbs.
- [`internstellar-contract/scripts/demo.sh`](internstellar-contract/scripts/demo.sh) — the CLI fallback path used in smoke tests and one rehearsal.
- [`scripts/_test-no-stacktrace-leak.ts`](scripts/_test-no-stacktrace-leak.ts) — leak regression test (`npm run test:no-leaks`).
- [`app/api/health/route.ts`](app/api/health/route.ts) — readiness probe used in smoke tests.
- [`docs/pitch/pitch-deck-outline.md`](docs/pitch/pitch-deck-outline.md) — deck outline being finalized on Day 6.
