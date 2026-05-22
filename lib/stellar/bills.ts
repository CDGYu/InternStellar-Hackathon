import {
  Asset,
  Horizon,
  Keypair,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

import { resolveInclusionFee } from "./contract";
import { NETWORK_PASSPHRASE } from "./network";

/**
 * Bill payment — plain Stellar transfers (not Soroban contract calls).
 *
 * Why this is a separate file from `contract.ts`:
 *   - The escrow flow uses Soroban contract calls via the soroban-rpc
 *     endpoint (`rpc.Server`). Bills go through the *Horizon* API
 *     instead — a payment op is a classic Stellar primitive that
 *     doesn't need contract surface.
 *   - Mixing the two clients in one file ends in import confusion;
 *     Horizon and rpc each export their own Server class.
 *
 * Production note: this transfers XLM from the OFW's demo signer to
 * the biller's Stellar testnet wallet. To actually settle as PHP at
 * Meralco/Maynilad, a Stellar Anchor (Cebuana / Tempo / Coins.ph)
 * handles the XLM↔PHP off-ramp + the legacy biller rails. That's
 * the partnership ask on slide 10 of the pitch deck.
 */

// ------------------------------------------------------------------
// Errors
// ------------------------------------------------------------------

export class BillsNotConfiguredError extends Error {
  constructor() {
    super(
      "STELLAR_DEMO_SECRET_KEY and/or STELLAR_HORIZON_URL is not set. " +
        "Run `npm run fund-test-account`, paste the secret into .env.local, " +
        "and restart `next dev`.",
    );
    this.name = "BillsNotConfiguredError";
  }
}

export class BillPaymentError extends Error {
  /** Friendly reason exposed in HTTP responses. */
  readonly reason: string;
  /** Internal detail for console.error only. */
  readonly detail?: unknown;

  constructor(reason: string, detail?: unknown) {
    super(reason);
    this.name = "BillPaymentError";
    this.reason = reason;
    this.detail = detail;
  }
}

// ------------------------------------------------------------------
// Config
// ------------------------------------------------------------------

interface BillsConfig {
  horizonUrl: string;
  signer: Keypair;
}

function loadConfig(): BillsConfig {
  const horizonUrl = process.env.STELLAR_HORIZON_URL;
  const signerSecret = process.env.STELLAR_DEMO_SECRET_KEY;
  if (!horizonUrl || !signerSecret) {
    throw new BillsNotConfiguredError();
  }
  let signer: Keypair;
  try {
    signer = Keypair.fromSecret(signerSecret);
  } catch {
    throw new BillsNotConfiguredError();
  }
  return { horizonUrl, signer };
}

// ------------------------------------------------------------------
// Stroops → XLM display string (7 decimal places, Stellar's precision)
// ------------------------------------------------------------------

const STROOPS_PER_XLM = 10_000_000n;

function stroopsToXlmString(amount: bigint): string {
  if (amount < 0n) throw new BillPaymentError("amount must be non-negative");
  const whole = amount / STROOPS_PER_XLM;
  const frac = amount % STROOPS_PER_XLM;
  const fracStr = frac.toString().padStart(7, "0");
  return `${whole}.${fracStr}`;
}

// ------------------------------------------------------------------
// payBill — submit a payment op, return the tx hash
// ------------------------------------------------------------------

export async function payBill(args: {
  billerAddress: string;
  amountStroops: bigint;
}): Promise<{ txHash: string }> {
  if (args.amountStroops <= 0n) {
    throw new BillPaymentError("amount_must_be_positive");
  }

  const { horizonUrl, signer } = loadConfig();
  const server = new Horizon.Server(horizonUrl);

  // Pull a fresh source account (sequence number is mandatory for tx build).
  let sourceAccount;
  try {
    sourceAccount = await server.loadAccount(signer.publicKey());
  } catch (err) {
    throw new BillPaymentError("source_account_not_found", err);
  }

  const xlmAmount = stroopsToXlmString(args.amountStroops);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: resolveInclusionFee(),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: args.billerAddress,
        asset: Asset.native(),
        amount: xlmAmount,
      }),
    )
    .setTimeout(60)
    .build();

  tx.sign(signer);

  try {
    const result = await server.submitTransaction(tx);
    return { txHash: result.hash };
  } catch (err) {
    // Horizon's error envelope: response.data.extras.result_codes is the
    // structured failure. Pull the first useful code so the HTTP response
    // is more diagnostic than "submit failed."
    const data = (err as any)?.response?.data;
    const opCode = data?.extras?.result_codes?.operations?.[0];
    const txCode = data?.extras?.result_codes?.transaction;
    const reason = opCode || txCode || "submit_failed";

    // Friendlier surface for the most common testnet hiccups.
    let friendly = reason;
    if (reason === "op_no_destination") {
      friendly =
        "biller_account_not_funded — the biller's Stellar account does not exist " +
        "on this network. Create/fund it first (testnet: Friendbot; mainnet: " +
        "send ≥1 XLM to the address to create it — there is no Friendbot).";
    } else if (reason === "op_underfunded" || reason === "tx_insufficient_balance") {
      friendly = "ofw_signer_underfunded — top up STELLAR_DEMO_SECRET_KEY";
    }
    throw new BillPaymentError(friendly, data ?? err);
  }
}
