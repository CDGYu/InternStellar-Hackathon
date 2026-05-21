import Link from "next/link";
import { Construction, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Phase-4 placeholder for the mobile store dashboard. signInAction
 * redirects a store caller to /store on success → middleware rewrites
 * to /mobile/store for mobile UAs — so a store user logging in on a
 * phone lands here. Until Phase 4 ships, point them at the desktop
 * site for the real dashboard.
 */
export default function MobileStorePage() {
  return (
    <div className="min-h-screen bg-[#f5f7fa] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-6">
        <Construction className="w-8 h-8 text-amber-600" />
      </div>
      <h1 className="text-2xl font-extrabold text-[#1a1d2e] mb-3">
        Store dashboard — coming soon
      </h1>
      <p className="text-[#6b7280] mb-8 max-w-sm leading-relaxed">
        The mobile store experience is still in build. For now, please use
        the desktop site to manage orders, inventory, and deliveries.
      </p>
      <Link
        href="/store"
        className="inline-flex items-center gap-2 bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] text-white font-semibold rounded-full px-6 py-3 shadow-lg shadow-[#5b7cff]/25 active:scale-[0.98] transition-transform"
      >
        Open desktop store
        <ExternalLink className="w-4 h-4" />
      </Link>
    </div>
  );
}
