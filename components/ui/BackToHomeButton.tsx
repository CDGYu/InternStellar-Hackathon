import Link from "next/link";

import { ArrowLeftIcon } from "./icons";
import { cn } from "./cn";

/**
 * Small extruded circular link that returns to "/", positioned at the
 * top-left of an auth page (login/register). Absolute-positioned so it
 * doesn't disrupt the centered card layout.
 *
 * Implemented as a styled `<Link>` (not Button + Link, see ButtonLink.tsx
 * for the reason). Renders as an `<a>`, so `next/link` intercepts the
 * click and routes via the client-side router.
 */
export interface BackToHomeButtonProps {
  /** Visual offset from the viewport edges. Defaults match the auth pages. */
  className?: string;
  /** Override the destination (defaults to "/"). */
  href?: string;
  label?: string;
}

export function BackToHomeButton({
  className,
  href = "/",
  label = "Back to home",
}: BackToHomeButtonProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "absolute top-6 left-6 md:top-8 md:left-8 z-10",
        "inline-flex items-center justify-center h-12 w-12 rounded-2xl",
        "bg-surface text-ink shadow-neu",
        "transition-all duration-300 ease-soft",
        "hover:-translate-y-0.5 hover:shadow-neu-hover",
        "active:translate-y-0 active:shadow-neu-inset-sm",
        className,
      )}
    >
      <ArrowLeftIcon className="h-5 w-5" />
    </Link>
  );
}
