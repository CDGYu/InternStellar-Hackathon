"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { registerAction, type RegisterResult } from "@/app/auth/actions";

/**
 * Mobile sign-up form. Three text fields + a role picker styled as a
 * 3-up tappable pill grid. Calls the same registerAction the web
 * RegisterForm uses; on success the action redirects either to
 * dashboardForRole(role) (auto-confirm projects) or
 * /login?registered=1 (email-confirm projects). The middleware
 * rewrites both to /mobile/* on the follow-up hop.
 */
const ROLE_OPTIONS = [
  { value: "ofw", label: "OFW", hint: "Sponsor a family" },
  { value: "family", label: "Family", hint: "Receive support" },
  { value: "store", label: "Store", hint: "Fulfill orders" },
] as const;

type RoleValue = (typeof ROLE_OPTIONS)[number]["value"];

export function MobileRegisterForm() {
  const [state, formAction] = useFormState<RegisterResult | null, FormData>(
    registerAction,
    null,
  );
  const [role, setRole] = useState<RoleValue>("ofw");

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="display_name"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Display name
        </label>
        <input
          id="display_name"
          name="display_name"
          autoComplete="name"
          placeholder="Auntie Maria"
          required
          className="w-full bg-[#f5f7fa] border-0 rounded-2xl h-12 text-sm px-4 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-1.5"
        >
          Email
        </label>
        <input
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
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          minLength={6}
          required
          className="w-full bg-[#f5f7fa] border-0 rounded-2xl h-12 text-sm px-4 focus:outline-none focus:ring-2 focus:ring-[#5b7cff]/40"
        />
        <p className="text-[10px] text-[#9ca3af] mt-1.5 px-1">
          At least 6 characters
        </p>
      </div>

      <fieldset>
        <legend className="block text-[11px] uppercase tracking-widest text-[#6b7280] font-bold mb-2.5">
          I am a…
        </legend>
        <input type="hidden" name="role" value={role} />
        <div className="grid grid-cols-3 gap-2">
          {ROLE_OPTIONS.map((opt) => {
            const selected = role === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                aria-pressed={selected}
                className={
                  selected
                    ? "flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] text-white shadow-lg shadow-[#5b7cff]/25"
                    : "flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center bg-[#f5f7fa] text-[#1a1d2e] hover:bg-slate-100"
                }
              >
                <span className="text-sm font-bold">{opt.label}</span>
                <span
                  className={
                    selected
                      ? "text-[9px] uppercase tracking-wider text-white/80"
                      : "text-[9px] uppercase tracking-wider text-[#6b7280]"
                  }
                >
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {state?.error ? (
        <div
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {state.error}
        </div>
      ) : null}

      <SubmitButton />

      <p className="text-center text-xs text-[#6b7280] pt-2">
        Already have an account?{" "}
        <Link
          href="/mobile/login"
          className="text-[#5b7cff] font-semibold hover:underline"
        >
          Sign in
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
      {pending ? "Creating account…" : "Create account"}
      {pending ? null : <ArrowRight className="w-4 h-4" />}
    </button>
  );
}
