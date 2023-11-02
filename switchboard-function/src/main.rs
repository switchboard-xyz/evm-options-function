use base64;
use chrono::{TimeZone, LocalResult};
use ethers::{
    abi::AbiDecode,
    contract::{EthAbiCodec, EthAbiType},
    prelude::{abigen, SignerMiddleware},
    types::{Address, U256},
};
use futures::TryFutureExt;
use serde::Deserialize;
use std::collections::HashMap;
use switchboard_evm::{sb_error, sb_function, FnCall, sdk::EVMFunctionRunner};
use switchboard_utils::reqwest;
use rust_decimal::prelude::FromPrimitive;
use rust_decimal::Decimal;

abigen!(
    Receiver,
    r#"[ function callback(address, uint256, uint256[]) ]"#,
);
static CLIENT_URL: &str = "https://goerli-rollup.arbitrum.io/rpc";
static RECEIVER: &str = env!("CALLBACK_ADDRESS");

#[derive(Debug, Deserialize)]
struct Response {
    result: DeribitResult,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct DeribitResult {
    underlying_price: f64,
    underlying_index: String,
    timestamp: u64,
    // stats: Stats,
    state: String,
    open_interest: f64,
    min_price: f64,
    max_price: f64,
    mark_price: f64,
    mark_iv: f64,
    last_price: f64,
    interest_rate: u32,
    instrument_name: String,
    index_price: f64,
    // greeks: Greeks,
    estimated_delivery_price: String,
    delivery_price: f64,
    change_id: u64,
    bids: Vec<HashMap<String, f64>>,
    bid_iv: f64,
    best_bid_price: f64,
    best_bid_amount: f64,
    best_ask_price: f64,
    best_ask_amount: f64,
    asks: Vec<HashMap<String, f64>>,
    ask_iv: f64,
}


#[derive(EthAbiType, EthAbiCodec, Default, Debug, Clone)]
pub struct Order {
    market_id: String, // asset name
    exp_date: U256, // expiration date
    strike_price: U256, // strike price in integers (this ultimately should depend on the asset / exchange)
    option_type: u8, // call or put
}


// --  Business logic - Called once for each Switchboard Function Request (many can be resolved in one run) --
#[sb_function(expiration_seconds = 120, gas_limit = 5_500_000)] 
async fn sb_function<M: Middleware, S: Signer>(
    client: SignerMiddleware<M, S>,
    request_id: Address,
    params: Order,
) -> Result<Vec<FnCall<M, S>>, Error> {

    // --- Initialize clients ---
    let receiver: Address = RECEIVER.parse().map_err(|_| Error::ParseError)?;
    let receiver_contract = Receiver::new(receiver, client.into());

    // --- Get URL from params ---

    // get expiration date in format DDMMYY
    let timestamp_u64 = params.exp_date.low_u64();

    // Create a DateTime object from the timestamp using timestamp_opt()
    let exp_date = match Utc.timestamp_opt(timestamp_u64 as i64, 0) {
        LocalResult::Single(datetime) => {
            // Format the DateTime object as DDMMMYY and return
            Ok(datetime.format("%d%b%y").to_string().to_uppercase())
        }
        _ => Err(Error::InvalidParameter), // Return error if the timestamp is ambiguous or not valid
    }?; 

    // get strike price in usd (8 decimals)
    let strike_price = params.strike_price.to_string();

    // get option type
    let option_type = match params.option_type {
        0 => "C",
        1 => "P",
        _ => return Err(Error::InvalidParameter),
    };

    let url = format!(
        "https://www.deribit.com/api/v2/public/get_order_book?instrument_name={}-{}-{}-{}",
        params.market_id,
        exp_date,
        strike_price,
        option_type
    );

    println!("Constructed url: {}", url);

    let derebit_response: Response = reqwest::get(url)
        .and_then(|r| r.json())
        .await
        .map_err(|_| Error::FetchError)?;

    // --- Create Callback(s) ---

    let mut mark_iv = Decimal::from_f64(derebit_response.result.mark_iv).unwrap();
    mark_iv.rescale(8);

    let mut callbacks = Vec::new();
    let x = U256::from(mark_iv.mantissa());

    for i in 0..3 {

        // --- Send the callback to the contract with Switchboard verification ---
        let y = U256::from(i);
        let callback = receiver_contract.callback(
            request_id,
            y,
            vec![
                x + y + 1,
                x + y + 2,
                x + y + 3,
            ],
        );
        callbacks.push(callback);
    }

    // get callback back to the end-user
    Ok(callbacks)
}

#[sb_error]
enum Error {
    FetchError,
    InvalidParameter,
}

/// Run `cargo test -- --nocapture`
#[cfg(test)]
mod tests {
    use crate::*;
    use std::str::FromStr;

    #[tokio::test]
    async fn test() {

        let derebit_response: DeribitResponse = reqwest::get(
            "https://www.deribit.com/api/v2/public/get_order_book?instrument_name=ETH-29SEP23-2000-C",
        )
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        println!("{:#?}", derebit_response);
    }
}
