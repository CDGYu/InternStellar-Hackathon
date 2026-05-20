"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Invisible client component that subscribes to Supabase Realtime
 * changes on `wishlist` and triggers a router.refresh() so the
 * server-rendered order queue re-fetches.
 *
 * Why a separate component:
 *   - The order queue rows are server-rendered (cleaner JSX, less JS
 *     shipped). Adding realtime to them inline would force the whole
 *     queue to become a client component.
 *   - Realtime is page-wide concern — one subscription serves every
 *     row, so it makes sense to mount it once at the page level.
 *
 * Debouncing: bursts of events (e.g. lock + settlement insert in the
 * same second) collapse into a single refresh. Without this we'd
 * thrash the server on every event.
 *
 * Prereq: db/realtime.sql has added `wishlist` + `wishlist_item` to the
 * `supabase_realtime` publication and set `replica identity full`.
 */
export function OrdersRealtimeRefresher() {
  const router = useRouter();
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    function scheduleRefresh() {
      if (pendingRef.current !== null) return;
      // 250ms is enough to collapse the typical lock-then-settlement
      // burst into one refresh, short enough to feel live.
      pendingRef.current = window.setTimeout(() => {
        pendingRef.current = null;
        router.refresh();
      }, 250);
    }

    const channel = supabase
      .channel("store-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wishlist" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settlement" },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (pendingRef.current !== null) {
        window.clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
