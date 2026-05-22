import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, DM_Sans } from "next/font/google";

import { STELLAR_EXPLORER_BASE } from "@/lib/stellar/explorer";
import { ExplorerBaseProvider } from "@/lib/stellar/explorer-context";
import { getTheme } from "@/lib/theme";

import "./globals.css";

// next/font self-hosts the Google Fonts at build time and exposes them as CSS
// variables — those names are referenced by tailwind.config.ts (font-display
// and font-sans). `display: "swap"` matches the design-system note that says
// not to use `display=block`.
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "InternStellar — Chain Bridge",
  description: "Smart remittance escrow on Stellar / Soroban",
};

// Explicit responsive viewport. Next 14 ships `width=device-width` by default
// but not `initial-scale` — without it, iOS Safari can land at the wrong zoom
// on orientation change. `viewportFit: "cover"` lets `env(safe-area-inset-*)`
// resolve correctly inside notched displays.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the theme cookie server-side and apply `.dark` here so the HTML
  // ships pre-themed. Avoids the flash-of-wrong-theme that happens if you
  // detect on the client after hydration. See lib/theme.ts.
  const theme = await getTheme();

  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${theme === "dark" ? "dark" : ""}`}
    >
      <body>
        <ExplorerBaseProvider base={STELLAR_EXPLORER_BASE}>
          {children}
        </ExplorerBaseProvider>
      </body>
    </html>
  );
}
