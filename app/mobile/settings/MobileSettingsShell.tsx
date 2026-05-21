import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Mobile equivalent of components/ui/SettingsPageShell.tsx. Same shape
 * (back link + title + body card) but using the flat-card mobile
 * visual language instead of the web's neumorphic primitives.
 *
 * Sub-pages default to back-to-hub. The hub itself doesn't use this
 * shell — it has its own header that routes back to the user's
 * dashboard.
 */
type Props = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
};

export function MobileSettingsShell({
  title,
  description,
  children,
  backHref = "/mobile/settings",
  backLabel = "Back to settings",
}: Props) {
  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#1a1d2e] font-sans px-5 py-6 flex flex-col">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="inline-flex items-center gap-2 text-sm text-[#6b7280] mb-6 -ml-1 self-start"
      >
        <ArrowLeft className="w-4 h-4" />
        {backLabel}
      </Link>

      <div className="flex-1 max-w-md mx-auto w-full">
        <div className="bg-white rounded-3xl p-7 shadow-xl shadow-black/5">
          <div className="mb-6">
            <h2 className="text-lg font-extrabold tracking-tight">InternStellar</h2>
            <p className="text-[11px] text-[#6b7280] -mt-0.5">Settings</p>
          </div>

          <h1 className="text-2xl font-extrabold mb-1.5">{title}</h1>
          {description ? (
            <div className="text-sm text-[#6b7280] mb-6 leading-relaxed">
              {description}
            </div>
          ) : (
            <div className="mb-6" />
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
