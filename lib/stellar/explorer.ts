/**
 * Stellar Expert explorer base URL for UI links (e.g. `${STELLAR_EXPLORER_BASE}/tx/<hash>`).
 *
 * SDK-FREE on purpose. This module is imported by CLIENT components, so it must
 * NOT pull in `@stellar/stellar-sdk` (that lives in lib/stellar/network.ts and
 * would bloat the browser bundle).
 *
 * Network is read from NEXT_PUBLIC_STELLAR_NETWORK rather than STELLAR_NETWORK:
 * Next.js strips non-`NEXT_PUBLIC_` env vars from client bundles, so a client
 * component reading process.env.STELLAR_NETWORK gets `undefined` and would
 * silently pin every explorer link to testnet. The server-side STELLAR_NETWORK
 * remains as a fallback for server components. To get mainnet links in the
 * browser you MUST set NEXT_PUBLIC_STELLAR_NETWORK=public (or "mainnet") on the
 * deploy. Unset → testnet (correct default for local dev).
 */
const explorerNetwork = (
  process.env.NEXT_PUBLIC_STELLAR_NETWORK ??
  process.env.STELLAR_NETWORK ??
  "testnet"
).toLowerCase();

export const STELLAR_EXPLORER_BASE =
  explorerNetwork === "public" || explorerNetwork === "mainnet"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";
