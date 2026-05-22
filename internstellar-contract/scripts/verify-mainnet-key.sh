#!/usr/bin/env bash
# Quick local check: organizer CLI identity exists and pubkey matches.
# No network calls — safe to run anywhere.
#
#   bash internstellar-contract/scripts/verify-mainnet-key.sh
#
# Optional: pass the expected public key (defaults to the hackathon wallet).
#   bash internstellar-contract/scripts/verify-mainnet-key.sh GXXXX...

set -euo pipefail

ORG_ID="${ORG_ID:-internstellar-mainnet}"
EXPECTED_PK="${1:-GBASZKU4ICS7Z2PN6NXWRYRVNIWEA52ERD4YDQ6YAYQSLEJWGEOY5RCI}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "✗ Missing: $1"; exit 1; }; }
need stellar

echo "── Stellar CLI key check ──"
echo "  Identity alias:  ${ORG_ID}"

if ! stellar keys ls 2>/dev/null | grep -qx "${ORG_ID}"; then
  echo "  ✗ Identity '${ORG_ID}' not found."
  echo "    Run:  stellar keys add ${ORG_ID} --secret-key"
  exit 1
fi

ACTUAL_PK=$(stellar keys public-key "${ORG_ID}")
echo "  Public key:      ${ACTUAL_PK}"

if [ "${ACTUAL_PK}" != "${EXPECTED_PK}" ]; then
  echo "  ✗ Pubkey mismatch."
  echo "    Expected: ${EXPECTED_PK}"
  exit 1
fi

echo "  ✓ Pubkey matches organizer wallet"

# Secret is present if `stellar keys secret` succeeds (do not print the secret).
if stellar keys secret "${ORG_ID}" >/dev/null 2>&1; then
  echo "  ✓ Secret key is stored for this identity"
else
  echo "  ✗ Could not read secret for '${ORG_ID}' (re-add with --secret-key)"
  exit 1
fi

echo ""
echo "── Mainnet RPC config (optional) ──"
if stellar network ls --long 2>/dev/null | grep -A1 "^Name: mainnet" | grep -q "soroban-rpc.mainnet.stellar.gateway.fm"; then
  echo "  ✓ mainnet network has a real Soroban RPC URL configured"
else
  echo "  ⚠ mainnet RPC may still be the CLI placeholder. Before deploy, run:"
  echo "      stellar network rm mainnet"
  echo "      stellar network add mainnet \\"
  echo "        --rpc-url https://soroban-rpc.mainnet.stellar.gateway.fm \\"
  echo "        --network-passphrase \"Public Global Stellar Network ; September 2015\""
  echo "    Or deploy with explicit flags (deploy-mainnet.sh does this automatically)."
fi

echo ""
echo "Local checks passed. Next: deploy on mainnet (costs real XLM):"
echo "  cd internstellar-contract && bash scripts/deploy-mainnet.sh"
