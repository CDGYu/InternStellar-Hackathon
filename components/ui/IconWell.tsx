import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

/**
 * "Drilled into the card" container for an icon or small glyph. The design
 * system calls this an Icon Well — always an inset shadow so it reads as a
 * concavity in the surface, never a floating chip.
 *
 *   <IconWell><CoinIcon /></IconWell>
 *
 * The icon child should be sized via its own `className` (the well is just
 * the well; we don't constrain children).
 */
export interface IconWellProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  tone?: "default" | "accent" | "teal";
  depth?: "shallow" | "deep";
  children: ReactNode;
}

const sizes: Record<NonNullable<IconWellProps["size"]>, string> = {
  sm: "h-10 w-10 rounded-xl",
  md: "h-14 w-14 rounded-2xl",
  lg: "h-20 w-20 rounded-2xl",
};

const tones: Record<NonNullable<IconWellProps["tone"]>, string> = {
  default: "text-ink",
  accent: "text-accent",
  teal: "text-accent-teal",
};

export function IconWell({
  size = "md",
  tone = "default",
  depth = "deep",
  className,
  children,
  ...rest
}: IconWellProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center bg-surface",
        depth === "deep" ? "shadow-neu-inset-deep" : "shadow-neu-inset",
        sizes[size],
        tones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
