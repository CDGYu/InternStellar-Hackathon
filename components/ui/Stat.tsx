import type { ReactNode } from "react";

import { cn } from "./cn";

/**
 * Single big-number readout — used for dashboard summary stats. The value
 * sits in display typography; supporting label + delta are muted body text.
 *
 *   <Stat label="Total Funded" value="124.5 XLM" hint="Lifetime, all wishlists" />
 *
 * Designed to be placed *inside* a Card, not as a Card itself — that keeps
 * the dashboard layout free to compose stats in groups, grids, or as
 * sub-sections of a larger panel.
 */
export interface StatProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Optional icon-well or other glyph to anchor the stat visually. */
  icon?: ReactNode;
  className?: string;
}

export function Stat({ label, value, hint, icon, className }: StatProps) {
  return (
    <div className={cn("flex items-start gap-5", className)}>
      {icon ? <div className="shrink-0">{icon}</div> : null}
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.18em] text-ink-muted font-medium">
          {label}
        </p>
        <p className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-ink mt-2">
          {value}
        </p>
        {hint ? <p className="text-sm text-ink-muted mt-2">{hint}</p> : null}
      </div>
    </div>
  );
}
