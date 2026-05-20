"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { CheckCircleIcon } from "@/components/ui/icons";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Store-side "Mark as Delivered" button.
 *
 * Flips wishlist.status from 'locked' → 'delivered'. No chain call —
 * the contract release fires when the FAMILY confirms delivery on
 * their dashboard. This button is the off-chain signal that lets the
 * family know "your order arrived; you can confirm now."
 *
 * Uses a cookie-bound Supabase update. The Day-5 RLS policy
 * `store_updates_wishlist` gates this on the caller having role='store'.
 */
export function MarkDeliveredButton({ wishlistId }: { wishlistId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function markDelivered() {
    setError(null);
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: uErr } = await supabase
        .from("wishlist")
        .update({
          status: "delivered",
          updated_at: new Date().toISOString(),
        })
        .eq("id", wishlistId);
      if (uErr) {
        setError(uErr.message);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 shrink-0">
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={markDelivered}
        disabled={submitting}
      >
        {submitting ? "Marking…" : "Mark as delivered"}
        {submitting ? null : <CheckCircleIcon className="h-4 w-4" />}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-red-500 text-right max-w-[18rem]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
