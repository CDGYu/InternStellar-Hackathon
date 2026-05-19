#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

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
