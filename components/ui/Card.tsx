import type { HTMLAttributes } from "react";

import { cn } from "./cn";

/**
 * Container primitive. Default state is extruded (raised from the surface).
 * Pass `tone="inset"` for a carved-into-the-surface variant — used as a well
 * inside another card, never standalone.
 *
 * Cards are intentionally not interactive by default. If you need a clickable
 * card, wrap with `<button>` or `<Link>` and pass `interactive` so the hover
 * lift and motion engage.
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "extruded" | "inset" | "inset-deep";
  interactive?: boolean;
  /** "lg" (default) = 3xl radius (32px). "md" = 2xl (16px) for nested wells. */
  size?: "lg" | "md";
}

export function Card({
  tone = "extruded",
  interactive = false,
  size = "lg",
  className,
  children,
  ...rest
}: CardProps) {
  const radius = size === "lg" ? "rounded-3xl" : "rounded-2xl";
  const baseShadow =
    tone === "inset"
      ? "shadow-neu-inset"
      : tone === "inset-deep"
      ? "shadow-neu-inset-deep"
      : "shadow-neu";
  const motion = interactive
    ? "transition-all duration-300 ease-soft hover:-translate-y-1 hover:shadow-neu-hover"
    : "";

  return (
    <div
      className={cn(
        "bg-surface text-ink",
        radius,
        baseShadow,
        motion,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
