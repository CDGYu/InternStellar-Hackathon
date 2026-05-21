import { createHash } from "node:crypto";

/**
 * Server-process-local "is this exact request already in flight?" tracker.
 *
 * Use case: family double-clicks "Confirm Delivery". First click hits
 * /api/escrow/release and starts a 5-10s chain call. Second click MUST
 * NOT also call release_escrow — the contract would either error
 * ("escrow already released") OR succeed against the next escrow id if
 * a race window opens. Either way, the UI shows confusion.
 *
 * This module gives every chain-modifying route a single line at the top:
 *
 *     const lock = beginIdempotent(["release", family_id, wishlist_id]);
 *     if (!lock) return err(409, "in_flight", "...", undefined, { requestId, retryAfterSeconds: 10 });
 *     try { ... do work ... } finally { lock.release(); }
 *
 * Storage is in-memory and per-process — fine for the demo's single Node
 * instance. The Map self-trims via the TTL sweep below so a crashed
 * handler doesn't deadlock subsequent calls (60s TTL > 30s chain poll
 * timeout = safe).
 */

const inFlight = new Map<string, number>();
const TTL_MS = 60_000;

function key(parts: ReadonlyArray<string>): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export interface IdempotencyLock {
  release(): void;
}

/** Returns a lock object on success, or null when the key is already locked. */
export function beginIdempotent(parts: ReadonlyArray<string>): IdempotencyLock | null {
  const k = key(parts);
  const now = Date.now();

  // Lazy sweep: drop stale entries on each call. O(n) but n is tiny.
  for (const [otherK, expiresAt] of inFlight) {
    if (expiresAt <= now) inFlight.delete(otherK);
  }

  if (inFlight.has(k)) return null;
  inFlight.set(k, now + TTL_MS);

  return {
    release() {
      inFlight.delete(k);
    },
  };
}
