"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { CheckCircleIcon } from "@/components/ui/icons";
import { apiPost } from "@/lib/api/client";

/**
 * Family-side "Confirm Delivery" button. Renders on a wishlist that's
 * in `delivered` status — clicking it fires POST /api/escrow/release,
 * which:
 *   1. calls release_escrow on Soroban (funds → store),
 *   2. updates wishlist.status to 'released',
 *   3. calls finalize_wishlist() to decrement inventory.stock.
 *
 * Two pieces of feedback: a pending button label, and an inline error
 * if the release fails. On success we router.refresh() to let the page
 * re-render — the wishlist row will now show up under "Delivered" with
 * a release_tx_hash.
 */
export function ConfirmDeliveryButton({
  familyId,
  wishlistId,
}: {
  familyId: string;
  wishlistId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function confirm() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiPost<{ tx_hash: string; status: string }>(
        "/api/escrow/release",
        { family_id: familyId, wishlist_id: wishlistId },
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // Refresh so the wishlist row jumps to "Released" group + the
      // activity feed shows the release event.
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
        onClick={confirm}
        disabled={submitting}
      >
        {submitting ? "Confirming…" : "Confirm delivery"}
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
