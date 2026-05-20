import { Keypair } from "@stellar/stellar-sdk";

const FRIENDBOT_URL = "https://friendbot.stellar.org";

async function main() {
  const kp = Keypair.random();
  const url = `${FRIENDBOT_URL}/?addr=${encodeURIComponent(kp.publicKey())}`;

  console.log(`Requesting Friendbot funding for ${kp.publicKey()} ...`);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    console.error(`Friendbot returned HTTP ${res.status}: ${body}`);
    process.exit(1);
  }

  console.log("\n=== Stellar testnet keypair funded ===");
  console.log(`Public key: ${kp.publicKey()}`);
  console.log(`Secret key: ${kp.secret()}`);
  console.log("\nAdd this line to .env.local (matches .env.example on main):");
  console.log(`STELLAR_DEMO_SECRET_KEY=${kp.secret()}`);
  console.log("\nThe secret stays on your machine. .env*.local is gitignored.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
