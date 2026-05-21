// In-process idempotency guard for chain-call routes.
//
// Use case: a family member double-clicks the "Lock escrow" button. The first
// click is mid-flight (10-30s on testnet), the second arrives while the first
// has not yet returned. Without a guard, both run, both succeed, the wishlist
// gets two settlement rows and the family is double-debited.
//
// This module keeps a Set of in-flight `(route, family_id, wishlist_id)` keys.
// `acquire(key)` returns a release function if the key is free; returns null
// if the key is currently held. Routes call `release()` in a `finally` so the
// guard clears even on errors.
//
// Scope: in-process only. A multi-instance deploy would need Redis or similar
// to coordinate across workers — for the Day 5 hackathon demo a single
// `next dev` instance is the only thing serving the API, so this is enough.
// Map state resets on dev-server restart, which is also the right behavior:
// any in-flight call from a crashed worker is gone.

const inFlight = new Set<string>();

export type IdempotencyKey = string;

/**
 * Try to acquire a slot for the given key. Returns a `release()` function if
 * the key was free; returns `null` if a request with the same key is already
 * in flight (caller should respond `409 in_flight`).
 *
 * The returned `release()` is idempotent — calling it twice is fine.
 */
export function acquireIdempotency(key: IdempotencyKey): (() => void) | null {
  if (inFlight.has(key)) return null;
  inFlight.add(key);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    inFlight.delete(key);
  };
}

/**
 * Build a stable idempotency key from a route name + ordered identifiers.
 * The route name keeps lock/release in separate namespaces so a release can
 * fire while a different wishlist is still mid-lock.
 */
export function makeKey(route: string, ...ids: string[]): IdempotencyKey {
  return `${route}:${ids.join("|")}`;
}
