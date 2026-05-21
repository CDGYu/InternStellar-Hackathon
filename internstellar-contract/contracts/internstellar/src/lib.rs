#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env,
};

// Event topic naming convention: short symbols (<= 9 ASCII chars) so that
// `symbol_short!` works without runtime allocation. A dApp listening via the
// Soroban RPC `getEvents` method filters on these exact topic strings:
//
//   "deposit"  — emitted by deposit_and_split   (data: family, util, groc, emerg)
//   "esc_lock" — emitted by lock_escrow         (data: family, store, escrow_id, amount)
//   "esc_rel"  — emitted by release_escrow      (data: escrow_id, family, store, amount)

// `panic_with_error!` (vs raw `panic!("string")`) avoids per-call WASM string
// allocation. The `lib/stellar/contract.ts` bridge maps these codes back to
// human messages for the UI; renumbering an existing variant breaks that map.
#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    TotalNotPositive = 1,
    PctNotHundred = 2,
    EscrowAmountNotPos = 3,
    FamilyEqualsStore = 4,
    InsufficientGroc = 5,
    EscrowNotFound = 6,
    EscrowAlreadyReleased = 7,
    ArithmeticOverflow = 8,
}

// Long-lived persistent entries (buckets + escrow rows). After each `set` the
// contract extends TTL so the entry survives well past the next user action.
// Threshold/extend chosen so a locked escrow won't archive between lock and a
// late family confirm; tune if the typical lock→release gap grows.
const PERSISTENT_TTL_THRESHOLD: u32 = 100;
const PERSISTENT_TTL_EXTEND_TO: u32 = 4096;

// Bucket key types are kept narrow so storage lookups stay cheap and explicit.
// One enum variant per bucket per user keeps the data layout flat instead of
// nesting maps, which is closer to how Soroban examples model per-account state.
#[derive(Clone)]
#[contracttype]
enum DataKey {
    Util(Address),
    Groc(Address),
    Emerg(Address),
    NextEscrowId,
    Escrow(u32),
}

#[derive(Clone)]
#[contracttype]
struct Escrow {
    family: Address,
    store: Address,
    amount: i128,
    released: bool,
}

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn deposit_and_split(
        env: Env,
        from: Address,
        total: i128,
        pct_util: u32,
        pct_groc: u32,
        pct_emerg: u32,
    ) -> (i128, i128, i128) {
        from.require_auth();

        if total <= 0 {
            panic_with_error!(&env, Error::TotalNotPositive);
        }
        // checked_add on the sum so an adversarial caller passing u32 values
        // that overflow before the != 100 check can't reach the rest of the fn.
        let sum = match pct_util
            .checked_add(pct_groc)
            .and_then(|s| s.checked_add(pct_emerg))
        {
            Some(s) => s,
            None => panic_with_error!(&env, Error::PctNotHundred),
        };
        if sum != 100 {
            panic_with_error!(&env, Error::PctNotHundred);
        }

        // Multiply before divide so integer division does not silently drop
        // money. The last bucket absorbs the rounding remainder so the three
        // shares always reconstruct the original total.
        let util_share = total * (pct_util as i128) / 100;
        let groc_share = total * (pct_groc as i128) / 100;
        let emerg_share = total - util_share - groc_share;

        let util_key = DataKey::Util(from.clone());
        let groc_key = DataKey::Groc(from.clone());
        let emerg_key = DataKey::Emerg(from.clone());

        let util_balance: i128 = env.storage().persistent().get(&util_key).unwrap_or(0);
        let groc_balance: i128 = env.storage().persistent().get(&groc_key).unwrap_or(0);
        let emerg_balance: i128 = env.storage().persistent().get(&emerg_key).unwrap_or(0);

        let new_util = match util_balance.checked_add(util_share) {
            Some(v) => v,
            None => panic_with_error!(&env, Error::ArithmeticOverflow),
        };
        let new_groc = match groc_balance.checked_add(groc_share) {
            Some(v) => v,
            None => panic_with_error!(&env, Error::ArithmeticOverflow),
        };
        let new_emerg = match emerg_balance.checked_add(emerg_share) {
            Some(v) => v,
            None => panic_with_error!(&env, Error::ArithmeticOverflow),
        };

        env.storage().persistent().set(&util_key, &new_util);
        env.storage().persistent().extend_ttl(
            &util_key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        env.storage().persistent().set(&groc_key, &new_groc);
        env.storage().persistent().extend_ttl(
            &groc_key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        env.storage().persistent().set(&emerg_key, &new_emerg);
        env.storage().persistent().extend_ttl(
            &emerg_key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        env.events().publish(
            (symbol_short!("deposit"),),
            (from, util_share, groc_share, emerg_share),
        );

        (util_share, groc_share, emerg_share)
    }

    pub fn get_balances(env: Env, user: Address) -> (i128, i128, i128) {
        let util = read_balance(&env, DataKey::Util(user.clone()));
        let groc = read_balance(&env, DataKey::Groc(user.clone()));
        let emerg = read_balance(&env, DataKey::Emerg(user));

        (util, groc, emerg)
    }

    pub fn lock_escrow(env: Env, family: Address, store: Address, amount: i128) -> u32 {
        family.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, Error::EscrowAmountNotPos);
        }
        // A family paying themselves would let funds leave the escrow without
        // ever reaching a real merchant. Reject up front so the demo never
        // shows a "store paid" event where family == store.
        if family == store {
            panic_with_error!(&env, Error::FamilyEqualsStore);
        }

        let groc_key = DataKey::Groc(family.clone());
        let groc_balance = read_balance(&env, groc_key.clone());
        if groc_balance < amount {
            panic_with_error!(&env, Error::InsufficientGroc);
        }

        let escrow_id = next_escrow_id(&env);
        let remaining_groc = match groc_balance.checked_sub(amount) {
            Some(v) => v,
            None => panic_with_error!(&env, Error::ArithmeticOverflow),
        };
        let following_id = match escrow_id.checked_add(1) {
            Some(v) => v,
            None => panic_with_error!(&env, Error::ArithmeticOverflow),
        };

        env.storage().persistent().set(&groc_key, &remaining_groc);
        env.storage().persistent().extend_ttl(
            &groc_key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        env.storage()
            .persistent()
            .set(&DataKey::NextEscrowId, &following_id);
        env.storage().persistent().extend_ttl(
            &DataKey::NextEscrowId,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        let escrow_key = DataKey::Escrow(escrow_id);
        env.storage().persistent().set(
            &escrow_key,
            &Escrow {
                family: family.clone(),
                store: store.clone(),
                amount,
                released: false,
            },
        );
        env.storage().persistent().extend_ttl(
            &escrow_key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        env.events().publish(
            (symbol_short!("esc_lock"),),
            (family, store, escrow_id, amount),
        );

        escrow_id
    }

    pub fn release_escrow(env: Env, escrow_id: u32) {
        let escrow_key = DataKey::Escrow(escrow_id);
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&escrow_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::EscrowNotFound));

        // The family is the party that confirms delivery, so they sign the
        // release. The contract trusts that "delivery is confirmed" decision
        // to the family. The store does NOT auth this call.
        escrow.family.require_auth();

        if escrow.released {
            panic_with_error!(&env, Error::EscrowAlreadyReleased);
        }

        escrow.released = true;
        env.storage().persistent().set(&escrow_key, &escrow);
        env.storage().persistent().extend_ttl(
            &escrow_key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        // Credit the store's grocery bucket with the held escrow amount.
        // Internal-bucket model (Option A): no real XLM moves, but
        // get_balances(store) reflects the payment, which is what the demo
        // shows. SAC-based real-XLM transfer is the planned Option B.
        let store_groc_key = DataKey::Groc(escrow.store.clone());
        let store_groc = read_balance(&env, store_groc_key.clone());
        let new_store_groc = match store_groc.checked_add(escrow.amount) {
            Some(v) => v,
            None => panic_with_error!(&env, Error::ArithmeticOverflow),
        };
        env.storage()
            .persistent()
            .set(&store_groc_key, &new_store_groc);
        env.storage().persistent().extend_ttl(
            &store_groc_key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );

        env.events().publish(
            (symbol_short!("esc_rel"),),
            (escrow_id, escrow.family, escrow.store, escrow.amount),
        );
    }
}

fn read_balance(env: &Env, key: DataKey) -> i128 {
    env.storage().persistent().get(&key).unwrap_or(0)
}

fn next_escrow_id(env: &Env) -> u32 {
    env.storage()
        .persistent()
        .get(&DataKey::NextEscrowId)
        .unwrap_or(1)
}

mod test;
