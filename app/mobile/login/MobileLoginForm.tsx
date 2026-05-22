"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { signInAction, type SignInResult, resendConfirmationAction, type ResendResult } from "@/app/auth/actions";
import { DEMO_ACCOUNTS } from "@/app/auth/demo-accounts";

/**
 * Mobile-styled sign-in form. Calls the same signInAction the web
 * LoginForm uses — only the shell visuals change. Demo-account chips
 * pre-fill the inputs via refs and submit via `form.requestSubmit()`,
 * so the server action path is identical to a hand-typed submit.
 *
 * The action redirects to /ofw, /family, or /store on success; the
 * middleware rewrites those to /mobile/* on the follow-up hop because
 * we're on a mobile UA.
 */
export function MobileLoginForm() {
  const [state, formAction] = useFormState<SignInResult | null, FormData>(
    signInAction,
    null,
  );

  const [resendState, resendAction] = useFormState<ResendResult | null, FormData>(
    resendConfirmationAction,
    null,
  );

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function fillAndSubmit(email: string, password: string) {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = password;
    formRef.current?.requestSubmit();
  }

  function resend() {
    const email = emailRef.current?.value?.trim();
    if (!email) return;
    const fd = new FormData();
    fd.set("email", email);
    resendAction(fd);
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Email
        </label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          className="w-full bg-[#f5f7fa] border-0 rounded-2xl h-12 text-sm px-4 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Password
        </label>
        <input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          className="w-full bg-[#f5f7fa] border-0 rounded-2xl h-12 text-sm px-4 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
      </div>

      {state?.error ? (
        <div
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {state.error}
        </div>
      ) : null}

      <SubmitButton />

      <button
        type="button"
        onClick={resend}
        className="w-full text-xs text-[#5b7cff] text-center"
      >
        Didn&apos;t get the confirmation email? Resend
      </button>
      {resendState?.ok ? (
        <p role="status" className="text-xs text-emerald-600 text-center">
          If that account needs confirming, an email is on its way.
        </p>
      ) : resendState?.error ? (
        <p role="alert" className="text-xs text-red-600 text-center">{resendState.error}</p>
      ) : null}

      <div className="pt-6 border-t border-black/5">
        <p className="text-center text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-4">
          Or try a demo account
        </p>
        <div className="grid grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <DemoChip
              key={acc.email}
              label={acc.label}
              role={acc.role}
              onClick={() => fillAndSubmit(acc.email, acc.password)}
            />
          ))}
        </div>
        <p className="text-[10px] text-center text-[#9ca3af] mt-3">
          Password for all demo accounts:{" "}
          <span className="font-mono">demo123456</span>
        </p>
      </div>

      <p className="text-center text-xs text-[#6b7280] pt-2">
        New here?{" "}
        <Link
          href="/mobile/register"
          className="text-[#5b7cff] font-semibold hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] hover:from-[#4a6bef] hover:to-[#6b89ef] text-white rounded-full py-4 text-sm font-semibold shadow-lg shadow-[#5b7cff]/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
      {pending ? null : <ArrowRight className="w-4 h-4" />}
    </button>
  );
}

function DemoChip({
  label,
  role,
  onClick,
}: {
  label: string;
  role: string;
  onClick: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="p-3 bg-[#f5f7fa] hover:bg-slate-100 rounded-2xl transition-all text-center disabled:opacity-50"
    >
      <p className="text-[9px] text-[#6b7280] uppercase tracking-wider font-bold mb-1.5">
        {role}
      </p>
      <p className="text-[11px] font-semibold text-[#1a1d2e]">{label}</p>
    </button>
  );
}
