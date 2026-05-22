"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowUpRightIcon } from "@/components/ui/icons";
import { signInAction, type SignInResult, resendConfirmationAction, type ResendResult } from "@/app/auth/actions";
import { DEMO_ACCOUNTS } from "@/app/auth/demo-accounts";

/**
 * Client-only form. The page that wraps it is a server component — keeps
 * almost all of /login server-rendered so we only ship JS for the actual
 * interactive surface (inputs + demo quick-fill).
 *
 * `useFormState` lets the server action return an inline error message
 * without bouncing through a query param. `useFormStatus` (inside the
 * SubmitButton) gives the button its own pending UI without lifting state
 * up here. Both are stable in React 18.3 / Next 14.
 *
 * Demo quick-fill: each chip pops the seed credentials into the
 * uncontrolled inputs via refs, then calls `form.requestSubmit()`. Same
 * code path as a regular submit, so the server action / error handling
 * stays identical.
 */
export function LoginForm() {
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
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      <Input
        ref={emailRef}
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
      />
      <Input
        ref={passwordRef}
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        required
      />

      {state?.error ? (
        <div
          role="alert"
          className="rounded-2xl bg-surface shadow-neu-inset-sm px-4 py-3 text-sm text-red-500"
        >
          {state.error}
        </div>
      ) : null}

      <SubmitButton />

      <button
        type="button"
        onClick={resend}
        className="text-xs text-ink-muted hover:text-accent transition-colors text-center"
      >
        Didn&apos;t get the confirmation email? Resend
      </button>
      {resendState?.ok ? (
        <p role="status" className="text-xs text-accent-teal text-center">
          If that account needs confirming, an email is on its way.
        </p>
      ) : resendState?.error ? (
        <p role="alert" className="text-xs text-red-500 text-center">{resendState.error}</p>
      ) : null}

      <div className="mt-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-px flex-1 bg-surface shadow-neu-inset-sm" aria-hidden />
          <span className="text-xs uppercase tracking-[0.16em] text-ink-muted">
            or try a demo account
          </span>
          <div className="h-px flex-1 bg-surface shadow-neu-inset-sm" aria-hidden />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DEMO_ACCOUNTS.map((acc) => (
            <DemoChip
              key={acc.email}
              label={acc.label}
              role={acc.role}
              onClick={() => fillAndSubmit(acc.email, acc.password)}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-muted text-center">
          Password for all demo accounts: <span className="font-mono">demo123456</span>
        </p>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full">
      {pending ? "Signing in…" : "Sign in"}
      {pending ? null : <ArrowUpRightIcon className="h-4 w-4" />}
    </Button>
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
      className="group flex flex-col items-start gap-1 rounded-2xl bg-surface shadow-neu px-4 py-3 text-left transition-all duration-300 ease-soft hover:-translate-y-0.5 hover:shadow-neu-hover active:translate-y-0 active:shadow-neu-inset-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
    >
      <span className="text-xs uppercase tracking-[0.14em] text-ink-muted font-medium">
        {role}
      </span>
      <span className="text-sm font-medium text-ink">{label}</span>
    </button>
  );
}
