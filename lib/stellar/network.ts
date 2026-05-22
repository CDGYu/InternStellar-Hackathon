import { Networks } from "@stellar/stellar-sdk";

// Network selection is env-driven so a single build can target testnet (local
// dev, hackathon rehearsals) or mainnet (live demo) without recompiling. The
// historical default is `testnet` to keep existing scripts and the rehearsal
// runbook working unchanged when no env vars are set.
//
// Priority order:
//   1. STELLAR_NETWORK_PASSPHRASE (explicit override, wins if present)
//   2. STELLAR_NETWORK="public" | "mainnet" → Networks.PUBLIC
//   3. STELLAR_NETWORK="testnet" or unset → Networks.TESTNET (default)
//
// The `STELLAR_NETWORK` label is also exported so callers (UI explorer links,
// scripts, error messages) can switch on the network without re-parsing the
// passphrase string.

// Exported (vs. inlined) so tests can pass a fake env object and verify both
// branches without spawning a subprocess. Production code paths use the
// cached constants below; tests should only call resolveNetwork() directly.
//
// The param is the minimal shape we read rather than NodeJS.ProcessEnv: under
// Next.js's global type augmentation ProcessEnv requires NODE_ENV, which would
// otherwise force every test caller to pass a full env just to exercise two
// keys. `process.env` is structurally assignable to this shape.
export function resolveNetwork(
  env: Record<string, string | undefined> = process.env,
): { label: "testnet" | "public"; passphrase: string } {
  const explicitPassphrase = env.STELLAR_NETWORK_PASSPHRASE;
  const label = (env.STELLAR_NETWORK ?? "testnet").toLowerCase();

  const isPublic =
    label === "public" ||
    label === "mainnet" ||
    explicitPassphrase === Networks.PUBLIC;

  if (explicitPassphrase) {
    return {
      label: isPublic ? "public" : "testnet",
      passphrase: explicitPassphrase,
    };
  }

  return isPublic
    ? { label: "public", passphrase: Networks.PUBLIC }
    : { label: "testnet", passphrase: Networks.TESTNET };
}

const resolved = resolveNetwork();

export const STELLAR_NETWORK = resolved.label;
export const NETWORK_PASSPHRASE = resolved.passphrase;

// Stellar Expert base URL for the active network. UI explorer links should
// import this instead of hardcoding "/explorer/testnet/..." so flipping to
// mainnet via env var rewrites every link in the app.
export const STELLAR_EXPLORER_BASE =
  resolved.label === "public"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";
