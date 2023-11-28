# Switchboard Function Example

<div align="center">
  <img src="https://github.com/switchboard-xyz/sbv2-core/raw/main/website/static/img/icons/switchboard/avatar.png" />

  <h1>Switchboard<br>Options Platform Function Example</h1>

  <p>
    <a href="https://discord.gg/switchboardxyz">
      <img alt="Discord" src="https://img.shields.io/discord/841525135311634443?color=blueviolet&logo=discord&logoColor=white" />
    </a>
    <a href="https://twitter.com/switchboardxyz">
      <img alt="Twitter" src="https://img.shields.io/twitter/follow/switchboardxyz?label=Follow+Switchboard" />
    </a>
  </p>
</div>

## Table of Content

- [Prerequisites](#prerequisites)
  - [Installing Docker](#installing-docker)
  - [Docker Setup](#docker-setup)
- [Components](#components)
  - [Contract](#contract)
  - [Switchboard Function](#switchboard-function)
  - [Publishing and Initialization](#publishing-and-initialization)
  - [Adding Funding to Function](#adding-funding-to-function)
  - [Printing Function Data](#printing-function-data)
- [Writing Switchboard Rust Functions](#writing-switchboard-rust-functions)
  - [Setup](#setup)
  - [Minimal Example](#minimal-switchboard-function)
  - [Testing your function](#testing-your-function)
  - [Deploying and maintenance](#deploying-and-maintenance)
- [Writing Receiver Contracts](#writing-receiver-contracts)
  - [Receiver Example](#receiver-example)

## Prerequisites

Before you can build and run the project, you'll need to have Docker installed on your system. Docker allows you to package and distribute applications as lightweight containers, making it easy to manage dependencies and ensure consistent behavior across different environments. Switchboard Functions are built and run within containers, so you'll need a docker daemon running to publish a new function.

### Installing Docker

If you don't have Docker installed, you can follow these steps to get it up and running:

1. **Linux**: Depending on your Linux distribution, you might need to use different package managers. For Ubuntu, you can use `apt`:

   ```bash
   sudo apt update
   sudo apt install docker.io
   ```

   For other distributions, consult your package manager's documentation.

2. **macOS**: You can install Docker Desktop for macOS by downloading the installer from the [Docker website](https://www.docker.com/products/docker-desktop) and following the installation instructions.

3. **Windows**: Similarly, you can install Docker Desktop for Windows from the [Docker website](https://www.docker.com/products/docker-desktop) and follow the provided instructions.

### Docker Setup

After installing Docker, make sure it's running by opening a terminal/command prompt and running:

```bash
docker --version
```

This should display the installed Docker version, confirming that Docker is installed and running properly.

You'll need to login to docker. If you don't yet have an account, you'll need one to publish images to dockerhub. You can sign up at [https://hub.docker.com](https://hub.docker.com).

```bash
docker login --username <your-username> --password <your-password>
```

### Install script dependencies

```bash
pnpm i
```

### Install Switchboard cli

```bash
pnpm install -g @switchboard-xyz/cli
sb evm function --help
```

## Components

### Contract

This example contract acts as the ingester of the switchboard-function in this directory to fetch implied volatility parameters via deribit. The example contract is an example of the [ERC2535 diamond contract pattern](https://autifynetwork.com/exploring-erc-2535-the-diamond-standard-for-smart-contracts/) so it can be extended and upgraded for your needs.

When you deploy this contract, it will await to be bound to a switchboard function calling into it.

#### Picking a network and setting up your environment

- setup your keypair by modifying `.env.example` and renaming it to `.env`, including your deployment key in the first line
- set the `SWITCHBOARD_ADDRESS` env variable to target whichever address is appropriate for the network you're targeting
- for arbitrum testnet, this is: `0xA3c9F9F6E40282e1366bdC01C1D30F7F7F58888e`

To first deploy the contract, run:

```bash
# ex:
# pnpm deploy:coredaotestnet
# pnpm deploy:coredaomain
# pnpm deploy:arbitrumtestnet
export NETWORK_NAME=arbitrumtestnet
pnpm deploy:${NETWORK_NAME}
```

More deploy commands are available in [package.json](./package.json) scripts.

You will see the last line of this script output

```bash
export CALLBACK_ADDRESS=<CALLBACK_ADDRESS>
```

### Switchboard Function

Export the address to your environment and navigate to `./switchboard-function/`

The bulk of the function logic can be found in [./switchboard-function/src/main.rs](switchboard-function/src/main.rs).

### Publishing and Initialization

You'll also need to pick a container name that your switchboard function will use on dockerhub.

Here, set the name of your container and deploy it using:

```bash
cd switchboard-function
export CONTAINER_NAME=your_docker_username/switchboard-function
export CALLBACK_ADDRESS=<RECEIVER_ADDRESS>
make build
make publish
```

Common gotcha: make sure this published container is publically visible

After this is published, you are free to make your function account to set the rate of run for the function.

You'll also need to create a file with your private key in it. This is used to sign the transactions that will be sent to the switchboard contract.

## Writing Switchboard Rust Functions

In order to write a successfully running switchboard function, you'll need to import `switchboard-evm` to use the libraries which communicate the function results (which includes transactions to run) to the Switchboard Verifiers that execute these metatransactions.

### Testing your function

We can't guarantee that the function will run on the blockchain, but we can test that it compiles and runs locally.

Run the following to test your function:

```bash
export CALLBACK_ADDRESS=${SWITCHBOARD_ADDRESS?} # can be any valid address

# test run the function - modify these params to match your desired output
sb evm function test --chain arbitrum --parameters "string:ETH,uint256:1698781846,uint256:2000,uint8:0" --network testnet
```

The above corresponds to the following parameters in the function:

```rust
#[derive(EthAbiType, EthAbiCodec, Default, Debug, Clone)]
pub struct Order {
    market_id: String, // asset name
    exp_date: U256, // expiration date
    strike_price: U256, // strike price in integers (this ultimately should depend on the asset / exchange)
    option_type: U256, // Assuming OptionType is an enum, which in Solidity is represented as uint
}
```

Successful output:

```bash
WARNING: Error generating quote. This is likely due to the enclave not being initialized.
FN_OUT: ...
3030303030303030303030303030303030303032366635383661...
...
```

The `error` above simply means your function could not produce a secure signature for the test since it was run outside the enclave. `Error: Failed to parse function result` can also be safely ignored.

### Initializing the function

You can use the Switchboard cli to bind this docker container to an on-chain representation:

```bash
export SWITCHBOARD_ADDRESS_ARBITRUM_TESTNET=0xA3c9F9F6E40282e1366bdC01C1D30F7F7F58888e
export QUEUE_ID=0x54f8A91bE5baAD3E2368b00A11bF4012EA6b031F # default testnet queue
export MEASUREMENT=<YOUR CONTAINER MEASUREMENT>
export CLUSTER=arbitrumTestnet # or arbitrumMainnet etc
sb evm function create $QUEUE_ID --container ${CONTAINER_NAME} --containerRegistry dockerhub  \
    --mrEnclave ${MEASUREMENT?} --name "options_example"  --chain arbitrum --account /path/to/signer \
    --network testnet --programId $SWITCHBOARD_ADDRESS_ARBITRUM_TESTNET
# ...
export FUNCTION_ID=<YOUR FUNCTION ID>
```

### Creating an "Order" with parameters to your function

```bash
# will fund the request with 0.01 ETH and send the request to the switchboard contract - this can be reduced significantly
pnpm exec hardhat run scripts/request.ts --network arbitrumTestnet
```

### Printing the state of your callback

This repo contains an example script to view the current verified deribit implied volatility info
currently in contract:

```bash
npx hardhat run --network arbitrumTestnet scripts/get_state.ts
```

### Updating the function image

When it comes time to update the function image, you can use the following command to update function image:

```bash
export CONTAINER_NAME=<NEW_IMAGE>
export MEASUREMENT=<NEW_MEASUREMENT>
export FUNCTION_ID=<YOUR FUNCTION ID>
export SWITCHBOARD_ADDRESS=$SWITCHBOARD_ADDRESS_ARBITRUM_TESTNET

# update the script to set the function name - will default to container name if not set
# vi scripts/update_function_config.ts
# ...
# update the function image
pnpm exec hardhat run scripts/update_function_config.ts --network arbitrumTestnet
```

And the following to update the function measurement:

```bash
sb evm function add-enclave $FUNCTION_ID --chain arbitrum --network testnet --mrEnclave $MEASUREMENT \
    --account /path/to/signer --programId $SWITCHBOARD_ADDRESS_ARBITRUM_TESTNET
```

### Gas Limits

The maximum gas for switchboard functions is 5.5 Million. This is a hard limit set by the switchboard contract. If you need to increase this limit, please reach out to us. Each run of a switchboard function results in a transaction that is baked into a larger transaction that is sent to the switchboard contract. So keep the downstream function costs in mind when setting the gas limit for your function.

### Creating a request to your function

You can use the Switchboard cli to create a request to your function:

```bash
# for creating a one-off run of the function, you can use the following
sb evm request send $FUNCTION_ID --chain arbitrum --parameters "string:ETH,uint256:1698781846,uint256:2000,uint8:0" \
    --account /path/to/keypair --network testnet --programId $SWITCHBOARD_ADDRESS_ARBITRUM_TESTNET
```

NOTE: the above will not work with the example contract as it is not set up to handle uninitialized calls

### Creating Routines

For creating a Routine, which is a recurring function call, you can modify the parameters and schedule in the following commands:

```bash
#  for creating a recurring run of the function, you can use the following
sb evm routine create $FUNCTION_ID --chain arbitrum --schedule "*/10 * * * * *" --account /path/to/keypair --network testnet \
    --programId $SWITCHBOARD_ADDRESS_ARBITRUM_TESTNET \
    --parameters="string:ETH,uint256:1698781846,uint256:2000,uint8:0"
export ROUTINE_ID=<YOUR ROUTINE ID>

## For funding the function, you can use the following:
sb evm routine fund ${ROUTINE_ID?} --chain arbitrum --fundAmount 0.01 --account /path/to/keypair \
    --network testnet --programId $SWITCHBOARD_ADDRESS_ARBITRUM_TESTNET
```

NOTE: the above will not work with the example contract as it is not set up to handle uninitialized calls

### Deploying and Maintenance

After you publish the function and create it on the blockchain, you must keep the function escrow account funded to cover gas fees. Revisions to the function can be made by deploying a new version and updating the function config on-chain.

## Writing Receiver Contracts

While Switchboard Functions can call back into any number of on-chain functions, it's useful to limit access to some privileged functions to just _your_ Switchboard Function.

In order to do this you'll need to know the switchboard address you're using, and which functionId will be calling into the function in question.

Last gotcha: when encoding parameters with variable length fields Solidity-side, make sure you spread the params in the encode call. For example, if you have a struct with a string and a uint, you'll need to do something like:

```solidity
// Get order data from the market
ReceiverLib.Order memory order = ReceiverLib.Order({
    marketId: "ETH",
    expDate: expirationDate,  // uint256 unix timestamp
    strikePrice: strikePrice, // uint256
    optionType: optionType    // enum -> u8
});

// Encode the order data to pass to the switchboard function request
// NOTE: We spread the fields here because solidity encodes structs with variable length fields differently
bytes memory orderData = abi.encode(
    order.marketId, // <-- strings are variable length
    order.expDate,
    order.strikePrice,
    order.optionType
);

// Create the Switchboard Function Request & store it
ISwitchboard switchboard = ISwitchboard(AdminLib.switchboard());
address callId = switchboard.sendRequest{value: msg.value}(
    AdminLib.functionId(),
    orderData
);
```
