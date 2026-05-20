/**
 * "2 hours ago" style relative timestamps for the activity feed.
 *
 * Deliberately not internationalized — Intl.RelativeTimeFormat would add
 * polish but the dashboard text is otherwise plain English, so this keeps
 * the bundle small and the output predictable.
 */
export function timeAgo(input: string | Date, now: Date = new Date()): string {
  const then = typeof input === "string" ? new Date(input) : input;
  const seconds = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));

  if (seconds < 45) return "just now";
  if (seconds < 60 * 60) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 60 * 60 * 24) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 60 * 60 * 24 * 7) return `${Math.round(seconds / 86400)}d ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
