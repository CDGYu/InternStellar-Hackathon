import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";

import { NETWORK_PASSPHRASE } from "./network";

// ------------------------------------------------------------------
// Errors
// ------------------------------------------------------------------

export class ContractNotConfiguredError extends Error {
  constructor() {
    super(
      "NEXT_PUBLIC_CONTRACT_ID and/or STELLAR_DEMO_SECRET_KEY is not set. " +
        "Coordinate with P1 (Prince) to confirm the deployed contract id, " +
        "then fill both vars in .env.local.",
    );
    this.name = "ContractNotConfiguredError";
  }
}

export class ContractCallError extends Error {
  // Friendly reason exposed in HTTP responses. Never include raw XDR here.
  readonly reason: string;
  // Internal detail for console.error only.
  readonly detail?: unknown;

  constructor(reason: string, detail?: unknown) {
    super(reason);
    this.name = "ContractCallError";
    this.reason = reason;
    this.detail = detail;
  }
}

// ------------------------------------------------------------------
// Config (read fresh each call so the dev server picks up .env edits
// without a restart)
// ------------------------------------------------------------------

interface Config {
  rpcUrl: string;
  contractId: string;
  signer: Keypair;
}

function loadConfig(): Config {
  const rpcUrl = process.env.STELLAR_RPC_URL;
  const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID;
  const secret = process.env.STELLAR_DEMO_SECRET_KEY;

  if (!rpcUrl) {
    throw new ContractCallError(
      "stellar_rpc_url_missing",
      "STELLAR_RPC_URL is not set",
    );
  }
  if (!contractId || !secret) {
    throw new ContractNotConfiguredError();
  }

  let signer: Keypair;
  try {
    signer = Keypair.fromSecret(secret);
  } catch (err) {
    throw new ContractCallError(
      "stellar_demo_secret_invalid",
      err,
    );
  }

  return { rpcUrl, contractId, signer };
}

// ------------------------------------------------------------------
// Internal: invoke a write contract method (build, prepare, sign, send, poll)
// ------------------------------------------------------------------

interface InvokeResult {
  /** On-chain transaction hash (hex). */
  txHash: string;
  /** The contract function's return value, decoded to a JS value. */
  returnValue: unknown;
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30_000;

async function invokeContract(
  method: string,
  args: xdr.ScVal[],
): Promise<InvokeResult> {
  const { rpcUrl, contractId, signer } = loadConfig();

  const server = new rpc.Server(rpcUrl);
  const contract = new Contract(contractId);

  let sourceAccount;
  try {
    sourceAccount = await server.getAccount(signer.publicKey());
  } catch (err) {
    throw new ContractCallError(
      "source_account_not_found",
      err,
    );
  }

  const builtTx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  let prepared;
  try {
    prepared = await server.prepareTransaction(builtTx);
  } catch (err) {
    // prepareTransaction throws when simulation fails — typically a contract panic.
    const panicReason = extractPanicReason(err);
    throw new ContractCallError(
      panicReason ?? "contract_simulation_failed",
      err,
    );
  }

  prepared.sign(signer);

  const send = await server.sendTransaction(prepared);
  if (send.status === "ERROR" || send.status === "TRY_AGAIN_LATER") {
    throw new ContractCallError(
      `send_${send.status.toLowerCase()}`,
      send,
    );
  }

  // PENDING or DUPLICATE → poll
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await server.getTransaction(send.hash);
    if (result.status === "SUCCESS") {
      return {
        txHash: send.hash,
        returnValue: result.returnValue
          ? scValToNative(result.returnValue)
          : undefined,
      };
    }
    if (result.status === "FAILED") {
      throw new ContractCallError("contract_call_failed", result);
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new ContractCallError(
    "contract_call_timeout",
    `Did not see SUCCESS or FAILED for tx ${send.hash} within ${POLL_TIMEOUT_MS}ms`,
  );
}

async function simulateContract(
  method: string,
  args: xdr.ScVal[],
): Promise<unknown> {
  const { rpcUrl, contractId, signer } = loadConfig();

  const server = new rpc.Server(rpcUrl);
  const contract = new Contract(contractId);

  let sourceAccount;
  try {
    sourceAccount = await server.getAccount(signer.publicKey());
  } catch (err) {
    throw new ContractCallError("source_account_not_found", err);
  }

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if ("error" in sim && sim.error) {
    const panic = extractPanicReason(sim.error);
    throw new ContractCallError(
      panic ?? "contract_simulation_failed",
      sim.error,
    );
  }
  const result = (sim as { result?: { retval: xdr.ScVal } }).result;
  return result?.retval ? scValToNative(result.retval) : undefined;
}

function extractPanicReason(err: unknown): string | null {
  // Soroban panic messages often look like:
  //   "HostError: Error(Contract, #N) ... debug_meta: \"insufficient_balance\""
  // We surface the readable token if we can find one, else null and the
  // caller falls back to a generic code.
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/[#"']([a-z][a-z_0-9]{2,40})[#"']/i);
  return match?.[1] ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ------------------------------------------------------------------
// Public API — one function per contract method P1 owns
// ------------------------------------------------------------------

/**
 * Lock the family's grocery-bucket funds into escrow.
 *
 * Contract signature (per DAY3-P2.md, pending P1 confirmation):
 *   lock_escrow(family: Address, amount: i128) -> escrow_id (any ScVal)
 *
 * Returns the on-chain TX hash + whatever the contract returned (often a
 * Symbol or u32 escrow id). Caller stores both for later release.
 */
export async function lockEscrow(args: {
  familyAddress: string;
  amountStroops: bigint;
}): Promise<{ txHash: string; escrowId: unknown }> {
  // Fail-fast on config so the operator sees "contract_not_configured" before
  // any arg-shape errors. invokeContract loads config again — cheap.
  loadConfig();
  if (args.amountStroops <= 0n) {
    throw new ContractCallError("invalid_amount", args.amountStroops);
  }
  const result = await invokeContract("lock_escrow", [
    new Address(args.familyAddress).toScVal(),
    nativeToScVal(args.amountStroops, { type: "i128" }),
  ]);
  return { txHash: result.txHash, escrowId: result.returnValue };
}

/**
 * Release escrowed funds to the store (called after family confirms delivery).
 *
 * Contract signature (per DAY3-P2.md, pending P1 confirmation):
 *   release_escrow(escrow_id: any) -> tx confirmation
 *
 * We pass the contract's own returned escrow id from lock. If P1 wants a
 * different format (e.g. the lock tx hash as Bytes), update the scVal cast
 * in convertEscrowIdToScVal below — that's the only thing that changes.
 */
export async function releaseEscrow(args: {
  escrowId: unknown;
}): Promise<{ txHash: string }> {
  loadConfig();
  const result = await invokeContract("release_escrow", [
    convertEscrowIdToScVal(args.escrowId),
  ]);
  return { txHash: result.txHash };
}

/**
 * Read-only balance lookup. Wired but not invoked by Day 3 routes — used by
 * the GET /api/balances/:user_id route on Day 4.
 *
 * Contract signature (per DAY3-P2.md, pending P1 confirmation):
 *   get_balances(user: Address) -> (util: i128, groc: i128, emerg: i128)
 */
export async function getBalances(args: {
  userAddress: string;
}): Promise<unknown> {
  loadConfig();
  return simulateContract("get_balances", [
    new Address(args.userAddress).toScVal(),
  ]);
}

function convertEscrowIdToScVal(id: unknown): xdr.ScVal {
  // P1's actual escrow id type is TBD until pair session. Handle the common
  // shapes so we don't have to change call sites later.
  if (typeof id === "string") {
    // Could be a Symbol or a hex/base64 string. Default to Symbol for
    // Soroban-friendly identifiers.
    return nativeToScVal(id, { type: "symbol" });
  }
  if (typeof id === "number" || typeof id === "bigint") {
    return nativeToScVal(id, { type: "u32" });
  }
  if (id === undefined || id === null) {
    throw new ContractCallError(
      "escrow_id_missing",
      "Cannot call release_escrow without the escrow id returned by lock_escrow.",
    );
  }
  // Fallback: let nativeToScVal infer.
  return nativeToScVal(id);
}
