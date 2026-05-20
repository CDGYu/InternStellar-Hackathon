# InternStellar — Pitch Deck Outline (Day 3)

**Owner:** P4 (Charles) per `InternStellar-P4-FieldGuide.md` Day 3 task 4.
**Status:** Skeleton only. Day 4 first full draft. Day 5 near-final. Day 6 locked.
**Audience:** Hackathon judges + Stellar PH 2026 partners.

> Discipline rule from the field guide: *Don't design slides today. Just put
> the headlines and 1-2 bullet placeholders per slide.* No font picking, no
> theme hunting until the Golden Path closes.

---

## Slide 1 — Title

- **InternStellar — Programmable Remittances for OFWs**
- Build on Stellar PH 2026 — Team InternStellar
- One-line tagline: *Stop sending lump sums. Start sending intentions.*
- Team members + roles (4 faces, optional — better on slide 9).

---

## Slide 2 — The Problem

- $36B/year remittance flow into the Philippines (cite Worldbank or BSP).
- Remittances ≈ **8.7% of PH GDP** (per README, confirm exact stat).
- Lump-sum problem: money sent home gets spent on the wrong things —
  62% of families report difficulty managing remittances for essentials
  (source: stand-in stat, Charles to validate).
- Retail inefficiency: sari-sari stores have **~22% stock discrepancies**
  and high informal lending costs.
- Remittance fees up to **7%** through traditional channels.

**Real human story (one sentence, one face):** Auntie Maria sends ₱20,000
from Dubai. Two weeks later there's no medicine in the house and no rice.

---

## Slide 3 — The Insight

- Programmable money lets the sender shape **how** funds are used, not
  just **that** they're sent.
- The OFW becomes a co-budgeter, not just a remitter.
- The family gets agency over a defined envelope; the store gets fast,
  guaranteed settlement.

---

## Slide 4 — The Product (three roles, three screens)

- **OFW view** (Auntie Maria, Dubai): allocation sliders →
  `POST /api/deposit` → 3 on-chain buckets (Utilities / Groceries / Emergency).
- **Family view** (Lola Cora, Quezon City): browses inventory → builds
  wishlist → `POST /api/escrow/lock` locks the grocery bucket → confirms
  delivery → `POST /api/escrow/release`.
- **Store view** (Aling Nena's Sari-Sari): live order feed via Supabase
  realtime → marks delivered → receipt + funds appear on `get_balances`.

**Placeholder:** screenshots from Day 4 working app go here (P3 + P4
coordinate).

---

## Slide 5 — Live Demo

- Placeholder. Live demo or recorded backup video plays here.
- Demo script (timed in rehearsal, target <3 min):
  1. OFW sends ₱1,000 split 60/30/10 → 3 buckets visible.
  2. Family adds rice + sardines + paracetamol → submits wishlist.
  3. Family locks escrow → Store dashboard pings (realtime).
  4. Store marks delivered.
  5. Family confirms → release fires → store grocery bucket credited.
  6. Stellar Expert receipt link.

---

## Slide 6 — How It Works

- One clean diagram (Excalidraw / Mermaid, screenshot in):

```
   OFW deposit                Family wishlist + lock           Family release
  ┌──────────────┐           ┌─────────────────────┐         ┌─────────────────────┐
  │ deposit_and_ │ ─────────►│ wishlist (draft)    │ ───────►│ release_escrow      │
  │ split        │           │  → lock_escrow      │         │  → store groc++     │
  │  → 3 buckets │           │  → DB locked        │         │  → DB released      │
  └──────────────┘           └─────────────────────┘         └─────────────────────┘
       │                            │                                │
       ▼                            ▼                                ▼
   "deposit" evt           "esc_lock" evt                    "esc_rel" evt
                                                                  │
                                                                  ▼
                                                       finalize_wishlist (P4)
                                                       → inventory.stock --
```

- Stellar logo + Soroban logo + Supabase logo. No more.

---

## Slide 7 — Why Stellar

- **Low fees** (fractions of a cent vs 7% remittance industry standard).
- **Fast finality** (~5 seconds, fits a Lola Test interaction).
- **Native multi-asset issuance** for future PHP/USDC anchor swaps.
- **Real-world remittance traction** in PH (Tempo, Cebuana, etc.).
- **Soroban** brings programmability without breaking the cost story.

---

## Slide 8 — What's Next (stretch goals + roadmap)

- Freighter wallet signing (currently server-signed for demo).
- Multi-store marketplace (single-store enforced today).
- Real on-ramps via Anchors (PHP / USDC).
- On-chain credit history for receivers → micro-loans for sari-sari stores.
- Utility bill auto-pay (Meralco / Maynilad / Globe payIDs).
- Multi-sig emergency fund (OFW + family co-approval).

---

## Slide 9 — The Team

- 4 faces, 4 roles (NO LinkedIn URLs — judges won't click them).
  - Prince Edwin Zablan — Contract Lead (P1)
  - Rene Vincent Cosme — Integration Bridge (P2)
  - Gerardo Razon III — Frontend / UX (P3)
  - Charles Derick Yu — Data + Integration + PM (P4)

---

## Slide 10 — The Ask

- Mentorship from a Stellar / Anchor engineer for the FX leg.
- Pilot partnership with a real sari-sari store cluster.
- Grant / accelerator slot to harden the contract + ship beyond testnet.

---

## Slide footers (consistent across deck)

- "InternStellar · Build on Stellar PH 2026 · Testnet contract:
  `CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF`"
- (Day 4 contract id — confirm with P1 before final lock.)

---

## What lands when

| Day | What's added to the deck |
|---|---|
| Day 3 (today) | This outline. Headlines + bullets, no design. |
| Day 4 | First full draft. Real screenshots for slide 4. Real stat sources for slide 2. |
| Day 5 | Near-final. Diagram (slide 6) polished. Pitch rehearsed twice. |
| Day 6 | Locked. Spelling pass. PDF export. Speaker notes per slide. |
| Day 7 | Submission. |

---

## Cross-references

- [README.md](../../README.md) — the one-paragraph pitch (slide 1 hook).
- [DAY3-4-P2-SUMMARY-OF-WORK.md](../../DAY3-4-P2-SUMMARY-OF-WORK.md) — the
  Golden Path through the API layer (informs slide 6).
- [InternStellar-P4-FieldGuide.md](../../InternStellar-P4-FieldGuide.md) —
  Day 3 task 4 (this deck) + Day 6 deck-lock checklist.
- [BlockerInformation/p2-rene.md](../../../BlockerInformation/p2-rene.md) —
  P1's contract handoff (informs slides 6 + 7).
