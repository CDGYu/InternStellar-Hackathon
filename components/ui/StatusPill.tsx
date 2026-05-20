import { cn } from "./cn";

/**
 * Maps a `wishlist.status` value to a pressed-in pill. Inset rather than
 * extruded because "status" semantically reads as a state stamped onto the
 * card, not a floating accessory.
 *
 * Status state machine (db/schema.sql):
 *   draft → pending_approval → locked → delivered → released   (terminal)
 *     └─→ cancelled
 *
 * Color discipline: we keep the surface monochromatic and let only the dot
 * carry the semantic color. Avoids the "rainbow chip" anti-pattern.
 */
export type WishlistStatus =
  | "draft"
  | "pending_approval"
  | "locked"
  | "delivered"
  | "released"
  | "cancelled";

const labels: Record<WishlistStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  locked: "In escrow",
  delivered: "Delivered",
  released: "Released",
  cancelled: "Cancelled",
};

// Dot color = signal color. Picked from existing accent tokens + a couple of
// muted greys; nothing brand-new introduced.
const dots: Record<WishlistStatus, string> = {
  draft: "bg-ink-muted",
  pending_approval: "bg-amber-400",
  locked: "bg-accent",
  delivered: "bg-accent-light",
  released: "bg-accent-teal",
  cancelled: "bg-ink-muted",
};

export function StatusPill({ status, className }: { status: WishlistStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
        "bg-surface text-ink shadow-neu-inset-sm",
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", dots[status])} aria-hidden />
      {labels[status]}
    </span>
  );
}

/** Same visual treatment but for settlement event types (deposit/lock/release). */
export type SettlementEvent = "deposit" | "lock" | "release";

const eventLabels: Record<SettlementEvent, string> = {
  deposit: "Deposit",
  lock: "Lock",
  release: "Release",
};

const eventDots: Record<SettlementEvent, string> = {
  deposit: "bg-accent-light",
  lock: "bg-accent",
  release: "bg-accent-teal",
};

export function EventPill({ event, className }: { event: SettlementEvent; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
        "bg-surface text-ink shadow-neu-inset-sm",
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", eventDots[event])} aria-hidden />
      {eventLabels[event]}
    </span>
  );
}
