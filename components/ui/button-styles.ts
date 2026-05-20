import { cn } from "./cn";

/**
 * Shared style recipe for `Button` and `ButtonLink`.
 *
 * We keep two component shells — one rendering `<button>`, one rendering
 * an `<a>` via `next/link` — because each has its own semantic HTML role
 * (buttons trigger actions, links navigate). Nesting a `<button>` inside
 * an `<a>` is invalid HTML and breaks navigation in subtle ways (clicks
 * on the button don't reliably bubble up to the anchor's intercepted
 * onClick), so we deliberately *don't* solve this by wrapping Button in
 * Link in callers. This file is the bridge that keeps them visually
 * identical without sharing markup.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-6 text-base",
  lg: "h-14 px-8 text-base",
};

export const buttonVariants: Record<ButtonVariant, string> = {
  // Accent uses its own shadow recipe — the standard neu shadows are tuned
  // for the surface color and read murky on violet. Cooler shadows below.
  primary: cn(
    "bg-accent text-white font-medium",
    "shadow-[6px_6px_12px_rgba(108,99,255,0.35),-6px_-6px_12px_rgba(255,255,255,0.45)]",
    "hover:-translate-y-0.5 hover:shadow-[8px_8px_16px_rgba(108,99,255,0.4),-8px_-8px_16px_rgba(255,255,255,0.5)]",
    "active:translate-y-0 active:shadow-[inset_4px_4px_8px_rgba(60,52,200,0.45),inset_-4px_-4px_8px_rgba(160,150,255,0.4)]",
  ),
  secondary: cn(
    "bg-surface text-ink font-medium",
    "shadow-neu",
    "hover:-translate-y-0.5 hover:shadow-neu-hover",
    "active:translate-y-0 active:shadow-neu-inset-sm",
  ),
  ghost: cn(
    "bg-surface text-ink/80 font-medium",
    "shadow-none",
    "hover:text-ink",
    "active:shadow-neu-inset-sm",
  ),
};

export const buttonBaseClasses = cn(
  "inline-flex items-center justify-center gap-2 rounded-2xl",
  "transition-all duration-300 ease-soft",
);

/**
 * Final className for a button-shaped element. Used by both Button and
 * ButtonLink so the disabled variant differs (only Button can be disabled
 * via the `disabled` attribute; for anchor-as-link disabling, callers
 * should just not render the link).
 */
export function buttonClassName(opts: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  includeDisabledStyles?: boolean;
}): string {
  const { variant = "secondary", size = "md", className, includeDisabledStyles } = opts;
  return cn(
    buttonBaseClasses,
    includeDisabledStyles &&
      "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-neu-inset-sm",
    buttonSizes[size],
    buttonVariants[variant],
    className,
  );
}
