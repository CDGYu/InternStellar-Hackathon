import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MobileRegisterForm } from "./MobileRegisterForm";

export const dynamic = "force-dynamic";

/**
 * Mobile sign-up page. Like the web /register, we don't auto-redirect
 * signed-in users — keeps the page reachable for creating additional
 * demo accounts within one session.
 */
export default function MobileRegisterPage() {
  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#1a1d2e] font-sans px-5 py-6 flex flex-col">
      <Link
        href="/mobile"
        className="inline-flex items-center gap-2 text-sm text-[#6b7280] mb-6 -ml-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-black/5">
          <div className="mb-6">
            <h2 className="text-lg font-extrabold tracking-tight">InternStellar</h2>
            <p className="text-[11px] text-[#6b7280] -mt-0.5">Chain Bridge</p>
          </div>

          <h1 className="text-2xl font-extrabold mb-1.5">Create your account.</h1>
          <p className="text-sm text-[#6b7280] mb-6">
            A few details so we know which dashboard to set you up with.
          </p>

          <MobileRegisterForm />
        </div>
      </div>
    </div>
  );
}
