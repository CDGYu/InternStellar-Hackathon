"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { Link2 } from "lucide-react";

import type { BindActionResult } from "@/app/(app)/account/binding-actions";

type Action = (p: BindActionResult | null, fd: FormData) => Promise<BindActionResult>;

export function MobileBindingBanner({
  action,
  title,
  body,
  label,
  placeholder,
}: {
  action: Action;
  title: string;
  body: string;
  label: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [state, formAction] = useFormState<BindActionResult | null, FormData>(
    action,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state?.ok, router]);

  return (
    <div className="p-5 bg-white border border-black/5 shadow-sm rounded-3xl">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 bg-[#5b7cff]/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
          <Link2 className="w-4 h-4 text-[#5b7cff]" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[15px] font-extrabold text-[#1a1d2e] leading-tight">
            {title}
          </h3>
          <p className="text-[13px] text-[#6b7280] mt-0.5 leading-relaxed">{body}</p>
        </div>
      </div>

      {/* Form */}
      <form action={formAction} className="flex flex-col gap-2 mt-4">
        <label className="block text-[11px] font-bold uppercase tracking-widest text-[#6b7280] mb-1">
          {label}
        </label>
        <input
          name="email"
          type="email"
          placeholder={placeholder}
          required
          className="w-full px-4 py-3 rounded-2xl border border-[#e5e9f0] bg-[#f5f7fa] text-[14px] text-[#1a1d2e] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#5b7cff] focus:ring-2 focus:ring-[#5b7cff]/15 transition-all"
        />

        {state?.error ? (
          <p role="alert" className="text-[13px] text-red-500 font-medium px-1">
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="text-[13px] text-emerald-600 font-medium px-1">
            Linked! Refreshing&hellip;
          </p>
        ) : null}

        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full py-3.5 rounded-2xl font-bold text-[14px] transition-all ${
        pending
          ? "bg-[#e5e9f0] text-[#9ca3af] cursor-not-allowed"
          : "bg-[#5b7cff] text-white shadow-lg shadow-[#5b7cff]/25 active:scale-[0.98]"
      }`}
    >
      {pending ? "Linking…" : "Connect"}
    </button>
  );
}
