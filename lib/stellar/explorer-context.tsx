"use client";

import { createContext, useContext, type ReactNode } from "react";

import { STELLAR_EXPLORER_BASE as DEFAULT_BASE } from "./explorer";

/**
 * Carries the Stellar Expert base URL from the SERVER (where STELLAR_NETWORK is
 * readable at runtime) down to CLIENT components.
 *
 * Client components can't tell testnet from mainnet on their own: Next.js
 * strips non-`NEXT_PUBLIC_` env vars from the browser bundle, so a client-side
 * read of STELLAR_NETWORK is `undefined` and explorer links fall back to
 * testnet. The root layout (a server component) resolves the base once and
 * passes it through this provider, so client links match the deployed network
 * WITHOUT needing a separate NEXT_PUBLIC_STELLAR_NETWORK var.
 *
 * Server components don't need this — they import STELLAR_EXPLORER_BASE from
 * ./explorer directly (it reads STELLAR_NETWORK at runtime).
 */
const ExplorerBaseContext = createContext<string>(DEFAULT_BASE);

export function ExplorerBaseProvider({
  base,
  children,
}: {
  base: string;
  children: ReactNode;
}) {
  return (
    <ExplorerBaseContext.Provider value={base}>
      {children}
    </ExplorerBaseContext.Provider>
  );
}

export function useExplorerBase(): string {
  return useContext(ExplorerBaseContext);
}
