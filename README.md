# InternStellar

## 🧩 Problem
Remittances currently account for approximately 8.7% of the Philippine GDP. However, the lack of structured management tools leads to several systemic failures:
- Remittance Misuse: Funds intended for long-term goals (savings/health) are often consumed by immediate, unplanned expenses.
- Retail Inefficiency: Sari-sari stores suffer from 22% average stock discrepancies and high capital constraints due to informal lending.
- High Costs: Traditional remittance channels often charge up to 7% in fees, significantly eroding the capital received by families.

## 🌟 Vision
InternStellar envisions a future where remittances are no longer just money transfers, but programmable financial support systems that directly improve everyday life for Filipino families.

We hope to assist OFWs in ensuring that money is distributed transparently for necessities like groceries, utilities, education, and healthcare by combining Stellar's quick and affordable blockchain technology with escrow-based household spending. While local MSMEs receive from quicker and safer payments, families have easier access to reputable community retailers.

## 🎯 Purpose
Our team created InternStellar to solve a problem that many OFWs and their families encounter: making sure that remittances are utilized safely, openly, and for necessities.

## 👥 Target Users
- Overseas Filipino Workers
- Family Members
- MSME Owners

## ✨ Features
- Programmable Remittance Engine — Smart remittance allocation system.
- Utility and Essential Bill Automation — Automated bill payment processing.
- Inventory and Conditional Escrow — QR-verified escrow payment system.
- Emergency Fund and Multi-Sig Controls — Dual-approval emergency withdrawals.

## 🛠 Tech Stack
- Frontend: React / Next.js / Tailwind CSS
- Backend: Next.js API Routes / Supabase
- Blockchain: Stellar (Soroban / Horizon API / Stellar SDK)
- Other tools: GitHub / Stellar Lab

## 🚀 How to Run Locally
```
git clone https://github.com/CDGYu/InternStellar-Hackathon.git
cd InternStellar-Hackathon
npm install
cp .env.example .env.local   # then fill in Supabase + Stellar secrets
npm run dev
```

### One-time Supabase dashboard toggles
These cannot be configured via SQL or the MCP — flip them once per project:
- **Authentication → Providers → Email → Leaked password protection: ON.**
  Checks new passwords against HaveIBeenPwned.org at sign-up / password-change
  time. Required for production posture; the Supabase Security Advisor flags
  the project until this is enabled.

## 🌐 Deployment

### Testnet
- Contract / App Address: `CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF`
- 📸 Screenshot — Stellar Expert (Testnet)
  ![Testnet Screenshot](./screenshots/testnet.png)

### Mainnet
- Contract / App Address: `Not deployed — testnet-only for Build on Stellar PH 2026.`
- 📸 Screenshot — Stellar Expert (Mainnet)
  ![Mainnet Screenshot](./screenshots/mainnet.png)

## 🎥 Demo
- 🔗 Live App: https://internstellar-hackathon.vercel.app/
- 🎬 Demo Video: [YouTube / Loom link]
- 🖼 Pitch Deck: [Google Slides / Canva link]

> **Live App credentials (testnet demo data):**
> - OFW — `maria.ofw@internstellar.demo`
> - Family — `cora.family@internstellar.demo`
> - Store — `nena.store@internstellar.demo`
> - Password — `demo123456` for all three.
>
> Readiness probe: `GET https://internstellar-hackathon.vercel.app/api/health` should return `{ chain: "ok", db: "ok" }` once the Vercel project's env vars are populated (see `docs/handoffs/p4-charles.md` §"Hosted Deployment").

## 👨‍💻 Team
| Name | Role | GitHub |
|---|---|---|
| Rene Vincent Cosme | Backend Engineer | @RVBCosme |
| Gerardo Razon III | Frontend Engineer | @Inuyashatrades |
| Charles Derick Yu | Product Lead / Full-Stack Engineer | @CDGYu |
| Prince Edwin Zablan | Blockchain Engineer | @zprinceedwin |

## 📜 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
