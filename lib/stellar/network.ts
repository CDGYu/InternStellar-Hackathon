import { Networks } from "@stellar/stellar-sdk";

// Stellar network selection. Both vars come from .env.local / Vercel env;
// we keep the testnet fallback so a freshly-cloned dev environment still
// boots without these set. To flip to mainnet, set:
//   STELLAR_NETWORK="mainnet"
//   STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
//   STELLAR_RPC_URL=<a mainnet Soroban RPC>
//   STELLAR_HORIZON_URL="https://horizon.stellar.org"
// and redeploy. No code change required.
export const STELLAR_NETWORK: string =
  process.env.STELLAR_NETWORK ?? "testnet";

export const NETWORK_PASSPHRASE: string =
  process.env.STELLAR_NETWORK_PASSPHRASE ?? Networks.TESTNET;
