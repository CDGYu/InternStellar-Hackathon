import { createHash } from "node:crypto";

import { getSupabaseAdmin } from "../supabase-admin";

/**
 * Cross-replica "is this exact request already in flight?" tracker.
 *
 * Use case: family double-clicks "Confirm Delivery". First click hits
 * /api/escrow/release and starts a 5-10s chain call. Second click MUST
 * NOT also call release_escrow — the contract would either error
 * ("escrow already released") OR succeed against the next escrow id if
 * a race window opens. Either way, the UI shows confusion.
 *
 * Backed by Postgres (`request_lock` + try_idempotency_lock RPC) so the
 * dedup is shared across all Node replicas behind a load balancer. The
 * RPC implements INSERT … ON CONFLICT semantics with a TTL safety net so
 * a crashed handler can't deadlock retries (60s TTL > 30s chain poll
 * timeout = safe).
 *
 * Every chain-modifying route uses this at the top:
 *
 *     const lock = await beginIdempotent(["release", family_id, wishlist_id]);
 *     if (!lock) return err(409, "in_flight", "...", undefined, { requestId, retryAfterSeconds: 10 });
 *     try { ... do work ... } finally { await lock.release(); }
 */

const TTL_SECONDS = 60;

function key(parts: ReadonlyArray<string>): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export interface IdempotencyLock {
  release(): Promise<void>;
}

/** Returns a lock object on success, or null when the key is already locked. */
export async function beginIdempotent(
  parts: ReadonlyArray<string>,
): Promise<IdempotencyLock | null> {
  const k = key(parts);

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    // If the admin client can't initialize, fail closed — better to reject
    // the request than to silently disable dedup and risk a double on-chain call.
    console.error("[idempotency] Supabase admin init failed:", e);
    return null;
  }

  const { data, error } = await supabase.rpc("try_idempotency_lock", {
    p_key: k,
    p_ttl_seconds: TTL_SECONDS,
  });
  if (error) {
    console.error("[idempotency] try_idempotency_lock RPC failed:", error);
    return null;
  }
  if (data !== true) return null;

  return {
    async release() {
      const { error: relErr } = await supabase.rpc("release_idempotency_lock", {
        p_key: k,
      });
      if (relErr) {
        // The TTL will eventually free the key, so a release failure is
        // recoverable — log and move on rather than throwing into the route's
        // finally block.
        console.error("[idempotency] release_idempotency_lock RPC failed:", relErr);
      }
    },
  };
}
