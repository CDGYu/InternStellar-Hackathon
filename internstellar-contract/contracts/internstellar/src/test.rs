#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    Address, Env,
};

// 1 XLM = 10^7 stroops on Stellar. We treat that as one demo "unit" so the
// numbers in tests still look like ledger amounts instead of dimensionless
// integers. ONE_UNIT * 1000 mirrors the P1 plan's "₱1000 deposit" example.
const ONE_UNIT: i128 = 10_000_000;

fn new_contract() -> (Env, soroban_sdk::Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    (env, contract_id)
}

#[test]
fn deposit_splits_60_30_10_correctly() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let total: i128 = 1000 * ONE_UNIT;

    let (util, groc, emerg) = client.deposit_and_split(&user, &total, &60u32, &30u32, &10u32);

    assert_eq!(util, 600 * ONE_UNIT);
    assert_eq!(groc, 300 * ONE_UNIT);
    assert_eq!(emerg, 100 * ONE_UNIT);
}

#[test]
fn stored_balances_match_shares_on_first_deposit() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let total: i128 = 1000 * ONE_UNIT;

    client.deposit_and_split(&user, &total, &60u32, &30u32, &10u32);

    env.as_contract(&contract_id, || {
        let util: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Util(user.clone()))
            .unwrap();
        let groc: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Groc(user.clone()))
            .unwrap();
        let emerg: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Emerg(user.clone()))
            .unwrap();

        assert_eq!(util, 600 * ONE_UNIT);
        assert_eq!(groc, 300 * ONE_UNIT);
        assert_eq!(emerg, 100 * ONE_UNIT);
    });
}

#[test]
fn second_deposit_accumulates_running_balance() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let total: i128 = 1000 * ONE_UNIT;

    client.deposit_and_split(&user, &total, &60u32, &30u32, &10u32);
    client.deposit_and_split(&user, &total, &60u32, &30u32, &10u32);

    env.as_contract(&contract_id, || {
        let util: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Util(user.clone()))
            .unwrap();
        let groc: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Groc(user.clone()))
            .unwrap();
        let emerg: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Emerg(user.clone()))
            .unwrap();

        assert_eq!(util, 1200 * ONE_UNIT);
        assert_eq!(groc, 600 * ONE_UNIT);
        assert_eq!(emerg, 200 * ONE_UNIT);
    });
}

#[test]
#[should_panic(expected = "percentages must sum to 100")]
fn rejects_percentages_summing_above_100() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    client.deposit_and_split(&user, &(1000 * ONE_UNIT), &60u32, &30u32, &20u32);
}

#[test]
#[should_panic(expected = "percentages must sum to 100")]
fn rejects_percentages_summing_below_100() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    client.deposit_and_split(&user, &(1000 * ONE_UNIT), &50u32, &30u32, &10u32);
}

#[test]
#[should_panic(expected = "total must be positive")]
fn rejects_zero_total() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    client.deposit_and_split(&user, &0i128, &60u32, &30u32, &10u32);
}

#[test]
#[should_panic(expected = "total must be positive")]
fn rejects_negative_total() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    client.deposit_and_split(&user, &(-1i128), &60u32, &30u32, &10u32);
}

#[test]
fn remainder_trick_preserves_total_for_uneven_split() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    // 1000 / 100 * 33 = 330, so util and groc each take 330. The remainder
    // trick gives the last bucket the leftover (1000 - 330 - 330 = 340) so no
    // unit of value disappears to integer-division rounding.
    let total: i128 = 1000;
    let (util, groc, emerg) = client.deposit_and_split(&user, &total, &33u32, &33u32, &34u32);

    assert_eq!(util, 330);
    assert_eq!(groc, 330);
    assert_eq!(emerg, 340);
    assert_eq!(util + groc + emerg, total);
}

#[test]
fn get_balances_returns_zeroes_for_new_user() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);

    let (util, groc, emerg) = client.get_balances(&user);

    assert_eq!(util, 0);
    assert_eq!(groc, 0);
    assert_eq!(emerg, 0);
}

#[test]
fn get_balances_returns_running_bucket_balances() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    client.deposit_and_split(&user, &(1000 * ONE_UNIT), &60u32, &30u32, &10u32);

    let (util, groc, emerg) = client.get_balances(&user);

    assert_eq!(util, 600 * ONE_UNIT);
    assert_eq!(groc, 300 * ONE_UNIT);
    assert_eq!(emerg, 100 * ONE_UNIT);
}

#[test]
fn lock_escrow_moves_grocery_funds_into_held_escrow() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let family = Address::generate(&env);
    let store = Address::generate(&env);
    client.deposit_and_split(&family, &(1000 * ONE_UNIT), &60u32, &30u32, &10u32);

    let escrow_id = client.lock_escrow(&family, &store, &(200 * ONE_UNIT));

    assert_eq!(escrow_id, 1);
    let (_util, groc, _emerg) = client.get_balances(&family);
    assert_eq!(groc, 100 * ONE_UNIT);

    env.as_contract(&contract_id, || {
        let escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .unwrap();

        assert_eq!(escrow.family, family);
        assert_eq!(escrow.store, store);
        assert_eq!(escrow.amount, 200 * ONE_UNIT);
        assert!(!escrow.released);
    });
}

#[test]
#[should_panic(expected = "insufficient grocery balance")]
fn lock_escrow_rejects_amount_above_grocery_balance() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let family = Address::generate(&env);
    let store = Address::generate(&env);
    client.deposit_and_split(&family, &(1000 * ONE_UNIT), &60u32, &30u32, &10u32);

    client.lock_escrow(&family, &store, &(301 * ONE_UNIT));
}

#[test]
#[should_panic(expected = "escrow amount must be positive")]
fn lock_escrow_rejects_zero_amount() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let family = Address::generate(&env);
    let store = Address::generate(&env);

    client.lock_escrow(&family, &store, &0i128);
}

#[test]
#[should_panic(expected = "family cannot be store")]
fn lock_escrow_rejects_family_equals_store() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let family = Address::generate(&env);
    // Family fully funded, but they try to "send to themselves" — should panic
    // before any storage mutation.
    client.deposit_and_split(&family, &(1000 * ONE_UNIT), &60u32, &30u32, &10u32);

    client.lock_escrow(&family, &family, &(100 * ONE_UNIT));
}

#[test]
fn release_escrow_marks_existing_escrow_released() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let family = Address::generate(&env);
    let store = Address::generate(&env);
    client.deposit_and_split(&family, &(1000 * ONE_UNIT), &60u32, &30u32, &10u32);
    let escrow_id = client.lock_escrow(&family, &store, &(200 * ONE_UNIT));

    client.release_escrow(&escrow_id);

    env.as_contract(&contract_id, || {
        let escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .unwrap();

        assert!(escrow.released);
    });
}

#[test]
fn release_escrow_credits_store_grocery_bucket() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let family = Address::generate(&env);
    let store = Address::generate(&env);
    client.deposit_and_split(&family, &(1000 * ONE_UNIT), &60u32, &30u32, &10u32);

    let escrow_amount: i128 = 200 * ONE_UNIT;
    let escrow_id = client.lock_escrow(&family, &store, &escrow_amount);

    // Store starts with zero everywhere; family's grocery bucket dropped by
    // the escrow amount when lock ran.
    let (_, store_groc_before, _) = client.get_balances(&store);
    assert_eq!(store_groc_before, 0);

    client.release_escrow(&escrow_id);

    let (store_util, store_groc, store_emerg) = client.get_balances(&store);
    assert_eq!(store_groc, escrow_amount);
    assert_eq!(store_util, 0);
    assert_eq!(store_emerg, 0);

    // Family's grocery bucket stays at the post-lock value: we already deducted
    // when lock ran, so release should not change it.
    let (_, family_groc, _) = client.get_balances(&family);
    assert_eq!(family_groc, 100 * ONE_UNIT);
}

#[test]
fn release_escrow_credits_accumulate_when_store_serves_multiple_families() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let family_a = Address::generate(&env);
    let family_b = Address::generate(&env);
    let store = Address::generate(&env);

    client.deposit_and_split(&family_a, &(1000 * ONE_UNIT), &60u32, &30u32, &10u32);
    client.deposit_and_split(&family_b, &(1000 * ONE_UNIT), &60u32, &30u32, &10u32);

    let a_escrow = client.lock_escrow(&family_a, &store, &(150 * ONE_UNIT));
    let b_escrow = client.lock_escrow(&family_b, &store, &(50 * ONE_UNIT));

    client.release_escrow(&a_escrow);
    client.release_escrow(&b_escrow);

    let (_, store_groc, _) = client.get_balances(&store);
    // The store's grocery bucket should accumulate both releases. Using
    // separate amounts (150 + 50 = 200) catches an off-by-one where a release
    // overwrites instead of adds.
    assert_eq!(store_groc, 200 * ONE_UNIT);
}

#[test]
#[should_panic(expected = "escrow already released")]
fn release_escrow_rejects_double_release() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let family = Address::generate(&env);
    let store = Address::generate(&env);
    client.deposit_and_split(&family, &(1000 * ONE_UNIT), &60u32, &30u32, &10u32);
    let escrow_id = client.lock_escrow(&family, &store, &(200 * ONE_UNIT));

    client.release_escrow(&escrow_id);
    client.release_escrow(&escrow_id);
}

#[test]
#[should_panic(expected = "escrow not found")]
fn release_escrow_rejects_unknown_id() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let missing_escrow_id = 42u32;

    client.release_escrow(&missing_escrow_id);
}

// ---------------------------------------------------------------------------
// Event emission tests
// ---------------------------------------------------------------------------
// Each public mutating function publishes a single event so a dApp can react
// without polling state. soroban-sdk's test environment surfaces only the
// events from the *most recent* contract invocation via `env.events().all()`,
// so each test asserts the per-call event count rather than a cumulative
// count. Detailed payload decoding is left to integration tests that talk to
// a live RPC, because converting back from `Val` in unit tests is unnecessarily
// noisy.

#[test]
fn deposit_emits_exactly_one_event_from_our_contract() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    client.deposit_and_split(&user, &(1000 * ONE_UNIT), &60u32, &30u32, &10u32);

    let our_events = env.events().all().filter_by_contract(&contract_id);
    assert_eq!(our_events.events().len(), 1);
}

#[test]
fn lock_escrow_emits_exactly_one_event_from_our_contract() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let family = Address::generate(&env);
    let store = Address::generate(&env);
    client.deposit_and_split(&family, &(1000 * ONE_UNIT), &60u32, &30u32, &10u32);
    client.lock_escrow(&family, &store, &(200 * ONE_UNIT));

    // env.events().all() returns events from the most recent invocation
    // (lock_escrow), not cumulatively — so we expect exactly 1 event here.
    let our_events = env.events().all().filter_by_contract(&contract_id);
    assert_eq!(our_events.events().len(), 1);
}

#[test]
fn release_escrow_emits_exactly_one_event_from_our_contract() {
    let (env, contract_id) = new_contract();
    let client = ContractClient::new(&env, &contract_id);

    let family = Address::generate(&env);
    let store = Address::generate(&env);
    client.deposit_and_split(&family, &(1000 * ONE_UNIT), &60u32, &30u32, &10u32);
    let escrow_id = client.lock_escrow(&family, &store, &(200 * ONE_UNIT));
    client.release_escrow(&escrow_id);

    // Per-invocation count: release_escrow was the last call.
    let our_events = env.events().all().filter_by_contract(&contract_id);
    assert_eq!(our_events.events().len(), 1);
}
