import Link from "next/link";
import { Menu, ArrowRight } from "lucide-react";

export function MobileLanding() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f5f7fa] text-[#1a1d2e] font-sans">
      <div className="px-5 py-4 flex items-center justify-between bg-white shadow-sm">
        <h1 className="text-lg font-extrabold tracking-tight">InternStellar</h1>
        <button className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-50">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 pb-12 max-w-md mx-auto w-full">
        <h2 className="text-5xl font-extrabold leading-[0.95] tracking-tight mb-12">
          Bridge made<br />
          by users<br />
          for the people.
        </h2>

        <p className="text-base text-[#6b7280] mb-10 leading-relaxed max-w-sm">
          A 7-day prototype for OFWs and their families. Funded splits,
          real-time wishlists, and Soroban-backed escrow.
        </p>

        <Link
          href="/mobile/login"
          className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] hover:from-[#4a6bef] hover:to-[#6b89ef] text-white rounded-full py-5 text-base font-semibold shadow-lg shadow-[#5b7cff]/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          Get Started
          <ArrowRight className="w-5 h-5" />
        </Link>

        <Link
          href="/mobile/register"
          className="w-full mt-3 text-center text-sm font-semibold text-[#5b7cff] py-3"
        >
          Create an account
        </Link>
      </div>

      <div className="px-6 pb-6 text-center">
        <p className="text-xs text-[#9ca3af]">Powered by Stellar Soroban</p>
      </div>
    </div>
  );
}
