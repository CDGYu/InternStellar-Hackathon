import Link from "next/link";

import { MobileSettingsShell } from "../MobileSettingsShell";

export const dynamic = "force-dynamic";

const FAQ = [
  {
    q: "What is InternStellar?",
    a: "A smart remittance escrow platform for OFWs and their families, built on Stellar and Soroban. The OFW funds a category split (groceries, medicine, savings); the family builds a wishlist from a local store's inventory; funds lock in escrow on approval; the store delivers; the family confirms; escrow releases.",
  },
  {
    q: "How does the escrow flow work end-to-end?",
    a: "A wishlist moves through these states: draft → pending_approval → locked → delivered → released. The locked state is set when the on-chain lock_escrow call succeeds. Released is set when release_escrow succeeds. Every transition writes an append-only row to the settlement audit table.",
  },
  {
    q: "Why is money shown in stroops, not pesos?",
    a: "On-chain values live in stroops (1 XLM = 10,000,000 stroops) as bigint integers — that's the only way to do exact arithmetic without floating-point drift. The UI converts to XLM (up to 4 decimal places) for display only.",
  },
  {
    q: "I'm using a demo account. Will my data persist?",
    a: "Yes — the three demo accounts (Auntie Maria / Lola Cora / Aling Nena) all share the same Supabase project. Anything you do shows up for everyone else viewing that account. If you want isolated state, register your own account.",
  },
  {
    q: "I clicked a button and nothing happened.",
    a: "Most actions in the hackathon prototype either (a) navigate, (b) submit a form to a server action, or (c) hit the /api/escrow/* routes. If a click does nothing, check the browser console for errors and use Report a Bug.",
  },
  {
    q: "Why does dark mode look different from the marketing screenshots?",
    a: "The screenshots are in light mode (the default). Dark mode is a true neumorphic re-tuning — deep cool-grey surface, near-black shadows, subtle white-edge highlights. It's a different aesthetic on purpose.",
  },
];

export default function MobileHelpPage() {
  return (
    <MobileSettingsShell
      title="Help & FAQ"
      description="Common questions about the product, the flow, and the prototype's edges."
    >
      <ol className="flex flex-col gap-3">
        {FAQ.map((item, i) => (
          <li key={i} className="p-4 rounded-2xl bg-[#f5f7fa]">
            <p className="text-sm font-bold text-[#1a1d2e]">{item.q}</p>
            <p className="mt-1.5 text-xs text-[#6b7280] leading-relaxed">
              {item.a}
            </p>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-center text-xs text-[#6b7280]">
        Didn&apos;t see your question?{" "}
        <Link
          href="/mobile/settings/contact"
          className="text-[#5b7cff] font-semibold hover:underline"
        >
          Get in touch
        </Link>
        .
      </p>
    </MobileSettingsShell>
  );
}
