#!/usr/bin/env bash
# Golden Path live demo via the stellar CLI.
#
# Drives deposit → lock → release end-to-end on testnet so P1 can fall back
# to a CLI demo if the UI breaks during the pitch. One file, one command:
#
#     bash internstellar-contract/scripts/demo.sh
#
# Idempotent: re-running uses the same `internstellar` / `internstellar-store`
# identities and only re-funds via Friendbot if the family account does not
# yet exist on Horizon. The escrow id increments each run (1, 2, 3, …) since
# the contract's NextEscrowId is per-contract, not per-script-run — that is
# expected and noted in the final output.

set -euo pipefail

# ---- config ---------------------------------------------------------------
NETWORK="${STELLAR_NETWORK_NAME:-testnet}"
CONTRACT_ID="${NEXT_PUBLIC_CONTRACT_ID:-CB3VGM6SU3RRJLRJMT7CRX36ARKCH222ZKGKVPMS2DU5MIAHKUFZGRDF}"
FAMILY_ID="${FAMILY_ID:-internstellar}"
STORE_ID="${STORE_ID:-internstellar-store}"
HORIZON="https://horizon-testnet.stellar.org"
RPC_URL="https://soroban-testnet.stellar.org"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
EXPLORER_BASE="https://stellar.expert/explorer/testnet/tx"

DEPOSIT_TOTAL=10000000000   # 1000 XLM in stroops
EXPECTED_UTIL=6000000000
EXPECTED_GROC=3000000000
EXPECTED_EMERG=1000000000
LOCK_AMOUNT=2000000000      # 200 XLM in stroops

# ---- helpers --------------------------------------------------------------
need() { command -v "$1" >/dev/null 2>&1 || { echo "✗ Missing required CLI: $1"; exit 1; }; }
need stellar
need jq
need curl

step() { echo ""; echo "── $* ──"; }

# Parse the return value of `stellar contract invoke`. The CLI prints i128
# tuples as a JSON array of stringified integers, e.g. ["600","300","100"].
# Compare against an expected triple, fail loudly on mismatch.
assert_triple() {
  local label=$1 actual=$2 e_util=$3 e_groc=$4 e_emerg=$5
  local a_util a_groc a_emerg
  a_util=$(echo "$actual"  | jq -r '.[0] // empty')
  a_groc=$(echo "$actual"  | jq -r '.[1] // empty')
  a_emerg=$(echo "$actual" | jq -r '.[2] // empty')
  if [ "$a_util" = "$e_util" ] && [ "$a_groc" = "$e_groc" ] && [ "$a_emerg" = "$e_emerg" ]; then
    echo "  ✓ $label = ($a_util, $a_groc, $a_emerg)"
  else
    echo "  ✗ $label mismatch"
    echo "    expected: ($e_util, $e_groc, $e_emerg)"
    echo "    actual:   ($a_util, $a_groc, $a_emerg)"
    exit 1
  fi
}

# Horizon's latest tx for a given account. Run *right after* an invoke so the
# tx we just submitted is the head record.
latest_tx_hash() {
  local pk=$1
  curl -s "$HORIZON/accounts/$pk/transactions?order=desc&limit=1" \
    | jq -r '._embedded.records[0].hash // empty'
}

# ---- 1. network + identities --------------------------------------------
if ! stellar network ls 2>/dev/null | grep -q "^${NETWORK}$"; then
  step "Registering network: $NETWORK"
  stellar network add "$NETWORK" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" >/dev/null
fi

for id in "$FAMILY_ID" "$STORE_ID"; do
  if ! stellar keys ls 2>/dev/null | grep -q "^${id}$"; then
    step "Generating identity: $id"
    stellar keys generate "$id" --network "$NETWORK" --fund >/dev/null
  fi
done

FAMILY_PK=$(stellar keys public-key "$FAMILY_ID")
STORE_PK=$(stellar keys public-key "$STORE_ID")

if ! curl -s -f "$HORIZON/accounts/$FAMILY_PK" >/dev/null 2>&1; then
  step "Friendbot-funding $FAMILY_ID ($FAMILY_PK)"
  curl -s "https://friendbot.stellar.org/?addr=$FAMILY_PK" >/dev/null
fi

echo ""
echo "Network:   $NETWORK"
echo "Contract:  $CONTRACT_ID"
echo "Family:    $FAMILY_PK"
echo "Store:     $STORE_PK"

# ---- 2. deposit_and_split  60/30/10  of 1000 XLM --------------------------
step "deposit_and_split  total=$DEPOSIT_TOTAL  60/30/10"
DEPOSIT_OUT=$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$FAMILY_ID" \
  --network "$NETWORK" \
  -- deposit_and_split \
  --from "$FAMILY_PK" \
  --total "$DEPOSIT_TOTAL" \
  --pct_util 60 --pct_groc 30 --pct_emerg 10)
DEPOSIT_HASH=$(latest_tx_hash "$FAMILY_PK")
assert_triple "deposit shares" "$DEPOSIT_OUT" "$EXPECTED_UTIL" "$EXPECTED_GROC" "$EXPECTED_EMERG"

# ---- 3. get_balances(family) → (6e9, 3e9, 1e9) ---------------------------
step "get_balances(family)"
FAM_BAL=$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$FAMILY_ID" \
  --network "$NETWORK" \
  --send=no \
  -- get_balances --user "$FAMILY_PK")
assert_triple "family balances" "$FAM_BAL" "$EXPECTED_UTIL" "$EXPECTED_GROC" "$EXPECTED_EMERG"

# ---- 4. lock_escrow → returns escrow_id ----------------------------------
step "lock_escrow  family→store  amount=$LOCK_AMOUNT"
LOCK_OUT=$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$FAMILY_ID" \
  --network "$NETWORK" \
  -- lock_escrow \
  --family "$FAMILY_PK" \
  --store "$STORE_PK" \
  --amount "$LOCK_AMOUNT")
LOCK_HASH=$(latest_tx_hash "$FAMILY_PK")
ESCROW_ID=$(echo "$LOCK_OUT" | tr -d '"')
echo "  ✓ escrow_id = $ESCROW_ID"

# ---- 5. get_balances(family) → groc should be 1e9 (3e9 - 2e9) ------------
step "get_balances(family) after lock"
FAM_BAL_AFTER=$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$FAMILY_ID" \
  --network "$NETWORK" \
  --send=no \
  -- get_balances --user "$FAMILY_PK")
EXPECTED_GROC_AFTER_LOCK=$((EXPECTED_GROC - LOCK_AMOUNT))
assert_triple "family balances post-lock" "$FAM_BAL_AFTER" \
  "$EXPECTED_UTIL" "$EXPECTED_GROC_AFTER_LOCK" "$EXPECTED_EMERG"

# ---- 6. release_escrow ---------------------------------------------------
step "release_escrow  id=$ESCROW_ID"
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$FAMILY_ID" \
  --network "$NETWORK" \
  -- release_escrow --escrow_id "$ESCROW_ID" >/dev/null
RELEASE_HASH=$(latest_tx_hash "$FAMILY_PK")
echo "  ✓ released"

# ---- 7. get_balances(store) → (0, lock_amount, 0) ------------------------
step "get_balances(store)"
STORE_BAL=$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$FAMILY_ID" \
  --network "$NETWORK" \
  --send=no \
  -- get_balances --user "$STORE_PK")
# Store balances are *cumulative* across re-runs of this script, so we can't
# assert a fixed value here — only that groc >= the lock amount we just
# released. (The first run will see exactly LOCK_AMOUNT; subsequent runs see
# k * LOCK_AMOUNT after k releases.)
STORE_GROC=$(echo "$STORE_BAL" | jq -r '.[1] // empty')
STORE_UTIL=$(echo "$STORE_BAL" | jq -r '.[0] // empty')
STORE_EMERG=$(echo "$STORE_BAL" | jq -r '.[2] // empty')
if [ "$STORE_UTIL" != "0" ] || [ "$STORE_EMERG" != "0" ]; then
  echo "  ✗ store util/emerg should both be 0, got util=$STORE_UTIL emerg=$STORE_EMERG"
  exit 1
fi
if [ "$STORE_GROC" -lt "$LOCK_AMOUNT" ]; then
  echo "  ✗ store groc=$STORE_GROC, expected >= $LOCK_AMOUNT"
  exit 1
fi
echo "  ✓ store balances = (0, $STORE_GROC, 0)"

# ---- 8. tx hash receipt --------------------------------------------------
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  Golden Path complete ✓"
echo "════════════════════════════════════════════════════════════════════"
echo "  Deposit:  $EXPLORER_BASE/$DEPOSIT_HASH"
echo "  Lock:     $EXPLORER_BASE/$LOCK_HASH"
echo "  Release:  $EXPLORER_BASE/$RELEASE_HASH"
echo "════════════════════════════════════════════════════════════════════"
