import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "./cn";

/**
 * Neumorphic text input. Default is an inset well; focus deepens the
 * shadow (matching the design system's "carved" focus state). Forwarded
 * ref so React Hook Form / focus-on-mount patterns keep working.
 *
 *   <Input label="Email" type="email" name="email" autoComplete="email" />
 *
 * `label` is rendered above the field. If omitted, the input renders
 * stand-alone — useful inside layouts that own their own labelling.
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: ReactNode;
  /** Visible *after* the field; used for inline validation messages. */
  error?: string | null;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, name, ...rest },
  ref,
) {
  // Auto-derive an id from the name so the <label> binding works without
  // forcing callers to pass both. Falls back to a generic id if neither is
  // provided (rare — practically every form field has a name).
  const inputId = id ?? (name ? `input-${name}` : undefined);

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={inputId}
          className="block text-xs uppercase tracking-[0.16em] text-ink-muted font-medium mb-2.5"
        >
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        name={name}
        className={cn(
          "w-full bg-surface text-ink rounded-2xl px-5 py-3.5",
          "shadow-neu-inset placeholder:text-ink-placeholder",
          "transition-shadow duration-300 ease-soft",
          "focus:outline-none focus:shadow-neu-inset-deep",
          // The global :focus-visible ring would draw a violet halo OUTSIDE
          // the inset well, which fights the "deepens on focus" look.
          // Suppress it and let the deeper inset shadow be the focus signal.
          // Uses the same CSS vars as shadow-neu-inset-deep so it re-tunes
          // automatically when `.dark` flips on <html>.
          "focus-visible:[box-shadow:inset_10px_10px_20px_rgba(var(--neu-shadow-dark-rgb),var(--neu-shadow-dark-alpha-2)),inset_-10px_-10px_20px_rgba(var(--neu-shadow-light-rgb),var(--neu-shadow-light-alpha-2))]",
          error ? "ring-2 ring-red-400/70" : "",
          className,
        )}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={hint || error ? `${inputId}-desc` : undefined}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-desc`} className="mt-2 text-sm text-red-500">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-desc`} className="mt-2 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
