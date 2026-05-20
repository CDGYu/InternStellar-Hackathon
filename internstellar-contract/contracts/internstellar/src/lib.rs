#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

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
            panic!("total must be positive");
        }
        if pct_util + pct_groc + pct_emerg != 100 {
            panic!("percentages must sum to 100");
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

        // checked_add makes overflow handling explicit even though the release
        // profile already enables overflow-checks. This documents intent and
        // gives a stable panic message that tests can pin to.
        let new_util = util_balance.checked_add(util_share).expect("util overflow");
        let new_groc = groc_balance.checked_add(groc_share).expect("groc overflow");
        let new_emerg = emerg_balance.checked_add(emerg_share).expect("emerg overflow");

        env.storage().persistent().set(&util_key, &new_util);
        env.storage().persistent().set(&groc_key, &new_groc);
        env.storage().persistent().set(&emerg_key, &new_emerg);

        (util_share, groc_share, emerg_share)
    }

    pub fn get_balances(env: Env, user: Address) -> (i128, i128, i128) {
        let util = read_balance(&env, DataKey::Util(user.clone()));
        let groc = read_balance(&env, DataKey::Groc(user.clone()));
        let emerg = read_balance(&env, DataKey::Emerg(user));

        (util, groc, emerg)
    }

    pub fn lock_escrow(env: Env, family: Address, amount: i128) -> u32 {
        family.require_auth();

        if amount <= 0 {
            panic!("escrow amount must be positive");
        }

        let groc_key = DataKey::Groc(family.clone());
        let groc_balance = read_balance(&env, groc_key.clone());
        if groc_balance < amount {
            panic!("insufficient grocery balance");
        }

        let escrow_id = next_escrow_id(&env);
        let remaining_groc = groc_balance
            .checked_sub(amount)
            .expect("groc underflow");
        let following_id = escrow_id
            .checked_add(1)
            .expect("escrow id overflow");

        env.storage().persistent().set(&groc_key, &remaining_groc);
        env.storage()
            .persistent()
            .set(&DataKey::NextEscrowId, &following_id);
        env.storage().persistent().set(
            &DataKey::Escrow(escrow_id),
            &Escrow {
                family,
                amount,
                released: false,
            },
        );

        escrow_id
    }

    pub fn release_escrow(env: Env, escrow_id: u32) {
        let escrow_key = DataKey::Escrow(escrow_id);
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&escrow_key)
            .unwrap_or_else(|| panic!("escrow not found"));

        escrow.family.require_auth();

        if escrow.released {
            panic!("escrow already released");
        }

        escrow.released = true;
        env.storage().persistent().set(&escrow_key, &escrow);
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
