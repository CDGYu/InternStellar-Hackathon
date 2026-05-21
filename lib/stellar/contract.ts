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

// Known panic strings P1's Day 4 contract throws. Used by extractPanicReason
// so the HTTP `reason` field is human-readable instead of an opaque hex code.
// Keep in sync with `internstellar-contract/contracts/internstellar/src/lib.rs`.
const KNOWN_PANIC_STRINGS = [
  "total must be positive",
  "percentages must sum to 100",
  "util overflow",
  "groc overflow",
  "emerg overflow",
  "escrow amount must be positive",
  "family cannot be store",
  "insufficient grocery balance",
  "groc underflow",
  "escrow id overflow",
  "escrow not found",
  "escrow already released",
  "store groc overflow",
];

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

// Race a promise against an AbortSignal so the call returns promptly when the
// signal aborts instead of blocking on a hanging HTTP request. The 15.x SDK
// does not natively accept an AbortSignal, so we can't cancel its in-flight
// fetch — but we can stop *waiting* on it and let the route return cleanly.
function abortable<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(
      new ContractCallError("contract_call_timeout", signal.reason),
    );
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () =>
      reject(new ContractCallError("contract_call_timeout", signal.reason));
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

async function invokeContract(
  method: string,
  args: xdr.ScVal[],
  externalSignal?: AbortSignal,
): Promise<InvokeResult> {
  const { rpcUrl, contractId, signer } = loadConfig();

  // Build an internal timeout signal; if the caller also supplies one (e.g.
  // `req.signal` to bail on client disconnect), abort on whichever fires first.
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`contract_call_timeout (${POLL_TIMEOUT_MS}ms)`)),
    POLL_TIMEOUT_MS,
  );
  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort(externalSignal.reason);
    else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    const server = new rpc.Server(rpcUrl);
    const contract = new Contract(contractId);

    let sourceAccount;
    try {
      sourceAccount = await abortable(
        server.getAccount(signer.publicKey()),
        controller.signal,
      );
    } catch (err) {
      if (err instanceof ContractCallError) throw err;
      throw new ContractCallError("source_account_not_found", err);
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
      prepared = await abortable(server.prepareTransaction(builtTx), controller.signal);
    } catch (err) {
      if (err instanceof ContractCallError) throw err;
      // prepareTransaction throws when simulation fails — typically a contract panic.
      const panicReason = extractPanicReason(err);
      throw new ContractCallError(panicReason ?? "contract_simulation_failed", err);
    }

    prepared.sign(signer);

    const send = await abortable(server.sendTransaction(prepared), controller.signal);
    if (send.status === "ERROR" || send.status === "TRY_AGAIN_LATER") {
      throw new ContractCallError(`send_${send.status.toLowerCase()}`, send);
    }

    // PENDING or DUPLICATE → poll until we see SUCCESS / FAILED or the
    // AbortController fires. No more Date.now() bookkeeping: the timeout and
    // any external cancel both flow through the same signal.
    while (!controller.signal.aborted) {
      const result = await abortable(server.getTransaction(send.hash), controller.signal);
      if (result.status === "SUCCESS") {
        return {
          txHash: send.hash,
          returnValue: result.returnValue ? scValToNative(result.returnValue) : undefined,
        };
      }
      if (result.status === "FAILED") {
        throw new ContractCallError("contract_call_failed", result);
      }
      await abortable(sleep(POLL_INTERVAL_MS), controller.signal);
    }

    throw new ContractCallError(
      "contract_call_timeout",
      `Did not see SUCCESS or FAILED for tx ${send.hash} within ${POLL_TIMEOUT_MS}ms`,
    );
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
  }
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
  const msg = err instanceof Error ? err.message : String(err);
  // First try the known panic strings list (literal substring match) — these
  // are what P1 throws in the Rust contract and are stable across SDK versions.
  for (const known of KNOWN_PANIC_STRINGS) {
    if (msg.includes(known)) return known;
  }
  // Fallback: regex for any quoted snake_case identifier the SDK surfaces.
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
 * Split an OFW deposit into three persistent buckets (util / groc / emerg).
 *
 * Contract signature:
 *   deposit_and_split(from: Address, total: i128,
 *                     pct_util: u32, pct_groc: u32, pct_emerg: u32)
 *     -> (util_share: i128, groc_share: i128, emerg_share: i128)
 *
 * Auth: `from.require_auth()` — for the server-signed flow, the depositor's
 * `profiles.stellar_public_key` must equal STELLAR_DEMO_SECRET_KEY's pubkey.
 */
export async function depositAndSplit(args: {
  fromAddress: string;
  totalStroops: bigint;
  pctUtil: number;
  pctGroc: number;
  pctEmerg: number;
}): Promise<{
  txHash: string;
  shares: { util: bigint; groc: bigint; emerg: bigint };
}> {
  // Validate args first (deterministic, no env needed) so callers get a
  // clear reason instead of stumbling over config errors on misuse.
  if (args.totalStroops <= 0n) {
    throw new ContractCallError("invalid_amount", args.totalStroops);
  }
  if (args.pctUtil + args.pctGroc + args.pctEmerg !== 100) {
    throw new ContractCallError("percentages must sum to 100", {
      pctUtil: args.pctUtil,
      pctGroc: args.pctGroc,
      pctEmerg: args.pctEmerg,
    });
  }
  loadConfig();
  const result = await invokeContract("deposit_and_split", [
    new Address(args.fromAddress).toScVal(),
    nativeToScVal(args.totalStroops, { type: "i128" }),
    nativeToScVal(args.pctUtil, { type: "u32" }),
    nativeToScVal(args.pctGroc, { type: "u32" }),
    nativeToScVal(args.pctEmerg, { type: "u32" }),
  ]);
  // Contract returns a 3-tuple (util, groc, emerg) as bigints via scValToNative.
  const tuple = result.returnValue as [bigint | string, bigint | string, bigint | string] | undefined;
  if (!tuple || tuple.length < 3) {
    throw new ContractCallError(
      "deposit_return_unexpected",
      "deposit_and_split did not return the expected 3-tuple of shares.",
    );
  }
  return {
    txHash: result.txHash,
    shares: {
      util: BigInt(tuple[0] as string | bigint),
      groc: BigInt(tuple[1] as string | bigint),
      emerg: BigInt(tuple[2] as string | bigint),
    },
  };
}

/**
 * Lock the family's grocery-bucket funds into escrow, addressed to a store.
 *
 * Contract signature (Day 4):
 *   lock_escrow(family: Address, store: Address, amount: i128) -> escrow_id (u32)
 *
 * Returns the on-chain TX hash + the contract's escrow id (u32).
 */
export async function lockEscrow(args: {
  familyAddress: string;
  storeAddress: string;
  amountStroops: bigint;
}): Promise<{ txHash: string; escrowId: unknown }> {
  // Validate args first (deterministic) — callers expect "family cannot be
  // store" / "invalid_amount" reasons even if env config is incomplete.
  if (args.amountStroops <= 0n) {
    throw new ContractCallError("invalid_amount", args.amountStroops);
  }
  if (args.familyAddress === args.storeAddress) {
    // Mirror the contract's own check so we save a round trip.
    throw new ContractCallError("family cannot be store");
  }
  loadConfig();
  const result = await invokeContract("lock_escrow", [
    new Address(args.familyAddress).toScVal(),
    new Address(args.storeAddress).toScVal(),
    nativeToScVal(args.amountStroops, { type: "i128" }),
  ]);
  return { txHash: result.txHash, escrowId: result.returnValue };
}

/**
 * Release escrowed funds (also credits the store's grocery bucket).
 *
 * Contract signature (Day 4):
 *   release_escrow(escrow_id: u32)
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
 * Read-only balance lookup.
 *
 * Contract signature:
 *   get_balances(user: Address) -> (util: i128, groc: i128, emerg: i128)
 */
export async function getBalances(args: {
  userAddress: string;
}): Promise<{ util: bigint; groc: bigint; emerg: bigint }> {
  loadConfig();
  const raw = await simulateContract("get_balances", [
    new Address(args.userAddress).toScVal(),
  ]);
  const tuple = raw as [bigint | string, bigint | string, bigint | string] | undefined;
  if (!tuple || tuple.length < 3) {
    throw new ContractCallError(
      "balances_return_unexpected",
      "get_balances did not return the expected 3-tuple.",
    );
  }
  return {
    util: BigInt(tuple[0] as string | bigint),
    groc: BigInt(tuple[1] as string | bigint),
    emerg: BigInt(tuple[2] as string | bigint),
  };
}

function convertEscrowIdToScVal(id: unknown): xdr.ScVal {
  // Day 4 contract uses u32 for escrow_id. Accept number/bigint/string-of-digits
  // so the route layer can pass whatever lock_escrow returned (and whatever
  // it stashed in the DB) without worrying about the exact JS type.
  if (typeof id === "number") {
    return nativeToScVal(id, { type: "u32" });
  }
  if (typeof id === "bigint") {
    return nativeToScVal(Number(id), { type: "u32" });
  }
  if (typeof id === "string") {
    const trimmed = id.trim();
    if (/^\d+$/.test(trimmed)) {
      return nativeToScVal(Number(trimmed), { type: "u32" });
    }
    // Last-resort: treat non-numeric strings as a symbol (P1 may change shape).
    return nativeToScVal(trimmed, { type: "symbol" });
  }
  if (id === undefined || id === null) {
    throw new ContractCallError(
      "escrow_id_missing",
      "Cannot call release_escrow without the escrow id returned by lock_escrow.",
    );
  }
  return nativeToScVal(id);
}
