"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowUpRightIcon } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { registerAction, type RegisterResult } from "@/app/auth/actions";

/**
 * Sign-up form. Same useFormState / useFormStatus pattern as LoginForm,
 * with one extra wrinkle: the role picker is a segmented control that
 * stores its value in a hidden `<input name="role">` so the value lands
 * in the FormData the server action receives.
 *
 * Keeping role selection visual rather than a dropdown matches the
 * design system's tactile feel — three pressable chips that look
 * pressed when selected.
 */
const ROLE_OPTIONS = [
  { value: "ofw", label: "OFW", hint: "Sponsor a family abroad" },
  { value: "family", label: "Family", hint: "Receive a sponsored split" },
  { value: "store", label: "Store", hint: "Fulfill incoming orders" },
] as const;

type RoleValue = (typeof ROLE_OPTIONS)[number]["value"];

export function RegisterForm() {
  const [state, formAction] = useFormState<RegisterResult | null, FormData>(
    registerAction,
    null,
  );
  const [role, setRole] = useState<RoleValue>("ofw");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Input
        label="Display name"
        name="display_name"
        autoComplete="name"
        placeholder="Auntie Maria"
        required
      />
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 6 characters"
        minLength={6}
        required
        hint="At least 6 characters"
      />

      <fieldset>
        <legend className="block text-xs uppercase tracking-[0.16em] text-ink-muted font-medium mb-2.5">
          I am a…
        </legend>
        {/* Single hidden field carries the actual form value. The visible
            chips are buttons that update React state and toggle aria-pressed. */}
        <input type="hidden" name="role" value={role} />
        <div className="grid grid-cols-3 gap-3">
          {ROLE_OPTIONS.map((opt) => {
            const selected = role === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-4 text-center",
                  "bg-surface text-ink transition-all duration-300 ease-soft",
                  selected
                    ? "shadow-neu-inset-sm text-accent"
                    : "shadow-neu hover:-translate-y-0.5 hover:shadow-neu-hover active:translate-y-0 active:shadow-neu-inset-sm",
                )}
              >
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">
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
          className="rounded-2xl bg-surface shadow-neu-inset-sm px-4 py-3 text-sm text-red-500"
        >
          {state.error}
        </div>
      ) : null}

      <SubmitButton />

      <p className="text-center text-sm text-ink-muted mt-2">
        Already have an account?{" "}
        <a
          href="/login"
          className="text-accent hover:text-accent-light transition-colors font-medium"
        >
          Sign in
        </a>
      </p>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full">
      {pending ? "Creating account…" : "Create account"}
      {pending ? null : <ArrowUpRightIcon className="h-4 w-4" />}
    </Button>
  );
}
