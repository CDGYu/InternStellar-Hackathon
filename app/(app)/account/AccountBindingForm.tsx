"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { BindActionResult } from "./binding-actions";

type Action = (p: BindActionResult | null, fd: FormData) => Promise<BindActionResult>;

export function AccountBindingForm({
  action,
  label,
  placeholder,
}: {
  action: Action;
  label: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [state, formAction] = useFormState<BindActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state?.ok, router]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Input label={label} name="email" type="email" placeholder={placeholder} required />
      {state?.error ? (
        <p role="alert" className="text-sm text-red-500">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="text-sm text-accent-teal">
          Linked! Refreshing…
        </p>
      ) : null}
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Linking…" : "Connect"}
    </Button>
  );
}
