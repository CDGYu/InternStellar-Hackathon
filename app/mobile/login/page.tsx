import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";

import { MobileLoginForm } from "./MobileLoginForm";

export const dynamic = "force-dynamic";

/**
 * Mobile sign-in page. Like the web /login (app/(auth)/login/page.tsx)
 * we do NOT auto-redirect signed-in users away — the page is reachable
 * mid-session, useful for switching demo accounts.
 *
 * `?registered=1` shows the "check your email" banner after a
 * successful sign-up that requires email confirmation.
 */
export default function MobileLoginPage({
  searchParams,
}: {
  searchParams?: { registered?: string };
}) {
  const justRegistered = searchParams?.registered === "1";

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

          <h1 className="text-2xl font-extrabold mb-1.5">Welcome back.</h1>
          <p className="text-sm text-[#6b7280] mb-6">
            Sign in to your InternStellar account.
          </p>

          {justRegistered ? (
            <div
              role="status"
              className="mb-6 flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <span className="font-semibold">Account created.</span>{" "}
                <span className="text-emerald-700">
                  Check your email for a confirmation link, then sign in below.
                </span>
              </span>
            </div>
          ) : null}

          <MobileLoginForm />
        </div>
      </div>
    </div>
  );
}
