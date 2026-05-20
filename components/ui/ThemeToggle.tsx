import { setThemeAction } from "@/app/theme/actions";
import type { Theme } from "@/lib/theme";

import { cn } from "./cn";
import { MoonIcon, SunIcon } from "./icons";

/**
 * Two-position segmented toggle for the dark mode setting.
 *
 * Server component — submits to a server action, which writes the cookie
 * and revalidates the layout. The whole page re-renders with the new
 * theme; no client JS, no localStorage, no FOUC.
 *
 * Each "position" is its own submit button inside a single form so the
 * pressed-state styling reads from the current `theme` prop (no client
 * state needed). The non-active button posts to swap; the active one
 * is disabled (clicking it would be a no-op).
 */
export function ThemeToggle({ theme }: { theme: Theme }) {
  return (
    <form action={setThemeAction} className="inline-flex bg-surface shadow-neu-inset-sm rounded-full p-1">
      <ThemeOption value="light" current={theme} label="Light" icon={<SunIcon className="h-4 w-4" />} />
      <ThemeOption value="dark"  current={theme} label="Dark"  icon={<MoonIcon className="h-4 w-4" />} />
    </form>
  );
}

function ThemeOption({
  value,
  current,
  label,
  icon,
}: {
  value: Theme;
  current: Theme;
  label: string;
  icon: React.ReactNode;
}) {
  const active = value === current;
  return (
    <button
      type="submit"
      name="theme"
      value={value}
      disabled={active}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
        "transition-all duration-300 ease-soft",
        active
          ? "bg-surface text-accent shadow-neu cursor-default"
          : "bg-transparent text-ink-muted hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
