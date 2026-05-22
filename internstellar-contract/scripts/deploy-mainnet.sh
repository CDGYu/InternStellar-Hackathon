#!/usr/bin/env bash
# Mainnet deployer for the InternStellar Soroban contract.
#
#   bash internstellar-contract/scripts/deploy-mainnet.sh
#
# Why this is a separate file from demo.sh:
#   - demo.sh is the testnet rehearsal fallback for the pitch and stays
#     untouched so Day-5/6 rehearsals keep working unchanged.
#   - Mainnet needs different behavior at every step: no Friendbot, real
#     XLM fees, a pre-funded organizer identity, and a store pubkey that
#     is *generated locally and discarded* (the store never signs).
#
# Preconditions (the script aborts loudly if any fail):
#   1. Stellar CLI >= 22 installed (`stellar --version`).
#   2. The organizer key has been added to the CLI once:
#        stellar keys add internstellar-mainnet --secret-key
#      (the CLI prompts for the secret interactively; nothing is logged).
#   3. The organizer account is funded with enough mainnet XLM to cover
#      contract upload + deploy + 3 smoke invocations. Keep at least 30 XLM;
#      the script bails before spending if balance < MIN_XLM.
#   4. The contract WASM has already been built (`stellar contract build`
#      from `internstellar-contract/`) or this script will build it.
#
# Idempotent in the "safe" places only: it will re-use an existing
# internstellar-mainnet identity and an existing store identity, but every
# `stellar contract deploy` produces a fresh contract id by design and
# *costs real XLM* — re-run only when you actually want a new mainnet
# contract.

set -euo pipefail

# ---- config ---------------------------------------------------------------
NETWORK="mainnet"
ORG_ID="${ORG_ID:-internstellar-mainnet}"
STORE_ID="${STORE_ID:-internstellar-store-mainnet}"
HORIZON="${STELLAR_HORIZON_URL:-https://horizon.stellar.org}"
EXPLORER_BASE="https://stellar.expert/explorer/public"

# Skip the smoke test (deposit→lock→release) when set to 1. Useful when you
# only want the deploy step and intend to drive the UI for the smoke.
SKIP_SMOKE="${SKIP_SMOKE:-0}"

# Smoke amounts kept intentionally tiny — these are real stroops on mainnet.
# 0.001 XLM total, split 60/30/10 = (6000, 3000, 1000) stroops; lock 2000
# stroops (~0.0002 XLM); release credits the store bucket.
DEPOSIT_TOTAL=10000
EXPECTED_UTIL=6000
EXPECTED_GROC=3000
EXPECTED_EMERG=1000
LOCK_AMOUNT=2000

MIN_XLM_BALANCE=30  # bail if organizer has less than this many XLM

MAINNET_RPC="${MAINNET_RPC:-https://soroban-rpc.mainnet.stellar.gateway.fm}"
MAINNET_PASSPHRASE="${MAINNET_PASSPHRASE:-Public Global Stellar Network ; September 2015}"

# Passed on every stellar contract call so deploy works even when the
# built-in "mainnet" network still shows the CLI's "Bring Your Own" placeholder.
STELLAR_NET_FLAGS=(--network "$NETWORK" --rpc-url "$MAINNET_RPC" --network-passphrase "$MAINNET_PASSPHRASE")

# ---- helpers --------------------------------------------------------------
need() { command -v "$1" >/dev/null 2>&1 || { echo "✗ Missing required CLI: $1"; exit 1; }; }
need stellar
need curl

step() { echo ""; echo "── $* ──"; }
fail() { echo "✗ $*"; exit 1; }

# Parse JSON array output from `stellar contract invoke` without jq.
json_array_elem() {
  python3 -c "import json,sys; a=json.loads(sys.argv[1]); print(a[int(sys.argv[2])])" "$1" "$2" 2>/dev/null || echo ""
}

horizon_native_balance() {
  python3 -c "
import json, sys, urllib.request
pk = sys.argv[1]
url = sys.argv[2] + '/accounts/' + pk
try:
    with urllib.request.urlopen(url, timeout=30) as r:
        d = json.load(r)
    for b in d.get('balances', []):
        if b.get('asset_type') == 'native':
            print(b['balance'])
            break
except Exception:
    pass
" "$1" "$HORIZON"
}

assert_triple() {
  local label=$1 actual=$2 e_util=$3 e_groc=$4 e_emerg=$5
  local a_util a_groc a_emerg
  a_util=$(json_array_elem "$actual" 0)
  a_groc=$(json_array_elem "$actual" 1)
  a_emerg=$(json_array_elem "$actual" 2)
  if [ "$a_util" = "$e_util" ] && [ "$a_groc" = "$e_groc" ] && [ "$a_emerg" = "$e_emerg" ]; then
    echo "  ✓ $label = ($a_util, $a_groc, $a_emerg)"
  else
    echo "  ✗ $label mismatch"
    echo "    expected: ($e_util, $e_groc, $e_emerg)"
    echo "    actual:   ($a_util, $a_groc, $a_emerg)"
    exit 1
  fi
}

latest_tx_hash() {
  local pk=$1
  python3 -c "
import json, sys, urllib.request
pk, base = sys.argv[1], sys.argv[2]
url = base + '/accounts/' + pk + '/transactions?order=desc&limit=1'
try:
    with urllib.request.urlopen(url, timeout=30) as r:
        d = json.load(r)
    recs = d.get('_embedded', {}).get('records', [])
    if recs:
        print(recs[0].get('hash', ''))
except Exception:
    pass
" "$pk" "$HORIZON"
}

ensure_mainnet_rpc() {
  if ! stellar network ls --long 2>/dev/null | grep -A2 "^Name: mainnet" | grep -q "soroban-rpc.mainnet.stellar.gateway.fm"; then
    step "Configuring mainnet Soroban RPC (CLI default is a placeholder)"
    stellar network rm mainnet 2>/dev/null || true
    while stellar network ls 2>/dev/null | grep -qx "mainnet"; do
      stellar network rm mainnet 2>/dev/null || break
    done
    stellar network add mainnet \
      --rpc-url "$MAINNET_RPC" \
      --network-passphrase "$MAINNET_PASSPHRASE" >/dev/null
    echo "  ✓ mainnet → ${MAINNET_RPC}"
  fi
}

# ---- 1. preflight: identities, balance, build ----------------------------
step "Preflight"
ensure_mainnet_rpc
need python3

if ! stellar keys ls 2>/dev/null | grep -qx "${ORG_ID}"; then
  echo ""
  echo "  ✗ Organizer identity '${ORG_ID}' is not configured in the Stellar CLI."
  echo ""
  echo "  Add it once with the funded mainnet secret key (the CLI prompts you;"
  echo "  the secret is not echoed and is not written to chat or git):"
  echo ""
  echo "      stellar keys add ${ORG_ID} --secret-key"
  echo ""
  echo "  Then re-run this script."
  exit 1
fi

ORG_PK=$(stellar keys public-key "$ORG_ID")
echo "  ✓ Organizer identity: ${ORG_ID}"
echo "    Public key:         ${ORG_PK}"

XLM_NATIVE=$(horizon_native_balance "$ORG_PK")
if [ -z "$XLM_NATIVE" ]; then
  fail "Could not read organizer balance from Horizon (${HORIZON}). Is the account funded on mainnet?"
fi
XLM_INT=${XLM_NATIVE%.*}
echo "    Mainnet balance:    ${XLM_NATIVE} XLM"
if [ "${XLM_INT:-0}" -lt "$MIN_XLM_BALANCE" ]; then
  fail "Organizer balance ${XLM_NATIVE} XLM is below the safety floor of ${MIN_XLM_BALANCE} XLM. Top up before deploying."
fi

# Generate the store identity locally (no funding — the contract only stores
# the pubkey, the store account is never touched on-chain). Reuses an
# existing identity if the script is re-run.
if ! stellar keys ls 2>/dev/null | grep -qx "${STORE_ID}"; then
  step "Generating store identity (local-only, never funded)"
  stellar keys generate "$STORE_ID" >/dev/null
fi
STORE_PK=$(stellar keys public-key "$STORE_ID")
echo "  ✓ Store identity:    ${STORE_ID}"
echo "    Public key:        ${STORE_PK}"

step "Building WASM (release profile, wasm32v1-none)"
(
  cd "$(dirname "$0")/.."
  stellar contract build
)
WASM_PATH=$(ls -1 "$(dirname "$0")/../target/wasm32v1-none/release/"*.wasm | head -n 1)
[ -f "$WASM_PATH" ] || fail "Built WASM not found under target/wasm32v1-none/release/"
echo "  ✓ WASM: ${WASM_PATH}"

# ---- 2. deploy ------------------------------------------------------------
step "Deploying contract on ${NETWORK} (this costs real XLM)"
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --source "$ORG_ID" \
  "${STELLAR_NET_FLAGS[@]}")
[ -n "$CONTRACT_ID" ] || fail "Deploy returned an empty contract id"
echo "  ✓ Contract id: ${CONTRACT_ID}"
echo "    Explorer:    ${EXPLORER_BASE}/contract/${CONTRACT_ID}"

if [ "$SKIP_SMOKE" = "1" ]; then
  echo ""
  echo "════════════════════════════════════════════════════════════════════"
  echo "  Mainnet deploy complete ✓  (smoke skipped per SKIP_SMOKE=1)"
  echo "════════════════════════════════════════════════════════════════════"
  echo "  NEXT_PUBLIC_CONTRACT_ID=${CONTRACT_ID}"
  echo "  Organizer pubkey:        ${ORG_PK}"
  echo "  Store pubkey:            ${STORE_PK}"
  exit 0
fi

# ---- 3. smoke: deposit_and_split  60/30/10 of 0.001 XLM -------------------
step "deposit_and_split  total=${DEPOSIT_TOTAL} stroops  60/30/10"
DEPOSIT_OUT=$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$ORG_ID" \
  "${STELLAR_NET_FLAGS[@]}" \
  -- deposit_and_split \
  --from "$ORG_PK" \
  --total "$DEPOSIT_TOTAL" \
  --pct_util 60 --pct_groc 30 --pct_emerg 10)
DEPOSIT_HASH=$(latest_tx_hash "$ORG_PK")
assert_triple "deposit shares" "$DEPOSIT_OUT" "$EXPECTED_UTIL" "$EXPECTED_GROC" "$EXPECTED_EMERG"

# ---- 4. lock_escrow ------------------------------------------------------
step "lock_escrow  organizer(family) → store  amount=${LOCK_AMOUNT}"
LOCK_OUT=$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$ORG_ID" \
  "${STELLAR_NET_FLAGS[@]}" \
  -- lock_escrow \
  --family "$ORG_PK" \
  --store "$STORE_PK" \
  --amount "$LOCK_AMOUNT")
LOCK_HASH=$(latest_tx_hash "$ORG_PK")
ESCROW_ID=$(echo "$LOCK_OUT" | tr -d '"')
echo "  ✓ escrow_id = ${ESCROW_ID}"

# ---- 5. release_escrow ---------------------------------------------------
step "release_escrow  id=${ESCROW_ID}"
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$ORG_ID" \
  "${STELLAR_NET_FLAGS[@]}" \
  -- release_escrow --escrow_id "$ESCROW_ID" >/dev/null
RELEASE_HASH=$(latest_tx_hash "$ORG_PK")
echo "  ✓ released"

# ---- 6. get_balances(store) — should show the credited groc bucket -------
step "get_balances(store)"
STORE_BAL=$(stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$ORG_ID" \
  "${STELLAR_NET_FLAGS[@]}" \
  --send=no \
  -- get_balances --user "$STORE_PK")
STORE_GROC=$(json_array_elem "$STORE_BAL" 1)
if [ "$STORE_GROC" -lt "$LOCK_AMOUNT" ]; then
  fail "store groc=${STORE_GROC}, expected >= ${LOCK_AMOUNT}"
fi
echo "  ✓ store grocery bucket credited: ${STORE_GROC} stroops"

# ---- 7. final summary ----------------------------------------------------
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  Mainnet smoke complete ✓"
echo "════════════════════════════════════════════════════════════════════"
echo "  NEXT_PUBLIC_CONTRACT_ID=${CONTRACT_ID}"
echo "  Organizer pubkey:        ${ORG_PK}"
echo "  Store pubkey:            ${STORE_PK}"
echo ""
echo "  Deposit:  ${EXPLORER_BASE}/tx/${DEPOSIT_HASH}"
echo "  Lock:     ${EXPLORER_BASE}/tx/${LOCK_HASH}"
echo "  Release:  ${EXPLORER_BASE}/tx/${RELEASE_HASH}"
echo "════════════════════════════════════════════════════════════════════"
