import "server-only";

import { Keypair } from "@stellar/stellar-sdk";

import { NETWORK_PASSPHRASE } from "./stellar/network";
import { getSupabaseAdmin } from "./supabase-admin";

/**
 * Deployment-health probes, shared between:
 *   - the JSON probe at /api/health
 *   - the humanized /status page
 *
 * Every probe is wrapped in try/catch so a misconfigured deploy returns a
 * useful report instead of a server-side exception. Values of secrets are
 * NEVER returned in the report (only "ok" / "missing" presence).
 */

export interface EnvSpec {
  key: string;
  group: "supabase" | "stellar";
  /** Non-secret (NEXT_PUBLIC_* or constants). Safe to display in the UI. */
  public: boolean;
}

export const ENV_SPEC: readonly EnvSpec[] = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", group: "supabase", public: true },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", group: "supabase", public: true },
  { key: "SUPABASE_SERVICE_ROLE_KEY", group: "supabase", public: false },
  { key: "STELLAR_NETWORK", group: "stellar", public: true },
  { key: "STELLAR_RPC_URL", group: "stellar", public: true },
  { key: "STELLAR_HORIZON_URL", group: "stellar", public: true },
  { key: "STELLAR_NETWORK_PASSPHRASE", group: "stellar", public: true },
  { key: "NEXT_PUBLIC_CONTRACT_ID", group: "stellar", public: true },
  { key: "STELLAR_DEMO_SECRET_KEY", group: "stellar", public: false },
];

export type ProbeStatus = "ok" | "skipped" | "error";

export interface BaseProbe {
  status: ProbeStatus;
  reason?: string;
}
export interface StellarRpcProbe extends BaseProbe {
  passphrase?: string;
  passphrase_matches?: boolean;
  protocol_version?: number | null;
}
export interface StellarSignerProbe extends BaseProbe {
  public_key?: string;
}
export interface StellarContractProbe extends BaseProbe {
  contract_id?: string;
}

export interface HealthReport {
  ok: boolean;
  chain: "ok" | "unconfigured";
  db: "ok" | "err";
  contract_id?: string;
  checks: {
    env: Record<string, "ok" | "missing">;
    supabase_admin: BaseProbe;
    stellar_rpc: StellarRpcProbe;
    stellar_signer: StellarSignerProbe;
    stellar_contract_id: StellarContractProbe;
  };
}

// 5s upper bound on the RPC round-trip — the health route is called on
// every dashboard load, so a slow / unreachable RPC must not block render.
const STELLAR_RPC_TIMEOUT_MS = 5000;

async function probeStellarRpc(
  rpcUrl: string,
  expectedPassphrase: string,
): Promise<StellarRpcProbe> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error("rpc_timeout")),
    STELLAR_RPC_TIMEOUT_MS,
  );
  try {
    const resp = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getNetwork" }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      return { status: "error", reason: `rpc_http_${resp.status}` };
    }
    const json = (await resp.json()) as {
      result?: {
        passphrase?: string;
        protocolVersion?: number;
        friendbotUrl?: string;
      };
      error?: unknown;
    };
    if (json.error) {
      return { status: "error", reason: "rpc_returned_error" };
    }
    const passphrase = json.result?.passphrase;
    if (!passphrase) {
      return { status: "error", reason: "rpc_no_passphrase_in_response" };
    }
    return {
      status: "ok",
      passphrase,
      passphrase_matches: passphrase === expectedPassphrase,
      protocol_version: json.result?.protocolVersion ?? null,
    };
  } catch (e) {
    const reason =
      e instanceof Error ? e.message.slice(0, 120) : "rpc_fetch_failed";
    return { status: "error", reason };
  } finally {
    clearTimeout(timer);
  }
}

function probeStellarSigner(secret: string | undefined): StellarSignerProbe {
  if (!secret) return { status: "skipped", reason: "env_missing" };
  try {
    const kp = Keypair.fromSecret(secret);
    return { status: "ok", public_key: kp.publicKey() };
  } catch {
    return { status: "error", reason: "invalid_secret_format" };
  }
}

function probeStellarContractId(
  contractId: string | undefined,
): StellarContractProbe {
  if (!contractId) return { status: "skipped", reason: "env_missing" };
  // Soroban contract ids are 56-char base32 strings starting with `C`.
  if (!/^C[A-Z2-7]{55}$/.test(contractId)) {
    return { status: "error", reason: "invalid_format" };
  }
  return { status: "ok", contract_id: contractId };
}

async function probeSupabaseAdmin(): Promise<BaseProbe> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("inventory")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (error) {
      console.error("[health] supabase probe failed:", error);
      return { status: "error", reason: error.message.slice(0, 200) };
    }
    return { status: "ok" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "supabase_init_failed";
    console.error("[health] supabase init failed:", e);
    return { status: "error", reason: msg.slice(0, 200) };
  }
}

/**
 * Build a full health report. Never throws — every probe is isolated.
 */
export async function buildHealthReport(): Promise<HealthReport> {
  // ---- Env-var presence (no values echoed) -------------------------
  const env: Record<string, "ok" | "missing"> = {};
  for (const spec of ENV_SPEC) {
    env[spec.key] = process.env[spec.key] ? "ok" : "missing";
  }

  // ---- Probes (run in parallel where possible) ----------------------
  const rpcUrl = process.env.STELLAR_RPC_URL;
  const expectedPassphrase =
    process.env.STELLAR_NETWORK_PASSPHRASE || NETWORK_PASSPHRASE;
  const [supabaseAdmin, stellarRpc] = await Promise.all([
    probeSupabaseAdmin(),
    rpcUrl
      ? probeStellarRpc(rpcUrl, expectedPassphrase)
      : Promise.resolve<StellarRpcProbe>({
          status: "skipped",
          reason: "env_missing",
        }),
  ]);
  const stellarSigner = probeStellarSigner(
    process.env.STELLAR_DEMO_SECRET_KEY,
  );
  const stellarContractId = probeStellarContractId(
    process.env.NEXT_PUBLIC_CONTRACT_ID,
  );

  // ---- Back-compat top-level summary (chain | db) -------------------
  // `chain` is two-state for legacy /api/health callers. Detailed reason
  // lives in checks.* and the /status page surfaces it.
  const chainEnvOk =
    env.NEXT_PUBLIC_CONTRACT_ID === "ok" &&
    env.STELLAR_RPC_URL === "ok" &&
    env.STELLAR_DEMO_SECRET_KEY === "ok";
  const chainProbesOk =
    stellarSigner.status === "ok" &&
    stellarContractId.status === "ok" &&
    stellarRpc.status === "ok" &&
    stellarRpc.passphrase_matches !== false;
  const chain: "ok" | "unconfigured" =
    chainEnvOk && chainProbesOk ? "ok" : "unconfigured";

  const db: "ok" | "err" = supabaseAdmin.status === "ok" ? "ok" : "err";
  const allGreen = chain === "ok" && db === "ok";

  const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID;
  return {
    ok: allGreen,
    chain,
    db,
    ...(contractId ? { contract_id: contractId } : {}),
    checks: {
      env,
      supabase_admin: supabaseAdmin,
      stellar_rpc: stellarRpc,
      stellar_signer: stellarSigner,
      stellar_contract_id: stellarContractId,
    },
  };
}
