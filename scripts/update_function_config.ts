//setFunctionConfig
import { SwitchboardProgram } from "@switchboard-xyz/evm.js";
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  const diamondAddress =
    process.env.SWITCHBOARD_ADDRESS ?? process.env.DIAMOND_ADDRESS ?? "";

  if (!diamondAddress) {
    throw new Error(
      "Please set the diamond address with: export SWITCHBOARD_ADDRESS=..."
    );
  }

  const functionId = process.env.FUNCTION_ID ?? "";
  if (!functionId) {
    throw new Error("Please set the function ID with: export FUNCTION_ID=...");
  }

  const container = process.env.CONTAINER_NAME;
  if (!container) {
    throw new Error(
      'Please set the container, ex: export CONTAINER_NAME="switchboardlabs/price-oracle"'
    );
  }

  console.log(
    "Updating the function with account:",
    await deployer.getAddress()
  );

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const switchboardProgram = await SwitchboardProgram.load(
    deployer,
    diamondAddress
  );

  // Update FUNCTION
  const tx = await switchboardProgram.sb.setFunctionConfig(
    functionId,
    container,
    deployer.address,
    "dockerhub",
    container,
    "latest",
    "",
    "",
    []
  );

  // WAIT FOR TX
  const receipt = await tx.wait();
  console.log(receipt);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
