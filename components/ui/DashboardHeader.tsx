import Link from "next/link";

import { signOutAction } from "@/app/auth/actions";

import { Button } from "./Button";
import { GearIcon, SparkleIcon } from "./icons";

/**
 * Shared header for every signed-in dashboard (/ofw, /family, /store).
 * Brand mark on the left, user pill + sign-out on the right, sticky.
 *
 * The sign-out is a plain server-action form — no client JS. Pulling this
 * out of the OFW page once we had two more dashboards stops the header
 * from diverging visually as each role gains role-specific actions.
 */
export interface DashboardHeaderProps {
  /** "OFW workspace", "Family workspace", etc. — shown under the brand. */
  workspace: string;
  displayName: string;
  country: string | null;
}

export function DashboardHeader({
  workspace,
  displayName,
  country,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <div className="mx-auto max-w-7xl px-4 md:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-2xl bg-surface shadow-neu flex items-center justify-center text-accent">
            <SparkleIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-base font-extrabold tracking-tight text-ink">
              InternStellar
            </p>
            <p className="text-xs text-ink-muted -mt-0.5">{workspace}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-3 bg-surface shadow-neu-inset-sm rounded-full px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-accent-teal" aria-hidden />
            <span className="text-sm text-ink font-medium">{displayName}</span>
            {country ? (
              <span className="text-sm text-ink-muted hidden sm:inline">
                · {country}
              </span>
            ) : null}
          </div>
          {/* Settings — navigation, so it's a styled <Link>, not a button.
              h-10 lines up with the Sign-out button next to it. */}
          <Link
            href="/settings"
            aria-label="Settings"
            className="inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-surface text-ink shadow-neu transition-all duration-300 ease-soft hover:-translate-y-0.5 hover:shadow-neu-hover active:translate-y-0 active:shadow-neu-inset-sm"
          >
            <GearIcon className="h-4 w-4" />
          </Link>
          <form action={signOutAction}>
            <Button type="submit" variant="secondary" size="sm" aria-label="Sign out">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
