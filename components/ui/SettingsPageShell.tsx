import type { ReactNode } from "react";

import { BackToHomeButton } from "./BackToHomeButton";
import { Card } from "./Card";
import { SparkleIcon } from "./icons";

/**
 * Common shell for /settings sub-pages: back-to-settings button top-left,
 * centered card containing brand mark + title + description + children.
 *
 * Top-level /settings uses BackToHomeButton with href="/" (default).
 * Sub-pages render this shell which overrides the back href to /settings.
 */
export function SettingsPageShell({
  title,
  description,
  children,
  backHref = "/settings",
  backLabel = "Back to settings",
  maxWidth = "max-w-2xl",
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  maxWidth?: string;
}) {
  return (
    <main className="relative min-h-screen flex items-start justify-center px-4 py-16">
      <BackToHomeButton href={backHref} label={backLabel} />

      <Card className={`w-full ${maxWidth} p-8 md:p-12`}>
        <div className="flex items-center gap-3 mb-10">
          <div className="h-11 w-11 rounded-2xl bg-surface shadow-neu flex items-center justify-center text-accent">
            <SparkleIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-base font-extrabold tracking-tight text-ink">
              InternStellar
            </p>
            <p className="text-xs text-ink-muted -mt-0.5">Settings</p>
          </div>
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-ink">
          {title}
        </h1>
        {description ? (
          <div className="mt-2 text-ink-muted leading-relaxed">{description}</div>
        ) : null}

        <div className="mt-8">{children}</div>
      </Card>
    </main>
  );
}
