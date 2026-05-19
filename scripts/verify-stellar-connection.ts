import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getHorizonServer } from "../lib/stellar/client";
import { NETWORK_PASSPHRASE, STELLAR_NETWORK } from "../lib/stellar/network";

function loadEnvLocal(): void {
  let content: string;
  try {
    content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  } catch {
    return;
  }
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();

  const horizonUrl = process.env.STELLAR_HORIZON_URL ?? "(unset)";
  const server = getHorizonServer();
  const page = await server.ledgers().order("desc").limit(1).call();
  const latest = page.records[0];

  console.log(JSON.stringify(
    {
      network: STELLAR_NETWORK,
      passphrase: NETWORK_PASSPHRASE,
      horizon: horizonUrl,
      latest_ledger: latest?.sequence,
      closed_at: latest?.closed_at,
    },
    null,
    2,
  ));
}

main().catch((err) => {
  console.error("Verification failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
